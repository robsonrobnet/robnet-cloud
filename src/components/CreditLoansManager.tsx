import React, { useMemo, useState } from 'react';
import { Transaction, Category, TransactionScope } from '../types';
import { CreditCard, Landmark, TrendingDown, Calendar, AlertCircle, List, CheckCircle2, Wallet, X, ArrowRight, Loader2, DollarSign, Split, Plus, Save, Edit2, Calculator, PieChart, Receipt } from 'lucide-react';
import { supabase, formatSupabaseError } from '../lib/supabase';

interface CreditLoansManagerProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdate?: () => void;
}

interface LoanGroup {
  id: string; // usually description base name
  description: string;
  totalDebt: number;
  remainingAmount: number;
  paidAmount: number;
  totalInstallments: number;
  currentInstallment: number;
  nextDueDate: string;
  nextAmount: number;
  category: string;
  progress: number;
  items: Transaction[]; // Stores all related transactions
}

const CreditLoansManager: React.FC<CreditLoansManagerProps> = ({ transactions, categories, onUpdate }) => {
  const [selectedLoan, setSelectedLoan] = useState<LoanGroup | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Payment Modal State
  const [paymentTarget, setPaymentTarget] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Create Loan Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLoan, setNewLoan] = useState({
    description: '',
    totalAmount: '',
    installments: 12,
    startDate: new Date().toISOString().split('T')[0],
    category_id: '',
    scope: 'BUSINESS' as TransactionScope
  });

  const openLoanDetails = (loan: LoanGroup) => {
    setSelectedLoan(loan);
  };

  const loansData = useMemo(() => {
    const loanKeywords = ['cartão', 'credit', 'loan', 'empréstimo', 'financiamento', 'parcela', 'fatura'];

    // 1. Filter transactions: installments OR category keywords
    const installmentItems = transactions.filter(t => {
       if (t.type !== 'EXPENSE') return false;
       
       const hasInstallments = t.installment_total !== undefined && t.installment_total !== null && t.installment_total >= 1;
       const isLoanCategory = loanKeywords.some(k => t.category.toLowerCase().includes(k) || t.description.toLowerCase().includes(k));
       
       return hasInstallments || isLoanCategory;
    });
    
    // 2. Group by base description
    const groups: Record<string, LoanGroup> = {};

    installmentItems.forEach(t => {
       // Remove installment suffixes like (1/12) to find the parent group
       const baseDesc = t.description.replace(/\s*\(\d+\/\d+\)/g, '').trim();
       const key = `${baseDesc}`; 

       if (!groups[key]) {
          groups[key] = {
             id: key,
             description: baseDesc,
             totalDebt: 0,
             remainingAmount: 0,
             paidAmount: 0,
             totalInstallments: t.installment_total || 1,
             currentInstallment: 0,
             nextDueDate: '',
             nextAmount: 0,
             category: t.category,
             progress: 0,
             items: []
          };
       }

       const group = groups[key];
       group.items.push(t); // Add item to group

       const amount = Number(t.amount);
       
       if (t.status?.toUpperCase() === 'PAID') {
          group.paidAmount += amount;
       } 
       
       // Calculate next pending payment
       if (t.status === 'PENDING' || t.status === 'OVERDUE') {
          // If this is the earliest pending item, set it as next due
          if (!group.nextDueDate || new Date(t.due_date || t.date) < new Date(group.nextDueDate)) {
             group.nextDueDate = t.due_date || t.date;
             group.nextAmount = amount;
             group.currentInstallment = t.installment_current || 1;
          }
       }
       
       // Update max installments found
       if (t.installment_total && t.installment_total > group.totalInstallments) {
          group.totalInstallments = t.installment_total;
       }
    });

    // Finalize Calculations
    return Object.values(groups).map(g => {
       // Sort items by date/installment
       g.items.sort((a,b) => {
           const dateA = new Date(a.due_date || a.date).getTime();
           const dateB = new Date(b.due_date || b.date).getTime();
           if (dateA !== dateB) return dateA - dateB;
           return (a.installment_current || 0) - (b.installment_current || 0);
       });

       // Re-sum total debt based on all items (to account for different values per installment)
       const allItemsSum = g.items.reduce((acc, i) => acc + Number(i.amount), 0);
       g.totalDebt = allItemsSum;
       g.remainingAmount = Number((g.totalDebt - g.paidAmount).toFixed(2));
       g.progress = g.totalDebt > 0 ? (g.paidAmount / g.totalDebt) * 100 : 0;
       
       if (g.remainingAmount < 0.01) g.remainingAmount = 0; // Floating point fix

       return g;
    }).filter(g => g.remainingAmount > 0.01 || g.nextDueDate !== '').sort((a,b) => b.remainingAmount - a.remainingAmount);

  }, [transactions]);

  const stats = useMemo(() => {
     return loansData.reduce((acc, curr) => ({
        totalDebt: acc.totalDebt + curr.remainingAmount,
        monthlyCommitment: acc.monthlyCommitment + (curr.progress < 100 ? curr.nextAmount : 0)
     }), { totalDebt: 0, monthlyCommitment: 0 });
  }, [loansData]);

  // --- ACTIONS ---

  const handleCreateLoan = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newLoan.description || !newLoan.totalAmount || Number(newLoan.totalAmount) <= 0) {
          alert("Preencha os campos obrigatórios.");
          return;
      }

      setProcessingId('CREATE');
      try {
          const totalVal = parseFloat(newLoan.totalAmount);
          const count = newLoan.installments;
          const portion = totalVal / count;
          const categoryName = categories.find(c => c.id === newLoan.category_id)?.name || 'Cartão de Crédito';
          
          // Get basic info from existing transaction or default
          let baseData: any = {};
          if (transactions.length > 0) {
              baseData = { user_id: transactions[0].user_id, company_id: transactions[0].company_id };
          } else {
              throw new Error("Não foi possível identificar o usuário/empresa. Adicione uma transação simples primeiro.");
          }

          const payloads = [];
          const startDate = new Date(newLoan.startDate);

          for (let i = 0; i < count; i++) {
              const date = new Date(startDate);
              date.setMonth(startDate.getMonth() + i);
              if (date.getDate() !== startDate.getDate()) date.setDate(0); // Handle month overflow
              const dateStr = date.toISOString().split('T')[0];

              payloads.push({
                  ...baseData,
                  description: `${newLoan.description} (${i+1}/${count})`,
                  amount: portion,
                  type: 'EXPENSE',
                  status: 'PENDING',
                  category_id: newLoan.category_id || null,
                  category: categoryName,
                  date: dateStr,
                  due_date: dateStr,
                  scope: newLoan.scope,
                  installment_current: i + 1,
                  installment_total: count,
                  is_recurring: false
              });
          }

          const { error } = await supabase.from('transactions').insert(payloads);
          if (error) throw error;

          alert("Fatura/Parcelamento criado com sucesso!");
          if (onUpdate) onUpdate();
          setShowCreateModal(false);
          setNewLoan({ description: '', totalAmount: '', installments: 12, startDate: new Date().toISOString().split('T')[0], category_id: '', scope: 'BUSINESS' });

      } catch (e: any) {
          alert("Erro ao criar: " + formatSupabaseError(e));
      } finally {
          setProcessingId(null);
      }
  };

  const initiatePayment = (transaction: Transaction) => {
      setPaymentTarget(transaction);
      setPaymentAmount(String(transaction.amount));
      setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const processPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!paymentTarget) return;

      const payVal = parseFloat(paymentAmount);
      const originalVal = Number(paymentTarget.amount);

      if (isNaN(payVal) || payVal <= 0) return alert("Valor inválido.");
      if (payVal > originalVal) return alert("O valor do pagamento não pode ser maior que o valor da parcela original.");

      setProcessingId(paymentTarget.id);

      try {
          // Check for Partial Payment
          const isPartial = payVal < originalVal;
          const remainingVal = Number((originalVal - payVal).toFixed(2));

          const baseDesc = paymentTarget.description
              .replace(/\s*\(Restante\)/gi, '')
              .replace(/\s*\(Pago Parcial\)/gi, '')
              .replace(/\s*\(Parcial\)/gi, '')
              .trim();

          // 1. Update original to PAID and set amount to paid amount
          const { error: updateError } = await supabase
              .from('transactions')
              .update({
                  status: 'PAID',
                  amount: payVal,
                  date: paymentDate,
                  description: isPartial ? `${baseDesc} (Pago Parcial)` : baseDesc
              })
              .eq('id', paymentTarget.id);

          if (updateError) throw updateError;

          // 2. If partial, create new PENDING transaction for the rest
          if (isPartial && remainingVal > 0.01) {
              const { error: insertError } = await supabase
                  .from('transactions')
                  .insert([{
                      ...paymentTarget,
                      id: undefined, // New ID
                      created_at: undefined,
                      status: 'PENDING',
                      amount: remainingVal,
                      description: `${baseDesc} (Restante)`,
                      date: paymentTarget.due_date || paymentTarget.date // Keep original due date
                  }]);
              
              if (insertError) throw insertError;
          }

          if (onUpdate) onUpdate();
          setPaymentTarget(null); // Close modal
          setSelectedLoan(null); // Close details to refresh
          alert(isPartial ? `Baixa parcial de R$ ${payVal} realizada! Restante de R$ ${remainingVal} criado.` : "Pagamento total confirmado!");

      } catch (e: any) {
          alert("Erro: " + formatSupabaseError(e));
      } finally {
          setProcessingId(null);
      }
  };

  const handleSettleLoan = async (group: LoanGroup) => {
      const pendingIds = group.items.filter(i => i.status !== 'PAID').map(i => i.id);
      
      if (pendingIds.length === 0) return alert("Não há itens pendentes para quitar.");

      if (!confirm(`ATENÇÃO: Deseja quitar TOTALMENTE o saldo de R$ ${group.remainingAmount.toLocaleString('pt-BR')}?\n\nIsso marcará ${pendingIds.length} parcelas como pagas hoje.`)) return;
      
      setProcessingId('BULK');
      try {
          const { error } = await supabase.from('transactions')
            .update({ status: 'PAID', date: new Date().toISOString().split('T')[0] })
            .in('id', pendingIds);
          
          if (error) throw error;
          
          if (onUpdate) await onUpdate(); 
          setSelectedLoan(null); 
          alert("Fatura/Dívida quitada com sucesso!");
      } catch (e: any) {
          alert("Erro: " + formatSupabaseError(e));
      } finally {
          setProcessingId(null);
      }
  };

  const partialMath = useMemo(() => {
      if (!paymentTarget || !paymentAmount) return null;
      const original = Number(paymentTarget.amount);
      const pay = parseFloat(paymentAmount) || 0;
      const remaining = original - pay;
      return { original, pay, remaining: remaining > 0 ? remaining : 0 };
  }, [paymentTarget, paymentAmount]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 pb-20 relative">
       
       {/* CREATE LOAN MODAL */}
       {showCreateModal && (
           <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
               <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                   <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                   
                   <div className="mb-6 flex items-center gap-3">
                       <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                           <CreditCard size={24} />
                       </div>
                       <div>
                           <h3 className="text-lg font-black text-slate-800 dark:text-white">Novo Parcelamento / Fatura</h3>
                           <p className="text-xs text-slate-500">Registre faturas de cartão ou empréstimos</p>
                       </div>
                   </div>

                   <form onSubmit={handleCreateLoan} className="space-y-4">
                       
                       {/* Quick Presets */}
                       <div className="flex gap-2 mb-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                          <button type="button" onClick={() => setNewLoan({...newLoan, installments: 1, description: 'Fatura Cartão'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${newLoan.installments === 1 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-500'}`}>
                             <Receipt size={14} /> Fatura (1x)
                          </button>
                          <button type="button" onClick={() => setNewLoan({...newLoan, installments: 12, description: 'Empréstimo'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${newLoan.installments > 1 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-500'}`}>
                             <Calendar size={14} /> Parcelado (12x)
                          </button>
                       </div>

                       <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                           <input required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" placeholder="Ex: Fatura Nubank" value={newLoan.description} onChange={e => setNewLoan({...newLoan, description: e.target.value})} />
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Total (R$)</label>
                               <input required type="number" step="0.01" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" placeholder="0.00" value={newLoan.totalAmount} onChange={e => setNewLoan({...newLoan, totalAmount: e.target.value})} />
                           </div>
                           <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qtd. Parcelas</label>
                               <input required type="number" min="1" max="360" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={newLoan.installments} onChange={e => setNewLoan({...newLoan, installments: parseInt(e.target.value)})} />
                           </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1ª Parcela / Vencto</label>
                               <input required type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={newLoan.startDate} onChange={e => setNewLoan({...newLoan, startDate: e.target.value})} />
                           </div>
                           <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                               <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={newLoan.category_id} onChange={e => setNewLoan({...newLoan, category_id: e.target.value})}>
                                   <option value="">Selecione...</option>
                                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                               </select>
                           </div>
                       </div>

                       <div className="flex gap-2">
                           <button type="button" onClick={() => setNewLoan({...newLoan, scope: 'BUSINESS'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${newLoan.scope === 'BUSINESS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>Empresa (PJ)</button>
                           <button type="button" onClick={() => setNewLoan({...newLoan, scope: 'PERSONAL'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${newLoan.scope === 'PERSONAL' ? 'bg-teal-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>Pessoal (PF)</button>
                       </div>

                       <button disabled={!!processingId} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 mt-2 hover:bg-emerald-600 transition-all">
                           {processingId ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Gerar Registro
                       </button>
                   </form>
               </div>
           </div>
       )}

       {/* PAYMENT MODAL (INDIVIDUAL/PARTIAL) */}
       {paymentTarget && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
               <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                   <button onClick={() => setPaymentTarget(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                   <div className="mb-6"><h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Wallet className="text-emerald-500" size={20} /> Baixa de Parcela</h3><p className="text-xs text-slate-500 mt-1">{paymentTarget.description}</p></div>
                   <form onSubmit={processPayment} className="space-y-4">
                       <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data do Pagamento</label><input type="date" required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
                       <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor a Pagar (R$)</label><div className="relative"><DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="number" step="0.01" required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 pl-9 text-lg font-black text-slate-800 dark:text-white outline-none" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                       
                       {/* PARTIAL PAYMENT CALCULATOR DISPLAY */}
                       {partialMath && partialMath.remaining > 0.01 && (
                           <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                               <div className="flex items-center gap-2 mb-2">
                                  <Calculator size={14} className="text-indigo-500" />
                                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Simulação de Baixa Parcial</span>
                               </div>
                               <div className="grid grid-cols-3 gap-2 text-center">
                                  <div><p className="text-[9px] uppercase text-slate-400 font-bold">Original</p><p className="text-xs font-black text-slate-700 dark:text-slate-300">{partialMath.original.toFixed(2)}</p></div>
                                  <div><p className="text-[9px] uppercase text-emerald-500 font-bold">- Pago</p><p className="text-xs font-black text-emerald-600">{partialMath.pay.toFixed(2)}</p></div>
                                  <div><p className="text-[9px] uppercase text-rose-500 font-bold">= Restante</p><p className="text-xs font-black text-rose-600">{partialMath.remaining.toFixed(2)}</p></div>
                               </div>
                               <div className="mt-2 text-[10px] text-slate-500 leading-tight">
                                  Será gerado um novo lançamento de <strong>R$ {partialMath.remaining.toFixed(2)}</strong> para o saldo devedor.
                               </div>
                           </div>
                       )}
                       </div>
                       
                       <button type="submit" disabled={!!processingId} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 mt-2">{processingId ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Confirmar Pagamento</button>
                   </form>
               </div>
           </div>
       )}

       {/* LOAN DETAILS MODAL */}
       {selectedLoan && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh]">
                   <button onClick={() => setSelectedLoan(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 dark:bg-slate-800 p-2 rounded-full"><X size={20} /></button>

                   <div className="mb-6 shrink-0">
                       <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight flex items-center gap-2"><List size={24} className="text-indigo-500" />{selectedLoan.description}</h3>
                       <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedLoan.category}</p>
                       
                       {/* SUMMARY CARD */}
                       <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                           <div className="flex justify-between items-end mb-2">
                               <div><p className="text-[10px] font-black uppercase text-slate-400">Total Pago</p><p className="text-lg font-black text-emerald-500">R$ {selectedLoan.paidAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
                               <div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400">Restante</p><p className="text-2xl font-black text-slate-800 dark:text-white">R$ {selectedLoan.remainingAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
                           </div>
                           <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${selectedLoan.progress}%` }}></div></div>
                           <div className="flex justify-between items-center mt-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Original: R$ {selectedLoan.totalDebt.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                {selectedLoan.remainingAmount > 0 && (<button onClick={() => handleSettleLoan(selectedLoan)} disabled={!!processingId} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg disabled:opacity-50">{processingId === 'BULK' ? <Loader2 className="animate-spin" size={14} /> : <Wallet size={14} />} Quitar Tudo</button>)}
                           </div>
                       </div>
                   </div>

                   <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                       {selectedLoan.items.sort((a,b) => new Date(a.due_date || a.date).getTime() - new Date(b.due_date || b.date).getTime()).map(item => {
                           const isPaid = item.status === 'PAID';
                           const isOverdue = item.status === 'OVERDUE';
                           return (
                               <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${isPaid ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                   <div className="flex items-center gap-3">
                                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                           {item.installment_current || '-'}
                                       </div>
                                       <div>
                                           <p className="text-xs font-black text-slate-700 dark:text-slate-200">{new Date(item.due_date || item.date).toLocaleDateString('pt-BR')}</p>
                                           <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                               {isPaid ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> Pago</span> : isOverdue ? 'Atrasado' : 'Pendente'}
                                               {item.description.toLowerCase().includes('parcial') && <span className="text-indigo-500 ml-1">(Parcial)</span>}
                                           </p>
                                       </div>
                                   </div>
                                   <div className="flex items-center gap-3">
                                       <span className={`text-xs font-black ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                           R$ {Number(item.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                       </span>
                                       {!isPaid && (
                                           <button onClick={() => initiatePayment(item)} disabled={!!processingId} className="p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:scale-105 transition-transform disabled:opacity-50" title="Pagar"><CheckCircle2 size={14} /></button>
                                       )}
                                   </div>
                               </div>
                           );
                       })}
                   </div>
               </div>
           </div>
       )}

       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
             <CreditCard className="text-indigo-500" />
             Cartões & Empréstimos
           </h2>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Dívidas e Faturas</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all">
            <Plus size={16} /> Novo Registro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10 text-rose-600"><TrendingDown size={64} /></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dívida Total Restante</p>
             <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
                R$ {stats.totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
             </h3>
             <p className="text-xs font-bold text-rose-500 mt-2 bg-rose-50 dark:bg-rose-900/30 px-3 py-1 rounded-lg w-fit">Passivo Futuro</p>
         </div>

         <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-20 text-white"><Calendar size={64} /></div>
             <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Comprometimento Mensal</p>
             <h3 className="text-4xl font-black text-white tracking-tight mt-2">
                R$ {stats.monthlyCommitment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
             </h3>
             <p className="text-xs font-bold text-white/80 mt-2 bg-white/10 px-3 py-1 rounded-lg w-fit">Próximas Faturas</p>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
         {loansData.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
               <Landmark size={48} className="mx-auto mb-4 opacity-20" />
               <p className="font-bold uppercase text-xs tracking-widest">Nenhum parcelamento ou empréstimo ativo encontrado.</p>
            </div>
         ) : (
            loansData.map(loan => (
               <div key={loan.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-sm">
                           {Math.round(loan.progress)}%
                        </div>
                        <div>
                           <h4 className="font-black text-slate-800 dark:text-white text-lg">{loan.description}</h4>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{loan.category} • {loan.totalInstallments}x</p>
                        </div>
                     </div>
                     <div className="text-right flex flex-col items-end gap-1">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Restante</p>
                            <p className="font-black text-slate-800 dark:text-white">R$ {loan.remainingAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        {loan.paidAmount > 0 && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg mt-1">
                                <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Já Pago</p>
                                <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">R$ {loan.paidAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                            </div>
                        )}
                     </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4 relative">
                     <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-1000"
                        style={{ width: `${loan.progress}%` }}
                     ></div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                     <div className="flex items-center gap-2">
                        <AlertCircle size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                           Próxima: {loan.progress < 100 ? (loan.currentInstallment > 0 ? `Parcela ${loan.currentInstallment}` : 'A Vencer') : 'Finalizado'}
                        </span>
                     </div>
                     
                     <div className="flex items-center gap-4">
                         <div className="text-right hidden sm:block">
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mr-2">
                               {loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString('pt-BR') : '-'}
                            </span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                               R$ {loan.nextAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </span>
                         </div>
                         <button 
                           onClick={() => openLoanDetails(loan)}
                           className="bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-600 flex items-center gap-2 transition-all shadow-sm"
                         >
                            Gerenciar <ArrowRight size={12} />
                         </button>
                     </div>
                  </div>
               </div>
            ))
         )}
      </div>
    </div>
  );
};

export default CreditLoansManager;