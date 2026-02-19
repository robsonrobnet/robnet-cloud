
// services/financialService.ts

import { supabase, formatSupabaseError } from '../lib/supabase';
import { Transaction, Category, ChatMessage, FinancialSummary, User } from '../types';

export const FinancialService = {
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
        // 2. RECURRENCE LOGIC (Infinite, generate only ONE next month)
        else if (baseTransaction.is_recurring) {
            checks.push((async () => {
                const nextDateStr = addMonths(startYear, startMonth, startDay, 1);
                const targetDate = new Date(nextDateStr);
                const startOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).toISOString();
                const endOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).toISOString();

                const { count } = await supabase
                    .from('transactions')
                    .select('id', { count: 'exact', head: true })
                    .eq('company_id', baseTransaction.company_id)
                    .eq('description', baseTransaction.description)
                    .gte('date', startOfTargetMonth)
                    .lte('date', endOfTargetMonth);

                if (!count || count === 0) {
                    futures.push({
                        user_id: baseTransaction.user_id,
                        company_id: baseTransaction.company_id,
                        category_id: baseTransaction.category_id,
                        category: baseTransaction.category,
                        description: baseTransaction.description,
                        amount: baseTransaction.amount,
                        type: baseTransaction.type,
                        status: 'PENDING',
                        // Corrigido: usando cost_type da baseTransaction
                        cost_type: baseTransaction.cost_type,
                        scope: baseTransaction.scope,
                        date: nextDateStr,
                        due_date: nextDateStr,
                        is_recurring: true
                    });
                }
            })());
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

    // 1. DUPLICATE CHECK (Prevent double entry of same transaction)
    try {
        const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('company_id', payload.company_id)
            .eq('date', payload.date)
            .eq('amount', payload.amount)
            .eq('description', payload.description)
            .eq('type', payload.type)
            .limit(1)
            .maybeSingle();

        if (existing) {
            console.log(`Duplicate transaction prevented: ${payload.description} (${payload.date})`);
            return { data: null, error: null, isDuplicate: true };
        }
    } catch (e) {
        console.warn("Duplicate check failed, proceeding to insert attempt.");
    }

    // 2. INSERT
    const { data, error } = await supabase
      .from('transactions')
      .insert([payload])
      .select()
      .single();

    if (error) {
        // Fallback for legacy schema
        if (error.code === 'PGRST204' || error.message.includes('installment')) {
            const { installment_current, installment_total, ...legacyPayload } = payload as any;
            return await supabase.from('transactions').insert([legacyPayload]).select().single();
        }
        throw error;
    }

    // Trigger Auto-Generation for Future Installments/Recurrence
    if (data) {
        // Run in background, don't await to keep UI snappy
        this._generateFutureTransactions(data);
    }

    return { data, error: null, isDuplicate: false };
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
  }
};
