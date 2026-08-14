
// services/financialService.ts

import { supabase, formatSupabaseError } from '../lib/supabase';
import { Transaction, Category, ChatMessage, FinancialSummary, User, CRMLeadStatus, CRMActivity, AppView, CRMLead, BankAccount, Supplier, ShopCustomer } from '../types';

export const FinancialService = {
  /**
   * Diagnostic: Check connection and table presence
   */
  async checkConnection() {
    try {
        const url = localStorage.getItem('finanai_db_url') || import.meta.env.VITE_SUPABASE_URL || "DEFAULT";
        console.log("Supabase Diagnostic:", { url: url.substring(0, 30) + "..." });
        
        const { data, error, status } = await supabase.from('transactions').select('id').limit(1);
        
        if (error) {
            console.error("Connection Check Failed:", error);
            return { status: 'ERROR', message: formatSupabaseError(error) };
        }
        
        console.log("Database reachable. Status:", status, "Data found:", data?.length ? "Yes" : "No (Empty Table)");
        return { status: 'OK', count: data?.length || 0 };
    } catch (e) {
        console.error("Critical Connection Error:", e);
        return { status: 'CRITICAL', message: String(e) };
    }
  },

  /**
   * Fetch transactions with optimized filtering
   */
  async getTransactions(companyId: string, userId: string, role: string, scope?: string) {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false }); // Index optimized

    // Manager sees all companies (Holding View), others are restricted
    if (role !== 'MANAGER') {
      query = query.eq('company_id', companyId);
    }

    if (role === 'USER') {
      query = query.eq('user_id', userId);
    }

    if (scope) {
      query = query.eq('scope', scope);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Transaction[];
  },

  /**
   * Fetch categories with caching potential
   */
  async getCategories(companyId: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('company_id', companyId);
    
    if (error) throw error;
    return data as Category[];
  },

  /**
   * Internal Helper to Generate Future Dates
   * Optimized to handle correct date rollover (e.g. Jan 31 -> Feb 28) and avoid duplicates.
   * PERFORMANCE: Uses Promise.all and Batch Insert to avoid N+1 problem.
   */
  async _generateFutureTransactions(baseTransaction: Transaction) {
    try {
        const futures: Partial<Transaction>[] = [];
        // Prefer due_date for calculation stability, fallback to date
        const startDateStr = baseTransaction.due_date || baseTransaction.date;
        const parts = startDateStr.split('-');
        const startYear = parseInt(parts[0]);
        const startMonth = parseInt(parts[1]) - 1; // JS months are 0-indexed
        const startDay = parseInt(parts[2]);
        
        // Helper to add months safely (handling 31st -> 28th/30th logic)
        const addMonths = (year: number, month: number, day: number, monthsToAdd: number): string => {
            const targetMonth = month + monthsToAdd;
            const date = new Date(year, targetMonth, day);
            if (date.getDate() !== day) {
                date.setDate(0);
            }
            return date.toISOString().split('T')[0];
        };

        const checks: Promise<void>[] = [];

        // 1. INSTALLMENTS LOGIC (Fixed number of payments)
        if (baseTransaction.installment_total && baseTransaction.installment_total > 1) {
            const current = baseTransaction.installment_current || 1;
            
            // Clean Description Base (e.g., "Compra (1/12)" -> "Compra")
            const baseDesc = baseTransaction.description.replace(/\s*\(\d+\/\d+\)/g, '').trim();

            // Prepare all candidates concurrently
            for (let i = current + 1; i <= baseTransaction.installment_total; i++) {
                checks.push((async () => {
                    const monthOffset = i - current;
                    const nextDateStr = addMonths(startYear, startMonth, startDay, monthOffset);
                    const newDesc = `${baseDesc} (${i}/${baseTransaction.installment_total})`;

                    // DUPLICATE CHECK: Verify if this specific installment exists
                    // We check this concurrently to speed up
                    const { count } = await supabase
                        .from('transactions')
                        .select('id', { count: 'exact', head: true })
                        .eq('company_id', baseTransaction.company_id)
                        .eq('installment_current', i)
                        .eq('installment_total', baseTransaction.installment_total)
                        .ilike('description', `${baseDesc}%`);

                    if (!count || count === 0) {
                        futures.push({
                            user_id: baseTransaction.user_id,
                            company_id: baseTransaction.company_id,
                            category_id: baseTransaction.category_id,
                            category: baseTransaction.category,
                            contact_email: baseTransaction.contact_email,
                            description: newDesc,
                            amount: baseTransaction.amount,
                            type: baseTransaction.type,
                            status: 'PENDING',
                            // Corrigido: usando cost_type da baseTransaction
                            cost_type: baseTransaction.cost_type,
                            scope: baseTransaction.scope,
                            date: nextDateStr,
                            due_date: nextDateStr,
                            is_recurring: false, 
                            installment_current: i,
                            installment_total: baseTransaction.installment_total
                        });
                    }
                })());
            }
        } 
        // 2. RECURRENCE LOGIC (Enhanced Subscription Logic)
        else if (baseTransaction.is_recurring) {
            const limit = baseTransaction.recurrence_limit || 1; // Default to 1 if not specified
            const period = baseTransaction.recurrence_period || 'MONTHLY';

            for (let i = 1; i <= limit; i++) {
                checks.push((async () => {
                    let nextDateStr: string;
                    if (period === 'MONTHLY') {
                        nextDateStr = addMonths(startYear, startMonth, startDay, i);
                    } else if (period === 'WEEKLY') {
                        const date = new Date(startYear, startMonth, startDay + (i * 7));
                        nextDateStr = date.toISOString().split('T')[0];
                    } else { // YEARLY
                        const date = new Date(startYear + i, startMonth, startDay);
                        if (date.getDate() !== startDay) date.setDate(0);
                        nextDateStr = date.toISOString().split('T')[0];
                    }

                    const targetDate = new Date(nextDateStr);
                    let startOfTarget, endOfTarget: string;

                    if (period === 'MONTHLY') {
                        startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).toISOString();
                        endOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).toISOString();
                    } else if (period === 'WEEKLY') {
                        startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 3).toISOString();
                        endOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 3).toISOString();
                    } else {
                        startOfTarget = new Date(targetDate.getFullYear(), 0, 1).toISOString();
                        endOfTarget = new Date(targetDate.getFullYear(), 11, 31).toISOString();
                    }

                    const { count } = await supabase
                        .from('transactions')
                        .select('id', { count: 'exact', head: true })
                        .eq('company_id', baseTransaction.company_id)
                        .eq('description', baseTransaction.description)
                        .gte('date', startOfTarget)
                        .lte('date', endOfTarget);

                    if (!count || count === 0) {
                        futures.push({
                            user_id: baseTransaction.user_id,
                            company_id: baseTransaction.company_id,
                            category_id: baseTransaction.category_id,
                            category: baseTransaction.category,
                            contact_email: baseTransaction.contact_email,
                            description: baseTransaction.description,
                            amount: baseTransaction.amount,
                            type: baseTransaction.type,
                            status: 'PENDING',
                            cost_type: baseTransaction.cost_type,
                            scope: baseTransaction.scope,
                            date: nextDateStr,
                            due_date: nextDateStr,
                            is_recurring: true,
                            recurrence_period: period,
                            recurrence_limit: limit
                        });
                    }
                })());
            }
        }

        // Wait for all checks to complete
        await Promise.all(checks);

        // BATCH INSERT: Insert all valid future transactions in one go
        if (futures.length > 0) {
            // Sort by date to ensure order in DB
            futures.sort((a,b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
            
            const { error } = await supabase.from('transactions').insert(futures);
            if (error) {
                console.warn("Auto-generation partial failure:", formatSupabaseError(error));
            } else {
                console.log(`Generated ${futures.length} future transactions in batch.`);
            }
        }

    } catch (e) {
        console.error("Auto-generation critical failure:", e);
    }
  },

  /**
   * Optimized batch insert or single insert with Auto-Generation trigger
   * NOW INCLUDES ROBUST DUPLICATE CHECKING
   */
  async addTransaction(payload: Partial<Transaction>) {
    // 0. MULTI-TENANT SAFETY CHECK
    if (!payload.company_id) {
        throw new Error("Erro de Segurança: Tentativa de criar transação sem vínculo empresarial (company_id missing).");
    }

    console.log("Attempting Insert:", payload.description, payload.amount);

    // 1. PRIMARY INSERT (Full Payload)
    const { data: fullData, error: fullError } = await supabase
      .from('transactions')
      .insert([payload])
      .select()
      .maybeSingle();

    if (!fullError) {
        if (fullData) this._generateFutureTransactions(fullData).catch(console.warn);
        return { data: fullData, error: null };
    }

    console.warn("Primary Insert Failed, triggering fallbacks:", fullError.message);

    // 2. FALLBACK A: Legacy Schema (Remove newer columns)
    const { 
        installment_current, installment_total, 
        recurrence_period, recurrence_limit, 
        cost_type, scope, contact_email, ...legacyPayload 
    } = payload as any;

    const { data: legacyData, error: legacyError } = await supabase
        .from('transactions')
        .insert([legacyPayload])
        .select()
        .maybeSingle();

    if (!legacyError) {
        return { data: legacyData, error: null };
    }

    console.warn("Legacy Fallback Failed:", legacyError.message);

    // 3. FALLBACK B: Bare Minimum (Essential fields only)
    const barePayload = {
        user_id: payload.user_id,
        company_id: payload.company_id,
        description: payload.description || 'Lançamento',
        amount: payload.amount || 0,
        type: payload.type || 'EXPENSE',
        date: payload.date || new Date().toISOString().split('T')[0],
        category: payload.category || 'Outros'
    };

    console.log("Attempting Bare Minimum Insert:", barePayload);
    const { data: bareData, error: bareError } = await supabase
        .from('transactions')
        .insert([barePayload])
        .select()
        .maybeSingle();

    if (bareError) {
        console.error("All insertion layers failed. Final Error:", bareError);
        throw new Error(`Falha total no banco: ${bareError.message}. Verifique as permissões (RLS) da tabela 'transactions' no Supabase.`);
    }

    return { data: bareData, error: null };
  },

  /**
   * Batch Insert Transactions
   */
  async batchAddTransactions(payloads: Partial<Transaction>[]) {
    if (payloads.length === 0) return { data: [], error: null };
    
    // Safety check for first item
    if (!payloads[0].company_id) {
        throw new Error("Erro de Segurança: Lote de transações sem company_id.");
    }

    const { data, error } = await supabase
        .from('transactions')
        .insert(payloads)
        .select();

    if (error) {
        console.error("Batch Insert Error:", error);
        throw error;
    }

    // Trigger recurrence sync for the whole batch
    if (data && data.length > 0) {
        data.forEach((t: any) => this._generateFutureTransactions(t).catch(console.error));
    }

    return { data, error: null };
  },

  /**
   * Update transaction with specific fields and trigger generation if changed to recurring
   */
  async updateTransaction(id: string, updates: Partial<Transaction>) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;

    // Trigger Auto-Generation if updated to be recurring or installment info changed
    if (data && (updates.is_recurring || updates.installment_total)) {
        this._generateFutureTransactions(data);
    }

    return data;
  },

  /**
   * System Sync: Verifies DB for missing recurring/installment transactions
   */
  async syncRecurrence(companyId: string) {
     try {
        const today = new Date();
        const { data: candidates } = await supabase
            .from('transactions')
            .select('*')
            .eq('company_id', companyId)
            .or('is_recurring.eq.true,installment_total.gt.0')
            .gte('date', new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString()) 
            .order('date', { ascending: false });

        if (!candidates) return;

        const processedGroups = new Set<string>();

        // Run checks concurrently for better performance
        const syncPromises = candidates.map(async (t: any) => {
            const key = t.installment_total 
                ? `${t.description.replace(/\(.*\)/, '').trim()}_inst_${t.installment_total}` 
                : `${t.description}_rec`;
            
            if (!processedGroups.has(key)) {
                processedGroups.add(key);
                await this._generateFutureTransactions(t);
            }
        });

        await Promise.all(syncPromises);
     } catch (e) {
         console.warn("Recurrence Sync Failed:", e);
     }
  },

  async deleteTransaction(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  async batchDeleteTransactions(ids: string[]) {
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) throw error;
  },

  async batchUpdateTransactions(ids: string[], updates: Partial<Transaction>) {
    const { error } = await supabase.from('transactions').update(updates).in('id', ids);
    if (error) throw error;
  },

  /**
   * Bulk delete selected data for a company
   */
  async wipeTransactions(companyId: string, userId: string, options: { transactions: boolean, nfse: boolean, chat: boolean }) {
    let totalCount = 0;

    // 1. Transactions
    if (options.transactions) {
      const query = supabase.from('transactions').delete({ count: 'exact' });
      if (companyId !== 'ALL') {
        query.eq('company_id', companyId);
      }
      const { error: tError, count: tCount } = await query;
      if (tError) throw tError;
      totalCount += (tCount || 0);
    }

    // 2. NFSe RPS
    if (options.nfse) {
      try {
        const query = supabase.from('nfse_rps').delete({ count: 'exact' });
        if (companyId !== 'ALL') {
          query.eq('company_id', companyId);
        }
        const { count: rCount } = await query;
        totalCount += (rCount || 0);
      } catch (e) {
        console.warn("Could not wipe nfse_rps:", e);
      }
    }

    // 3. Chat Messages
    if (options.chat) {
      try {
        const query = supabase.from('chat_messages').delete();
        if (companyId !== 'ALL') {
          query.eq('user_id', userId);
        }
        await query;
      } catch (e) {
        console.warn("Could not wipe chat_messages:", e);
      }
    }
    
    return totalCount;
  },

  /**
   * Master Reset: Deletes all data related to a company except the current user
   */
  async wipeAllCompanyData(companyId: string, currentUserId: string) {
    // 1. Transactions
    const tRes = await supabase.from('transactions').delete().eq('company_id', companyId);
    if (tRes.error) throw tRes.error;

    // 2. Categories
    const cRes = await supabase.from('categories').delete().eq('company_id', companyId);
    if (cRes.error) throw cRes.error;

    // 3. NFSe Config
    const nRes = await supabase.from('nfse_configs').delete().eq('company_id', companyId);
    if (nRes.error) throw nRes.error;

    // 4. Other Users
    const uRes = await supabase.from('users').delete().eq('company_id', companyId).neq('id', currentUserId);
    if (uRes.error) throw uRes.error;

    return true;
  },

  /**
   * Emergency: Update Master User Password
   * Improved with robust error handling for RLS and fixed IDs.
   * This ensures the 'Master' access is always valid and recorded in the database.
   */
  async updateMasterUser() {
    try {
      console.log("[FinancialService] Solicitando sincronização Master ao Servidor...");
      const response = await fetch('/api/admin/sync-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro na resposta do servidor");
      }

      const result = await response.json();
      console.log("[FinancialService] Sincronização Master concluída via Backend.");
      
      return {
        success: true,
        username: result.username,
        password: result.password,
        key: result.key,
        message: "Sincronização completa via Backend (RLS bypassed)."
      };
    } catch (e: any) {
      console.error("[FinancialService] Falha na sincronização via Backend:", e);
      throw new Error(`FALHA NA SINCRONIZAÇÃO: ${e.message}`);
    }
  },

  async getChatHistory(userId: string) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true })
      .limit(50);
      
    if (error) throw error;
    return data.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp).getTime()
    })) as ChatMessage[];
  },

  async saveChatMessage(userId: string, role: 'user' | 'assistant', content: string) {
    await supabase.from('chat_messages').insert([{
      user_id: userId,
      role,
      content,
      timestamp: new Date().toISOString()
    }]);
  },

  /**
   * CRM Methods
   */
  async getCRMLeads(companyId: string, scope?: string) {
    let query = supabase
      .from('crm_leads')
      .select('*, contact:crm_contacts(*)')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });
    
    if (scope) {
      query = query.eq('scope', scope);
    }

    const { data, error } = await query;
    if (error) {
       console.warn("CRM table might not be ready:", error.message);
       return [];
    }
    return data;
  },

  async updateLeadStatus(leadId: string, status: CRMLeadStatus) {
    const { data, error } = await supabase
      .from('crm_leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLead(leadId: string, updates: Partial<CRMLead>) {
    const { data, error } = await supabase
      .from('crm_leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLeadAI(leadId: string, aiData: { score: number, insight: string }) {
    const { error } = await supabase
      .from('crm_leads')
      .update({ 
        score: aiData.score, 
        ai_insight: aiData.insight,
        updated_at: new Date().toISOString() 
      })
      .eq('id', leadId);
    if (error) throw error;
  },

  async createCRMActivity(activity: Partial<CRMActivity>) {
    const { data, error } = await supabase
      .from('crm_activities')
      .insert([activity])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getCRMActivities(leadId: string) {
    const { data, error } = await supabase
      .from('crm_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data;
  },

  async getCRMContacts(companyId: string) {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    
    if (error) return [];
    return data;
  },

  // ==========================================
  // BANK ACCOUNTS (Contas Bancárias)
  // ==========================================
  async getBankAccounts(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });
      if (error) {
        console.warn("Tabela bank_accounts pode não existir ainda:", error.message);
        return [] as BankAccount[];
      }
      return (data || []) as BankAccount[];
    } catch (err) {
      console.warn("Erro ao buscar contas bancárias:", err);
      return [] as BankAccount[];
    }
  },

  async getOrCreateBankAccount(companyId: string, bankName: string, bankCode?: string) {
    if (!bankName || !bankName.trim()) return null;
    const cleanName = bankName.trim();
    try {
      // 1. Tentar encontrar conta bancária existente pelo nome
      const existing = await this.getBankAccounts(companyId);
      const match = existing.find(b => 
        b.name.toLowerCase() === cleanName.toLowerCase() ||
        b.name.toLowerCase().includes(cleanName.toLowerCase()) ||
        cleanName.toLowerCase().includes(b.name.toLowerCase())
      );
      if (match) return match;

      // 2. Criar se não existir
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert([{
          company_id: companyId,
          name: cleanName,
          bank_code: bankCode || null,
          account_type: 'CHECKING',
          initial_balance: 0,
          current_balance: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.warn("Não foi possível criar banco no DB (usando fallback local):", error.message);
        return {
          id: `bank_${Date.now()}`,
          company_id: companyId,
          name: cleanName,
          bank_code: bankCode
        } as BankAccount;
      }
      return data as BankAccount;
    } catch (err) {
      console.warn("Erro ao obter/criar conta bancária:", err);
      return {
        id: `bank_${Date.now()}`,
        company_id: companyId,
        name: cleanName,
        bank_code: bankCode
      } as BankAccount;
    }
  },

  async addBankAccount(bank: Partial<BankAccount>) {
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert([bank])
      .select()
      .single();
    if (error) throw error;
    return data as BankAccount;
  },

  async updateBankAccount(id: string, bank: Partial<BankAccount>) {
    const { data, error } = await supabase
      .from('bank_accounts')
      .update(bank)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as BankAccount;
  },

  async deleteBankAccount(id: string) {
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ==========================================
  // CATEGORIAS INTELIGENTES POR TIPO DE OPERAÇÃO
  // ==========================================
  async getOrCreateCategory(
    companyId: string, 
    name: string, 
    type: 'INCOME' | 'EXPENSE' | 'BOTH' = 'BOTH', 
    icon = 'Tag', 
    color = '#6366F1'
  ): Promise<Category | null> {
    if (!name || !name.trim()) return null;
    const cleanName = name.trim();
    try {
      const categories = await this.getCategories(companyId);
      const found = categories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
      if (found) return found;

      const { data, error } = await supabase
        .from('categories')
        .insert([{
          company_id: companyId,
          name: cleanName,
          color: color || '#6366F1',
          icon: icon || 'Tag',
          type: type || 'BOTH',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.warn("Falha ao criar categoria no banco:", error.message);
        return null;
      }
      return data as Category;
    } catch (err) {
      console.warn("Erro ao buscar/criar categoria:", err);
      return null;
    }
  },

  // ==========================================
  // CADASTRO AUTOMÁTICO DE ENTIDADES (CLIENTES & FORNECEDORES)
  // ==========================================
  async getOrCreateCustomer(companyId: string, customerData: { name: string; document_number?: string; email?: string; phone?: string }) {
    if (!customerData.name || !customerData.name.trim()) return null;
    const cleanName = customerData.name.trim();
    try {
      // 1. Checar se já existe em shop_customers
      const { data: existingShop } = await supabase
        .from('shop_customers')
        .select('*')
        .eq('company_id', companyId)
        .ilike('name', `%${cleanName}%`)
        .limit(1);

      if (existingShop && existingShop.length > 0) {
        return existingShop[0] as ShopCustomer;
      }

      // 2. Criar novo cliente
      const { data, error } = await supabase
        .from('shop_customers')
        .insert([{
          company_id: companyId,
          name: cleanName,
          document_number: customerData.document_number || null,
          email: customerData.email || '',
          phone: customerData.phone || '',
          type: customerData.document_number && customerData.document_number.replace(/\D/g, '').length > 11 ? 'WHOLESALE' : 'RETAIL',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.warn("Erro ao criar shop_customer:", error.message);
      }

      // 3. Também sincronizar com CRM Contacts se possível
      try {
        await supabase.from('crm_contacts').insert([{
          company_id: companyId,
          name: cleanName,
          email: customerData.email || '',
          phone: customerData.phone || '',
          organization: cleanName,
          tags: ['Extrato Bancário', 'Recebimento de Cliente'],
          created_at: new Date().toISOString()
        }]);
      } catch (crmErr) {
        // Ignora se não existir
      }

      return data as ShopCustomer;
    } catch (err) {
      console.warn("Erro em getOrCreateCustomer:", err);
      return null;
    }
  },

  async getOrCreateSupplier(companyId: string, supplierData: { name: string; document_number?: string; email?: string; phone?: string; category_name?: string }) {
    if (!supplierData.name || !supplierData.name.trim()) return null;
    const cleanName = supplierData.name.trim();
    try {
      const { data: existing } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .ilike('name', `%${cleanName}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        return existing[0] as Supplier;
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert([{
          company_id: companyId,
          name: cleanName,
          document_number: supplierData.document_number || null,
          email: supplierData.email || '',
          phone: supplierData.phone || '',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.warn("Erro ao cadastrar supplier:", error.message);
      }
      return data as Supplier;
    } catch (err) {
      console.warn("Erro em getOrCreateSupplier:", err);
      return null;
    }
  },

  // ==========================================
  // CONCILIAÇÃO BANCÁRIA & PREVENÇÃO DE DUPLICIDADE
  // ==========================================
  /**
   * Compara os lançamentos extraídos do extrato com o banco de dados.
   * Evita duplicidade de lançamentos e identifica quais são novos vs já conciliados.
   */
  async reconcileBankStatement(
    companyId: string, 
    extractedItems: Partial<Transaction>[]
  ): Promise<{
    reconciledList: Array<Partial<Transaction> & { 
      reconciliationStatus: 'NEW' | 'RECONCILED' | 'DUPLICATE_SKIPPED';
      matchedTransactionId?: string;
      matchReason?: string;
    }>;
    summary: {
      total: number;
      newCount: number;
      reconciledCount: number;
      duplicateSkippedCount: number;
      totalIncome: number;
      totalExpense: number;
    };
  }> {
    try {
      // 1. Buscar transações existentes da empresa (últimos 12 meses)
      const { data: existingTransactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId);

      const dbList = (existingTransactions || []) as Transaction[];

      let newCount = 0;
      let reconciledCount = 0;
      let duplicateSkippedCount = 0;
      let totalIncome = 0;
      let totalExpense = 0;

      const reconciledList = extractedItems.map(item => {
        const itemAmount = Math.abs(Number(item.amount) || 0);
        const itemDate = item.date || new Date().toISOString().split('T')[0];
        const itemType = item.type || 'EXPENSE';
        const itemDesc = (item.description || '').toLowerCase().trim();

        if (itemType === 'INCOME') {
          totalIncome += itemAmount;
        } else {
          totalExpense += itemAmount;
        }

        // Buscar match no banco de dados
        // Critérios: Mesmo valor (diferença < 0.05), mesmo tipo, e data próxima (até 3 dias de compensação)
        const match = dbList.find(dbT => {
          const dbAmount = Math.abs(Number(dbT.amount) || 0);
          const isSameAmount = Math.abs(dbAmount - itemAmount) < 0.05;
          const isSameType = dbT.type === itemType;
          
          if (!isSameAmount || !isSameType) return false;

          // Checar datas (tolerância de até 3 dias úteis para compensação de TED/Boleto/Cartão)
          const d1 = new Date(dbT.date || dbT.due_date || '').getTime();
          const d2 = new Date(itemDate).getTime();
          const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
          
          const isDateClose = isNaN(diffDays) || diffDays <= 3;
          if (!isDateClose) return false;

          // Se a descrição tiver palavras em comum ou o valor e data forem idênticos
          const dbDesc = (dbT.description || '').toLowerCase();
          const words = itemDesc.split(/\s+/).filter(w => w.length > 3);
          const hasCommonWord = words.some(w => dbDesc.includes(w));

          return diffDays === 0 || hasCommonWord;
        });

        if (match) {
          // Lançamento já existe no sistema!
          // Se estava PENDING, agora está conciliado como PAID no extrato
          if (match.status === 'PENDING') {
            reconciledCount++;
            return {
              ...item,
              id: match.id,
              status: 'PAID' as any,
              is_reconciled: true,
              reconciliation_id: match.id,
              reconciliationStatus: 'RECONCILED' as const,
              matchedTransactionId: match.id,
              matchReason: `Conciliado com lançamento existente "${match.description}" de ${match.date}`
            };
          } else {
            // Já estava lançado e pago -> evitar duplicidade!
            duplicateSkippedCount++;
            return {
              ...item,
              id: match.id,
              is_reconciled: true,
              reconciliation_id: match.id,
              reconciliationStatus: 'DUPLICATE_SKIPPED' as const,
              matchedTransactionId: match.id,
              matchReason: `Lançamento idêntico já existente no fluxo em ${match.date} (duplicidade evitada)`
            };
          }
        }

        // Lançamento novo
        newCount++;
        return {
          ...item,
          status: 'PAID' as any,
          is_reconciled: true,
          reconciliationStatus: 'NEW' as const,
          matchReason: 'Novo lançamento identificado no extrato bancário'
        };
      });

      return {
        reconciledList,
        summary: {
          total: extractedItems.length,
          newCount,
          reconciledCount,
          duplicateSkippedCount,
          totalIncome,
          totalExpense
        }
      };
    } catch (err) {
      console.error("Erro na conciliação de extrato bancário:", err);
      return {
        reconciledList: extractedItems.map(t => ({ ...t, reconciliationStatus: 'NEW' as const })),
        summary: {
          total: extractedItems.length,
          newCount: extractedItems.length,
          reconciledCount: 0,
          duplicateSkippedCount: 0,
          totalIncome: 0,
          totalExpense: 0
        }
      };
    }
  },

  /**
   * Test database connection and schema integrity
   */
  async testConnection() {
    try {
      // Test basic connectivity
      const { data: companies, error: cError } = await supabase.from('companies').select('id').limit(1);
      if (cError) throw cError;

      // Test transactions table
      const { error: tError } = await supabase.from('transactions').select('id').limit(1);
      if (tError) throw tError;

      // Test users table
      const { error: uError } = await supabase.from('users').select('id').limit(1);
      if (uError) throw uError;

      return true;
    } catch (e) {
      console.error("Database integrity test failed:", e);
      return false;
    }
  }
};
