
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Landmark, AlertCircle, Clock, CheckCircle2, 
  RotateCcw, FileText, Calendar, MoreVertical, X, AlertTriangle, Filter, Plus, Save, Loader2,
  Edit, Trash2, Copy, TrendingUp, TrendingDown, Briefcase, User, Box, CreditCard, Building2, CalendarDays, ArrowRightCircle, Search, CheckCheck,
  ChevronLeft, ChevronRight, Wallet, PieChart, Repeat, Bell
} from 'lucide-react';
import { Transaction, Category, TransactionScope, Company, TransactionType } from '../types';
import { supabase, formatSupabaseError } from '../lib/supabase';
import { FinancialService } from '../services/financialService';

interface ReceivablesManagerProps {
  defaultMode: 'RECEIVABLES' | 'PAYABLES';
  transactions: Transaction[];
  categories: Category[];
  companies: Company[];
  t: any;
  onUpdate: () => void;
  onAdd: (t: any) => void;
}

interface Notification {
  id: string;
  type: 'CRITICAL' | 'WARNING';
  title: string;
  message: string;
  days: number;
}

const ReceivablesManager: React.FC<ReceivablesManagerProps> = ({ defaultMode, transactions, categories, companies, t, onUpdate, onAdd }) => {
  const [viewMode, setViewMode] = useState<'RECEIVABLES' | 'PAYABLES'>(defaultMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'BUSINESS' | 'PERSONAL'>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(new Date().toISOString().slice(0, 7)); 
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false); 
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    description: '', amount: '', category_id: '', scope: 'BUSINESS' as TransactionScope, company_id: '',
    date: new Date().toISOString().split('T')[0], due_date: new Date().toISOString().split('T')[0],
    is_recurring: false, status: 'PENDING' as any, installment_current: '', installment_total: '',
    type: (defaultMode === 'RECEIVABLES' ? 'INCOME' : 'EXPENSE') as TransactionType,
    contact_email: ''
  });

  const [paymentData, setPaymentData] = useState({ id: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], is_recurring: false, original_due_date: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('saving');
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        type: formData.type,
        category: categories.find(c => c.id === formData.category_id)?.name || 'Outros',
        installment_current: formData.installment_current ? Number(formData.installment_current) : undefined,
        installment_total: formData.installment_total ? Number(formData.installment_total) : undefined
      };

      if (editingId) {
        await FinancialService.updateTransaction(editingId, payload);
      } else {
        await onAdd(payload);
      }
      setShowAddModal(false);
      onUpdate();
    } catch (error) {
      alert("Erro ao salvar: " + formatSupabaseError(error));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    setProcessingId(id);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (error) {
      alert("Erro ao excluir: " + formatSupabaseError(error));
    } finally {
      setProcessingId(null);
    }
  };

  const handleQuickSettle = async (item: Transaction) => {
    setProcessingId(item.id);
    try {
      await FinancialService.updateTransaction(item.id, { status: 'PAID' });
      onUpdate();
    } catch (error) {
      alert("Erro ao liquidar: " + formatSupabaseError(error));
    } finally {
      setProcessingId(null);
    }
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const filteredItems = useMemo(() => {
    return transactions.filter(t => {
      const isCorrectType = viewMode === 'RECEIVABLES' ? t.type === 'INCOME' : (t.type === 'EXPENSE' || !t.type);
      const isMonth = (t.due_date || t.date).startsWith(monthFilter);
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesScope = scopeFilter === 'ALL' || t.scope === scopeFilter;
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      return isCorrectType && isMonth && matchesStatus && matchesScope && matchesSearch;
    }).sort((a,b) => new Date(a.due_date || a.date).getTime() - new Date(b.due_date || b.date).getTime());
  }, [transactions, viewMode, monthFilter, statusFilter, scopeFilter, searchTerm]);

  const stats = useMemo(() => {
    const active = filteredItems.filter(i => i.status !== 'PAID');
    return {
        total: active.reduce((acc, i) => acc + Number(i.amount), 0),
        count: active.length,
        overdue: active.filter(i => i.status === 'OVERDUE').reduce((acc, i) => acc + Number(i.amount), 0)
    };
  }, [filteredItems]);

  const handlePrevMonth = () => {
    const [year, month] = monthFilter.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    setMonthFilter(date.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = monthFilter.split('-').map(Number);
    const date = new Date(year, month, 1);
    setMonthFilter(date.toISOString().slice(0, 7));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 relative pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
             {viewMode === 'RECEIVABLES' ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-rose-500" />}
             {viewMode === 'RECEIVABLES' ? 'Contas a Receber' : 'Contas a Pagar'}
           </h2>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Fluxo Financeiro</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setFormData({
                description: '', amount: '', category_id: '', scope: 'BUSINESS', company_id: companies[0]?.id || '',
                date: new Date().toISOString().split('T')[0], due_date: new Date().toISOString().split('T')[0],
                is_recurring: false, status: 'PENDING', installment_current: '', installment_total: '',
                type: (viewMode === 'RECEIVABLES' ? 'INCOME' : 'EXPENSE') as TransactionType,
                contact_email: ''
              });
              setEditingId(null);
              setShowAddModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> Novo Lançamento
          </button>

          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft size={16} /></button>
              <div className="px-4 flex items-center gap-2 min-w-[150px] justify-center">
                  <Calendar size={14} className="text-indigo-500" />
                  <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">{new Date(monthFilter + '-01').toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}</span>
              </div>
              <button onClick={handleNextMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden ${viewMode === 'RECEIVABLES' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Total Pendente</p>
              <h3 className="text-3xl font-black mt-2">R$ {stats.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
              <p className="text-[10px] font-bold mt-2 bg-white/20 px-2 py-1 rounded-lg w-fit">{stats.count} itens em aberto</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atrasados (Competência)</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2">R$ {stats.overdue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
          </div>
          <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-xl flex items-center justify-center text-center">
              <div>
                <p className="text-[10px] font-black uppercase opacity-70 tracking-widest mb-1">Status de Fluxo</p>
                <p className="text-sm font-bold">{stats.overdue > 0 ? 'Atenção necessária em atrasos.' : 'Fluxo do mês em dia.'}</p>
              </div>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
         <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Listagem de Títulos</h3>
            <div className="flex gap-2">
               {['ALL', 'PENDING', 'PAID'].map(s => <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{s === 'ALL' ? 'Todos' : s === 'PAID' ? 'Baixados' : 'Abertos'}</button>)}
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-950/50">
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-4">Vencimento</th>
                        <th className="px-8 py-4">Descrição</th>
                        <th className="px-8 py-4">Categoria</th>
                        <th className="px-8 py-4 text-right">Valor</th>
                        <th className="px-8 py-4 text-center">Status</th>
                        <th className="px-8 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <td className="px-8 py-5 text-xs font-bold text-slate-500">{formatDateBR(item.due_date || item.date)}</td>
                            <td className="px-8 py-5">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{item.description}</p>
                                    {item.type === 'EXPENSE' && item.cost_type && (
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${item.cost_type === 'FIXED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                                            {item.cost_type === 'FIXED' ? 'Fixo' : 'Variável'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{item.scope === 'PERSONAL' ? 'Pessoal' : 'Corporativo'}</p>
                            </td>
                            <td className="px-8 py-5"><span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-black text-slate-500">{item.category}</span></td>
                            <td className={`px-8 py-5 text-right font-black ${viewMode === 'RECEIVABLES' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>R$ {Number(item.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            <td className="px-8 py-5 text-center">
                                {item.status === 'PAID' ? <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[9px] font-black uppercase">Liquidado</span> : <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${item.status === 'OVERDUE' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>{item.status === 'OVERDUE' ? 'Atrasado' : 'Pendente'}</span>}
                            </td>
                            <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.status !== 'PAID' && (
                                        <button onClick={() => handleQuickSettle(item)} className="p-2 rounded-xl text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Liquidar">
                                            <CheckCheck size={18} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => {
                                            setFormData({
                                                description: item.description,
                                                amount: item.amount.toString(),
                                                category_id: item.category_id || '',
                                                scope: item.scope || 'BUSINESS',
                                                company_id: item.company_id || '',
                                                date: item.date,
                                                due_date: item.due_date || item.date,
                                                is_recurring: item.is_recurring || false,
                                                status: item.status,
                                                installment_current: item.installment_current?.toString() || '',
                                                installment_total: item.installment_total?.toString() || '',
                                                type: item.type,
                                                contact_email: item.contact_email || ''
                                            });
                                            setEditingId(item.id);
                                            setShowAddModal(true);
                                        }} 
                                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" 
                                        title="Editar"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (!item.contact_email) {
                                                alert("Por favor, cadastre um e-mail para este lançamento.");
                                                return;
                                            }
                                            const subject = encodeURIComponent(`Lembrete de Pagamento: ${item.description}`);
                                            const body = encodeURIComponent(`Olá,\n\nGostaríamos de lembrar sobre o pagamento de R$ ${item.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})} referente a ${item.description}, com vencimento em ${new Date(item.due_date || item.date).toLocaleDateString('pt-BR')}.\n\nAtenciosamente,\nEquipe Financeira`);
                                            window.open(`mailto:${item.contact_email}?subject=${subject}&body=${body}`);
                                        }}
                                        className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        title="Enviar Cobrança"
                                    >
                                        <Bell size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" title="Excluir">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500">
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-2xl flex items-center justify-center">
                {editingId ? <Edit size={24} /> : <Plus size={24} />}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">
                  {editingId ? 'Editar Lançamento' : `Novo ${viewMode === 'RECEIVABLES' ? 'Recebimento' : 'Pagamento'}`}
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Preencha os detalhes financeiros</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Lançamento</label>
                <div className="flex gap-2 mt-1 mb-2">
                  <button type="button" onClick={() => setFormData({...formData, type: 'INCOME'})} className={`flex-1 p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${formData.type === 'INCOME' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><TrendingUp size={14} /> Receber</button>
                  <button type="button" onClick={() => setFormData({...formData, type: 'EXPENSE'})} className={`flex-1 p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${formData.type === 'EXPENSE' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><TrendingDown size={14} /> Pagar</button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Escopo</label>
                <div className="flex gap-2 mt-1 mb-2">
                  <button type="button" onClick={() => setFormData({...formData, scope: 'PERSONAL'})} className={`flex-1 p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${formData.scope === 'PERSONAL' ? 'bg-teal-500 text-white border-teal-500 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><User size={14} /> Pessoal</button>
                  <button type="button" onClick={() => setFormData({...formData, scope: 'BUSINESS'})} className={`flex-1 p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${formData.scope === 'BUSINESS' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><Building2 size={14} /> Empresa</button>
                </div>
                {formData.scope === 'BUSINESS' && (
                  <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})} required>
                    <option value="">Selecione a Empresa</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail para Alertas/Cobrança</label>
                <input type="email" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.contact_email} onChange={e => setFormData({...formData, contact_email: e.target.value})} placeholder="exemplo@email.com" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                  <input type="number" step="0.01" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} required>
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} required />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} className="text-indigo-500" /> Recorrente?
                  </label>
                  <button type="button" onClick={() => setFormData({...formData, is_recurring: !formData.is_recurring})} className={`w-10 h-6 rounded-full transition-all relative ${formData.is_recurring ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_recurring ? 'left-5' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CreditCard size={14} className="text-emerald-500" /> Parcelas
                  </label>
                  <input type="number" min="1" className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-black text-center text-slate-800 dark:text-white outline-none" value={formData.installment_total || 1} onChange={e => setFormData({...formData, installment_total: e.target.value})} />
                </div>
              </div>

              <button type="submit" disabled={!!processingId} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {processingId === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceivablesManager;
