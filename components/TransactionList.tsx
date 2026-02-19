
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Category, TransactionScope, Company } from '../types';
import { 
  Search, Trash2, Calendar, Tag, ShoppingBag, Coffee, Car, Home, 
  Heart, Zap, Gamepad2, Utensils, Landmark, Wallet, CreditCard, 
  Coins, HeartPulse, Smartphone, Briefcase, User, Clock, AlertTriangle, Box, ArrowUpCircle, ArrowDownCircle,
  Edit, CheckCircle2, Save, X, Building2, ExternalLink, Filter, CalendarDays
} from 'lucide-react';
import { supabase, formatSupabaseError } from '../lib/supabase';
import { FinancialService } from '../services/financialService';

const ICON_MAP: Record<string, any> = {
  Tag, ShoppingBag, Coffee, Car, Home, Heart, Zap, Gamepad2, Utensils, 
  Landmark, Wallet, CreditCard, Coins, HeartPulse, Smartphone
};

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  companies: Company[];
  onDelete: (id: string) => void;
  onAdd: (t: any) => void;
  onUpdate: () => void;
  t: any;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, categories, companies, onDelete, onUpdate, t }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | TransactionScope>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  
  // Edit State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Action Menu State
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // 1. Filter Logic
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      const matchesScope = scopeFilter === 'ALL' || (t.scope || 'BUSINESS') === scopeFilter;
      const matchesCompany = companyFilter === 'ALL' || t.company_id === companyFilter;
      
      return matchesSearch && matchesType && matchesScope && matchesCompany;
    });
  }, [transactions, searchTerm, typeFilter, scopeFilter, companyFilter]);

  // 2. Grouping Logic (By Date)
  const groupedTransactions = useMemo(() => {
      const groups: Record<string, Transaction[]> = {};
      
      // Sort desc date
      const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      sorted.forEach(t => {
          const dateKey = t.date; // YYYY-MM-DD
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(t);
      });

      return groups;
  }, [filtered]);

  // --- ACTIONS ---

  const handleToggleStatus = async (transaction: Transaction) => {
    const newStatus = transaction.status === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await FinancialService.updateTransaction(transaction.id, { status: newStatus });
      onUpdate(); 
    } catch (e) {
      alert("Erro ao atualizar status: " + formatSupabaseError(e));
    }
    setMenuOpenId(null);
  };

  const handleQuickSettleInModal = async () => {
    if (!editingTransaction) return;
    try {
        await FinancialService.updateTransaction(editingTransaction.id, { 
            status: 'PAID',
            amount: Number(editingTransaction.amount)
        });
        setIsEditModalOpen(false);
        setEditingTransaction(null);
        onUpdate();
    } catch (e) {
        alert("Erro: " + formatSupabaseError(e));
    }
  };

  const initiateEdit = (transaction: Transaction) => {
    let resolvedCategoryId = transaction.category_id;
    if (!resolvedCategoryId && transaction.category) {
        const found = categories.find(c => c.name.toLowerCase() === transaction.category.toLowerCase());
        if (found) resolvedCategoryId = found.id;
    }
    setEditingTransaction({ ...transaction, category_id: resolvedCategoryId });
    setIsEditModalOpen(true);
    setMenuOpenId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    try {
      const payload = {
        description: editingTransaction.description,
        amount: Number(editingTransaction.amount),
        status: editingTransaction.status,
        date: editingTransaction.date,
        due_date: editingTransaction.due_date || editingTransaction.date,
        category_id: editingTransaction.category_id || null,
        category: editingTransaction.category,
        scope: editingTransaction.scope || 'BUSINESS', 
        company_id: editingTransaction.company_id,
        is_recurring: editingTransaction.is_recurring || false,
        installment_current: editingTransaction.installment_current || null,
        installment_total: editingTransaction.installment_total || null
      };

      await FinancialService.updateTransaction(editingTransaction.id, payload);
      setIsEditModalOpen(false);
      setEditingTransaction(null);
      onUpdate();
    } catch (e) {
      alert("Erro ao salvar edição: " + formatSupabaseError(e));
    }
  };

  const getEntityName = (t: Transaction) => {
      if (t.scope === 'PERSONAL') return 'Pessoa Física';
      const comp = companies.find(c => c.id === t.company_id);
      return comp ? comp.name : 'Corporativo';
  };

  const handleDelete = async (id: string) => {
    setMenuOpenId(null);
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    onDelete(id);
  };

  const formatDateHeader = (dateStr: string) => {
      const date = new Date(dateStr);
      // Ajuste de fuso horário simples (considerando que dateStr é YYYY-MM-DD e local)
      date.setHours(12,0,0,0); 
      
      const today = new Date();
      today.setHours(12,0,0,0);
      
      if (date.getTime() === today.getTime()) return "Hoje";
      
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (date.getTime() === yesterday.getTime()) return "Ontem";

      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  };

  return (
    <div className="space-y-6 relative pb-20 animate-in fade-in duration-500">
      
      {/* EDIT MODAL */}
      {isEditModalOpen && editingTransaction && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
               <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500">
                  <X size={20} />
               </button>
               
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-2xl flex items-center justify-center">
                     <Edit size={24} />
                  </div>
                  <div>
                     <h3 className="text-lg font-black text-slate-800 dark:text-white">Editar Lançamento</h3>
                     <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Ajuste os detalhes financeiros</p>
                  </div>
               </div>

               <form onSubmit={handleSaveEdit} className="space-y-4">
                  {/* Scope & Entity */}
                  <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entidade / Escopo</label>
                      <div className="flex gap-2 mt-1 mb-2">
                          <button type="button" onClick={() => setEditingTransaction({...editingTransaction, scope: 'PERSONAL'})} className={`flex-1 p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${editingTransaction.scope === 'PERSONAL' ? 'bg-teal-500 text-white border-teal-500 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><User size={14} /> Pessoal (PF)</button>
                          <button type="button" onClick={() => setEditingTransaction({...editingTransaction, scope: 'BUSINESS'})} className={`flex-1 p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${editingTransaction.scope === 'BUSINESS' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><Building2 size={14} /> Empresa (PJ)</button>
                      </div>
                      {editingTransaction.scope === 'BUSINESS' && (
                         <div className="animate-in slide-in-from-top-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione a Empresa</label>
                            <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 mt-1" value={editingTransaction.company_id} onChange={(e) => setEditingTransaction({...editingTransaction, company_id: e.target.value})}>{companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select>
                         </div>
                      )}
                  </div>

                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label><input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={editingTransaction.description} onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})} required /></div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label><input type="number" step="0.01" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={editingTransaction.amount} onChange={e => setEditingTransaction({...editingTransaction, amount: Number(e.target.value)})} required /></div>
                     <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label><select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={editingTransaction.status} onChange={e => setEditingTransaction({...editingTransaction, status: e.target.value as any})}><option value="PENDING">Pendente</option><option value="PAID">Pago / Recebido</option><option value="OVERDUE">Atrasado</option></select></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label><input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={editingTransaction.date} onChange={e => setEditingTransaction({...editingTransaction, date: e.target.value})} required /></div>
                     <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento</label><input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={editingTransaction.due_date || editingTransaction.date} onChange={e => setEditingTransaction({...editingTransaction, due_date: e.target.value})} /></div>
                  </div>

                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label><select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={editingTransaction.category_id || ''} onChange={e => { const cat = categories.find(c => c.id === e.target.value); setEditingTransaction({ ...editingTransaction, category_id: e.target.value, category: cat ? cat.name : 'Outros' }); }}><option value="">Selecione...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                  
                  <div className="pt-2 flex flex-col gap-2">
                     {editingTransaction.status !== 'PAID' && (
                        <button type="button" onClick={handleQuickSettleInModal} className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${editingTransaction.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900 dark:text-rose-300'}`}><CheckCircle2 size={16} /> {editingTransaction.type === 'INCOME' ? 'Confirmar Recebimento Agora' : 'Confirmar Pagamento Agora'}</button>
                     )}
                     <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2"><Save size={16} /> Salvar Alterações</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* HEADER & FILTERS */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div>
               <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Extrato de Lançamentos</h2>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gerenciamento completo de entradas e saídas</p>
            </div>
            <div className="flex flex-wrap gap-3">
               <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex">
                  <button onClick={() => setScopeFilter('ALL')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${scopeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}>Tudo</button>
                  <button onClick={() => setScopeFilter('BUSINESS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${scopeFilter === 'BUSINESS' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>Empresas</button>
                  <button onClick={() => setScopeFilter('PERSONAL')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${scopeFilter === 'PERSONAL' ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>Pessoal</button>
               </div>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t.search_placeholder} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/10 text-slate-900 dark:text-white font-bold text-sm" />
          </div>
          {scopeFilter === 'BUSINESS' && (
             <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none animate-in fade-in">
                <option value="ALL">Todas Empresas</option>
                {companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
             </select>
          )}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none">
            <option value="ALL">Todas Operações</option><option value="INCOME">Receitas (+)</option><option value="EXPENSE">Despesas (-)</option>
          </select>
        </div>
      </div>

      {/* TRANSACTION LIST (GROUPED) */}
      <div className="space-y-6">
         {Object.keys(groupedTransactions).length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-600">
                  <Filter size={32} />
               </div>
               <h3 className="text-lg font-black text-slate-800 dark:text-white">Nenhum lançamento encontrado</h3>
               <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mt-2">Tente ajustar os filtros ou adicione novos itens.</p>
            </div>
         ) : (
            Object.keys(groupedTransactions).sort((a,b) => new Date(b).getTime() - new Date(a).getTime()).map(dateKey => (
               <div key={dateKey} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-indigo-500" />
                        <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-wide">{formatDateHeader(dateKey)}</span>
                     </div>
                     <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">{groupedTransactions[dateKey].length} itens</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                     {groupedTransactions[dateKey].map(t => {
                        const category = categories.find(c => c.id === t.category_id || c.name === t.category);
                        const Icon = ICON_MAP[category?.icon || 'Tag'] || Tag;
                        const entityName = getEntityName(t);
                        const isOverdue = t.status === 'OVERDUE';
                        
                        return (
                           <div key={t.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                              <div className="flex items-center gap-4 flex-1">
                                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${t.type === 'INCOME' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'}`}>
                                    <Icon size={20} />
                                 </div>
                                 <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                       <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${t.scope === 'PERSONAL' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400'}`}>
                                          {t.scope === 'PERSONAL' ? 'PF' : 'PJ'}
                                       </span>
                                       <p className="text-xs font-bold text-slate-400 truncate">{entityName} • {category?.name || t.category}</p>
                                    </div>
                                    <h4 className={`text-sm font-black text-slate-800 dark:text-white truncate ${t.status === 'PAID' ? 'opacity-70 line-through decoration-slate-300 dark:decoration-slate-600' : ''}`}>{t.description}</h4>
                                    {t.installment_total && <span className="text-[9px] font-bold text-slate-400">Parcela {t.installment_current}/{t.installment_total}</span>}
                                 </div>
                              </div>

                              <div className="flex items-center justify-between md:justify-end gap-6 md:w-auto w-full border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0">
                                 <div className="text-right">
                                    <div className="flex flex-col items-end">
                                       <span className={`text-sm font-black tabular-nums ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                          {t.type === 'INCOME' ? '+' : '-'} R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                       </span>
                                       {t.status === 'PAID' ? 
                                          <span className="text-[9px] font-black uppercase text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> Pago</span> : 
                                          isOverdue ? <span className="text-[9px] font-black uppercase text-rose-500 flex items-center gap-1"><AlertTriangle size={10}/> Atrasado</span> :
                                          <span className="text-[9px] font-black uppercase text-amber-500 flex items-center gap-1"><Clock size={10}/> Pendente</span>
                                       }
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleToggleStatus(t)} className={`p-2 rounded-xl transition-colors ${t.status === 'PAID' ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title={t.status === 'PAID' ? "Marcar como Pendente" : "Marcar como Pago"}>
                                       <CheckCircle2 size={18} />
                                    </button>
                                    <button onClick={() => initiateEdit(t)} className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Editar">
                                       <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" title="Excluir">
                                       <Trash2 size={18} />
                                    </button>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            ))
         )}
      </div>
    </div>
  );
};

export default TransactionList;
