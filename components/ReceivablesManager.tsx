
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Landmark, AlertCircle, Clock, CheckCircle2, 
  RotateCcw, FileText, Calendar, MoreVertical, X, AlertTriangle, Filter, Plus, Save, Loader2,
  Edit, Trash2, Copy, TrendingUp, TrendingDown, Briefcase, User, Box, CreditCard, Building2, CalendarDays, ArrowRightCircle, Search, CheckCheck,
  ChevronLeft, ChevronRight, Wallet, PieChart, Repeat, Bell
} from 'lucide-react';
import { Transaction, Category, TransactionScope, Company } from '../types';
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
    is_recurring: false, status: 'PENDING' as any, installment_current: '', installment_total: ''
  });

  const [paymentData, setPaymentData] = useState({ id: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], is_recurring: false, original_due_date: '' });

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
        
        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft size={16} /></button>
            <div className="px-4 flex items-center gap-2 min-w-[150px] justify-center">
                <Calendar size={14} className="text-indigo-500" />
                <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">{new Date(monthFilter + '-01').toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}</span>
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"><ChevronRight size={16} /></button>
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
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-8 py-5 text-xs font-bold text-slate-500">{formatDateBR(item.due_date || item.date)}</td>
                            <td className="px-8 py-5">
                                <p className="text-sm font-black text-slate-800 dark:text-white">{item.description}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{item.scope === 'PERSONAL' ? 'Pessoal' : 'Corporativo'}</p>
                            </td>
                            <td className="px-8 py-5"><span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-black text-slate-500">{item.category}</span></td>
                            <td className={`px-8 py-5 text-right font-black ${viewMode === 'RECEIVABLES' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>R$ {Number(item.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            <td className="px-8 py-5 text-center">
                                {item.status === 'PAID' ? <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[9px] font-black uppercase">Liquidado</span> : <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${item.status === 'OVERDUE' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>{item.status === 'OVERDUE' ? 'Atrasado' : 'Pendente'}</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default ReceivablesManager;
