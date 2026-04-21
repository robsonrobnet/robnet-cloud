
// services/financialService.ts

import { supabase, formatSupabaseError } from '../lib/supabase';
import { Transaction, Category, ChatMessage, FinancialSummary, User } from '../types';

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
  async getTransactions(companyId: string, userId: string, role: string) {
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
        data.forEach(t => this._generateFutureTransactions(t).catch(console.error));
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
        const syncPromises = candidates.map(async (t) => {
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
        const query = supabase.from('nfse_rpss').delete({ count: 'exact' });
        if (companyId !== 'ALL') {
          query.eq('company_id', companyId);
        }
        const { count: rCount } = await query;
        totalCount += (rCount || 0);
      } catch (e) {
        console.warn("Could not wipe nfse_rpss:", e);
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
    const nRes = await supabase.from('nfse_config').delete().eq('company_id', companyId);
    if (nRes.error) throw nRes.error;

    // 4. Other Users
    const uRes = await supabase.from('users').delete().eq('company_id', companyId).neq('id', currentUserId);
    if (uRes.error) throw uRes.error;

    return true;
  },

  /**
   * Emergency: Update Master User Password
   */
  async updateMasterUser() {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('username', 'Master')
        .maybeSingle();

      if (user) {
        const { error } = await supabase
          .from('users')
          .update({ 
            password: '2298R@b',
            role: 'MANAGER'
          })
          .eq('id', user.id);
        if (error) throw error;
        console.log("Master user updated successfully (Password & Role).");
        return true;
      } else {
        console.warn("Master user not found in database.");
        return false;
      }
    } catch (e) {
      console.error("Failed to update Master user:", e);
      return false;
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
    return data as ChatMessage[];
  },

  async saveChatMessage(userId: string, role: 'user' | 'assistant', content: string) {
    await supabase.from('chat_messages').insert([{
      user_id: userId,
      role,
      content,
      timestamp: Date.now()
    }]);
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
