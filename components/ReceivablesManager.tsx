
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

type PeriodFilter = 'ALL' | '7_DAYS' | '15_DAYS' | 'THIS_MONTH' | 'OVERDUE';
type StatusFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'; 

const ReceivablesManager: React.FC<ReceivablesManagerProps> = ({ defaultMode, transactions, categories, companies, t, onUpdate, onAdd }) => {
  const [viewMode, setViewMode] = useState<'RECEIVABLES' | 'PAYABLES'>(defaultMode);
  
  useEffect(() => {
    setViewMode(defaultMode);
  }, [defaultMode]);

  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'BUSINESS' | 'PERSONAL'>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  
  // Defaulting to CURRENT MONTH as requested for quick view
  const [monthFilter, setMonthFilter] = useState<string>(new Date().toISOString().slice(0, 7)); 
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false); 
  
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category_id: '',
    scope: 'BUSINESS' as TransactionScope,
    company_id: '',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    is_recurring: false,
    status: 'PENDING' as 'PENDING' | 'PAID' | 'OVERDUE',
    installment_current: '',
    installment_total: ''
  });

  const [paymentData, setPaymentData] = useState({
    id: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    is_recurring: false,
    original_due_date: ''
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpenId && !(event.target as Element).closest('.action-menu')) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  // Month Navigation Logic
  const handlePrevMonth = () => {
      if (!monthFilter) {
          setMonthFilter(new Date().toISOString().slice(0, 7));
          return;
      }
      const [year, month] = monthFilter.split('-').map(Number);
      const date = new Date(year, month - 2, 1);
      setMonthFilter(date.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
      if (!monthFilter) {
          setMonthFilter(new Date().toISOString().slice(0, 7));
          return;
      }
      const [year, month] = monthFilter.split('-').map(Number);
      const date = new Date(year, month, 1);
      setMonthFilter(date.toISOString().slice(0, 7));
  };

  const formatMonthDisplay = (isoMonth: string) => {
      if (!isoMonth) return "Todos os Períodos";
      const [year, month] = isoMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      // Capitalize first letter
      const str = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // 1. DATA PROCESSING (List Filter)
  const baseItems = useMemo(() => {
    return transactions.filter(t => {
      if (viewMode === 'RECEIVABLES') {
        return t.type === 'INCOME';
      } else {
        return t.type === 'EXPENSE' || !t.type;
      }
    });
  }, [transactions, viewMode]);

  // 2. FILTERING (List Filter)
  const filteredItems = useMemo(() => {
    let data = [...baseItems];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter(t => {
         const entityName = t.company_id 
            ? companies.find(c => c.id === t.company_id)?.name.toLowerCase() 
            : '';
         
         return t.description.toLowerCase().includes(lowerSearch) || 
                t.category.toLowerCase().includes(lowerSearch) ||
                (entityName && entityName.includes(lowerSearch));
      });
    }

    if (scopeFilter !== 'ALL') {
      data = data.filter(t => (t.scope || 'BUSINESS') === scopeFilter);
    }

    if (companyFilter !== 'ALL') {
       data = data.filter(t => t.company_id === companyFilter);
    }

    if (categoryFilter !== 'ALL') data = data.filter(t => t.category === categoryFilter);
    if (statusFilter !== 'ALL') data = data.filter(t => t.status === statusFilter);

    if (monthFilter) {
        data = data.filter(t => {
            const itemDateStr = (t.due_date || t.date).substring(0, 7);
            return itemDateStr === monthFilter;
        });
    }

    return data.sort((a, b) => new Date(a.due_date || a.date).getTime() - new Date(b.due_date || b.date).getTime());
  }, [baseItems, searchTerm, scopeFilter, categoryFilter, statusFilter, companyFilter, monthFilter, companies]);

  // 3. GROUPING ENGINE
  const groupedData = useMemo(() => {
      const groups: { id: string; title: string; type: 'BUSINESS' | 'PERSONAL'; items: Transaction[]; total: number; pendingCount: number }[] = [];

      // A. Process Companies
      companies.forEach(comp => {
          const items = filteredItems.filter(t => t.scope === 'BUSINESS' && t.company_id === comp.id);
          if (items.length > 0) {
              groups.push({
                  id: comp.id,
                  title: comp.name,
                  type: 'BUSINESS',
                  items: items,
                  total: items.reduce((acc, t) => acc + Number(t.amount), 0),
                  pendingCount: items.filter(t => t.status !== 'PAID').length
              });
          }
      });

      // B. Process Personal
      const personalItems = filteredItems.filter(t => t.scope === 'PERSONAL');
      if (personalItems.length > 0) {
          groups.push({
              id: 'PERSONAL',
              title: 'Carteira Pessoal',
              type: 'PERSONAL',
              items: personalItems,
              total: personalItems.reduce((acc, t) => acc + Number(t.amount), 0),
              pendingCount: personalItems.filter(t => t.status !== 'PAID').length
          });
      }

      // C. Catch-all for Business items without specific company ID
      const legacyItems = filteredItems.filter(t => t.scope === 'BUSINESS' && !t.company_id);
      if (legacyItems.length > 0) {
           groups.push({
              id: 'LEGACY',
              title: 'Outros / Sem Empresa',
              type: 'BUSINESS',
              items: legacyItems,
              total: legacyItems.reduce((acc, t) => acc + Number(t.amount), 0),
              pendingCount: legacyItems.filter(t => t.status !== 'PAID').length
          });
      }

      return groups;
  }, [filteredItems, companies]);

  // 4. GENERAL STATISTICS (Current View Mode)
  const stats = useMemo(() => {
    const openItems = filteredItems.filter(r => r.status === 'PENDING' || r.status === 'OVERDUE');

    const total = openItems.reduce((acc, r) => acc + Number(r.amount), 0);
    const overdueItems = filteredItems.filter(r => r.status === 'OVERDUE');
    const overdueVal = overdueItems.reduce((acc, r) => acc + Number(r.amount), 0);
    
    const businessTotal = openItems.filter(r => (r.scope || 'BUSINESS') === 'BUSINESS').reduce((acc, r) => acc + Number(r.amount), 0);
    const personalTotal = openItems.filter(r => r.scope === 'PERSONAL').reduce((acc, r) => acc + Number(r.amount), 0);

    return {
      total,
      overdueVal,
      overdueCount: overdueItems.length,
      businessTotal,
      personalTotal
    };
  }, [filteredItems]);

  // 5. PERSONAL WALLET STATISTICS (Separate Calculation for Wallet View)
  const personalWalletStats = useMemo(() => {
      // Filters ALL transactions (Receivables AND Payables) for the selected month and Personal Scope
      const personalTxns = transactions.filter(t => {
          const isPersonal = t.scope === 'PERSONAL';
          const isMonth = (t.due_date || t.date).startsWith(monthFilter);
          return isPersonal && isMonth;
      });

      const income = personalTxns.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + Number(t.amount), 0);
      const expense = personalTxns.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + Number(t.amount), 0);
      const balance = income - expense;

      const pendingIncome = personalTxns.filter(t => t.type === 'INCOME' && t.status !== 'PAID').reduce((acc, t) => acc + Number(t.amount), 0);
      const pendingExpense = personalTxns.filter(t => t.type === 'EXPENSE' && t.status !== 'PAID').reduce((acc, t) => acc + Number(t.amount), 0);

      return { income, expense, balance, pendingIncome, pendingExpense };
  }, [transactions, monthFilter]);

  // --- NOTIFICATION LOGIC ---
  useEffect(() => {
    const generateNotifications = () => {
      const alerts: Notification[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter for active (unpaid) items within current view scope
      const activeItems = baseItems.filter(t => t.status !== 'PAID');

      activeItems.forEach(r => {
        // Robust Date Parsing (Treat as local YYYY-MM-DD)
        const [y, m, d] = (r.due_date || r.date).split('-').map(Number);
        const due = new Date(y, m - 1, d);
        
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          alerts.push({
            id: r.id,
            type: 'CRITICAL',
            title: viewMode === 'RECEIVABLES' ? 'Atraso Detectado' : 'Conta Vencida',
            message: `${r.description} venceu há ${Math.abs(diffDays)} dias.`,
            days: diffDays
          });
        } else if (diffDays >= 0 && diffDays <= 3) {
          alerts.push({
            id: r.id,
            type: 'WARNING',
            title: viewMode === 'RECEIVABLES' ? 'Recebimento Próximo' : 'Vencimento Próximo',
            message: `${r.description} vence ${diffDays === 0 ? 'hoje' : diffDays === 1 ? 'amanhã' : `em ${diffDays} dias`}.`,
            days: diffDays
          });
        }
      });

      // Sort by urgency: Overdue (negative) first, then upcoming (small positive)
      const sorted = alerts.sort((a, b) => a.days - b.days).slice(0, 5);
      setNotifications(sorted);
    };

    if (baseItems.length > 0) {
      generateNotifications();
    } else {
      setNotifications([]);
    }
  }, [baseItems, viewMode]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getRelativeTime = (dateStr: string, status: string) => {
    if (status === 'PAID') return { text: 'Pago / Recebido', color: 'text-emerald-500' };

    const [y, m, d] = dateStr.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d atrasado`, color: 'text-rose-500' };
    if (diffDays === 0) return { text: 'Vence Hoje', color: 'text-amber-500' };
    if (diffDays === 1) return { text: 'Amanhã', color: 'text-indigo-500' };
    return { text: `em ${diffDays} dias`, color: 'text-slate-400 dark:text-slate-500' };
  };

  const openEditModal = (t: Transaction, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(t.id);
    
    setFormData({
      description: t.description,
      amount: String(t.amount),
      category_id: t.category_id || '',
      scope: t.scope || 'BUSINESS',
      company_id: t.company_id,
      date: t.date,
      due_date: t.due_date || t.date,
      is_recurring: !!t.is_recurring,
      status: t.status || 'PENDING',
      installment_current: t.installment_current ? String(t.installment_current) : '',
      installment_total: t.installment_total ? String(t.installment_total) : ''
    });
    setMenuOpenId(null);
    setShowAddModal(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    try {
      let finalScope: TransactionScope = formData.scope;
      let finalCompanyId = formData.company_id;
      
      if (finalScope === 'BUSINESS' && !finalCompanyId && companies.length > 0) {
         finalCompanyId = companies[0].id;
      }

      const payload: any = {
          description: formData.description,
          amount: parseFloat(formData.amount),
          category_id: formData.category_id || null, 
          scope: finalScope,
          company_id: finalCompanyId,
          date: formData.date,
          due_date: formData.due_date,
          is_recurring: formData.is_recurring,
          status: formData.status,
          installment_current: formData.installment_current ? parseInt(formData.installment_current) : null,
          installment_total: formData.installment_total ? parseInt(formData.installment_total) : null
      };

      if (editingId) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editingId);
        if (error) throw error;
        onUpdate();
        alert("Registro atualizado com sucesso.");
      } else {
        onAdd({
          ...payload,
          type: viewMode === 'RECEIVABLES' ? 'INCOME' : 'EXPENSE',
          status: 'PENDING',
        });
      }

      setShowAddModal(false);
      setEditingId(null);
      setFormData({ ...formData, description: '', amount: '' });
    } catch (e: any) {
      alert("Erro ao salvar: " + formatSupabaseError(e));
    }
  };

  const initPaymentConfirmation = (t: Transaction, e?: React.MouseEvent) => {
     if (e) e.stopPropagation();
     setMenuOpenId(null);
     setPaymentData({
        id: t.id,
        description: t.description,
        amount: t.amount !== undefined ? String(t.amount) : '0',
        date: new Date().toISOString().split('T')[0], 
        is_recurring: !!t.is_recurring,
        original_due_date: t.due_date || t.date
     });
     setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.id) return;

    let finalAmount = parseFloat(paymentData.amount.toString().replace(',', '.'));
    if (isNaN(finalAmount)) return alert("Valor inválido");

    setProcessingId(paymentData.id);

    try {
      const { data: updatedData, error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'PAID', amount: finalAmount, date: paymentData.date })
        .eq('id', paymentData.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // RECURRENCE LOGIC
      if (paymentData.is_recurring && updatedData) {
        // Robust Date Calculation (Safe Month Addition)
        const parts = (paymentData.original_due_date || paymentData.date).split('T')[0].split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
        const day = parseInt(parts[2]);
        
        const nextDateObj = new Date(year, month + 1, day);
        // Overflow check (e.g. Jan 31 -> Feb 28)
        if (nextDateObj.getDate() !== day) {
            nextDateObj.setDate(0); 
        }
        const nextDateStr = nextDateObj.toISOString().split('T')[0];

        const { id, created_at, installment_current, installment_total, ...baseData } = updatedData;
        
        let nextInstallmentCurrent = installment_current;
        let shouldGenerate = false;

        // Check installments cap
        if (installment_total) {
             if (installment_current && installment_current < installment_total) {
                 nextInstallmentCurrent = installment_current + 1;
                 shouldGenerate = true;
             }
        } else {
             // Infinite recurrence
             shouldGenerate = true;
        }

        if (shouldGenerate) {
             const nextPayload = {
                ...baseData,
                status: 'PENDING',
                date: nextDateStr,
                due_date: nextDateStr,
                installment_current: nextInstallmentCurrent
            };
            await supabase.from('transactions').insert([nextPayload]);
        }
      }

      // UX: Remove notification immediately to update UI without waiting for fetch
      removeNotification(paymentData.id);

      alert(`${viewMode === 'RECEIVABLES' ? 'Recebimento' : 'Pagamento'} confirmado com sucesso!`);
      setShowPaymentModal(false);
      onUpdate();

    } catch (e: any) {
        alert("Erro ao confirmar: " + formatSupabaseError(e));
    } finally {
        setProcessingId(null);
    }
  };

  const handleManualRecurrence = async (t: Transaction, e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpenId(null);

      const baseDate = new Date(t.due_date || t.date);
      // Logic to add 1 month safely
      const nextDate = new Date(baseDate);
      nextDate.setMonth(baseDate.getMonth() + 1);
      
      // Check for day overflow (e.g. Jan 31 -> Mar 2)
      if (nextDate.getDate() !== baseDate.getDate()) {
          nextDate.setDate(0); 
      }
      
      const dateStr = nextDate.toISOString().split('T')[0];

      if (!confirm(`Confirmar geração manual de recorrência para ${new Date(dateStr).toLocaleDateString('pt-BR')}?`)) return;

      setProcessingId(`REC_${t.id}`);
      try {
          const { id, created_at, ...baseData } = t;
          const payload = {
              ...baseData,
              status: 'PENDING',
              date: dateStr,
              due_date: dateStr,
              description: t.description, // Keep description clean
              is_recurring: true
          };

          const { error } = await supabase.from('transactions').insert([payload]);
          if (error) throw error;

          onUpdate();
          alert("Próximo lançamento gerado com sucesso!");
      } catch (e: any) {
          alert("Erro: " + formatSupabaseError(e));
      } finally {
          setProcessingId(null);
      }
  };

  const handleBulkSettle = async (group: any) => {
      const pendingItems = group.items.filter((t: Transaction) => t.status !== 'PAID');
      
      if (pendingItems.length === 0) return alert("Não há itens pendentes para quitar neste grupo.");

      const totalPending = pendingItems.reduce((acc: number, t: Transaction) => acc + Number(t.amount), 0);
      
      const confirmMsg = `Deseja quitar TODAS as ${pendingItems.length} pendências de ${group.title}?\n\nValor Total: R$ ${totalPending.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n\nIsso marcará todos como PAGO na data de hoje.`;
      
      if (!confirm(confirmMsg)) return;

      const bulkId = `BULK_${group.id}`;
      setProcessingId(bulkId);

      try {
          const ids = pendingItems.map((t: Transaction) => t.id);
          
          const { error } = await supabase
              .from('transactions')
              .update({ 
                  status: 'PAID', 
                  date: new Date().toISOString().split('T')[0]
              })
              .in('id', ids);

          if (error) throw error;

          await onUpdate();
          alert(`Sucesso! ${pendingItems.length} transações foram quitadas.`);

      } catch (e: any) {
          alert("Erro na quitação em lote: " + formatSupabaseError(e));
      } finally {
          setProcessingId(null);
      }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setMenuOpenId(null);
    
    // Give UI a moment to close menu before alert blocks thread
    setTimeout(async () => {
        if (!confirm("Tem certeza que deseja excluir este registro permanentemente?")) return;
        try {
          await FinancialService.deleteTransaction(id);
          onUpdate();
        } catch (e: any) {
          alert("Erro ao excluir: " + formatSupabaseError(e));
        }
    }, 50);
  };

  const toggleMenu = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpenId(menuOpenId === id ? null : id);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 relative pb-20">
      
      {/* CONFIRM PAYMENT/RECEIPT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
             <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                <div className="mb-6 text-center">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg ${viewMode === 'RECEIVABLES' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-400'}`}>
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">Confirmar {viewMode === 'RECEIVABLES' ? 'Recebimento' : 'Pagamento'}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1 line-clamp-1">{paymentData.description}</p>
                </div>
                <form onSubmit={handleConfirmPayment} className="space-y-4">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Efetiva</label><input required type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} /></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Final</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span><input required type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} /></div></div>
                    <button type="submit" disabled={!!processingId} className={`w-full text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 mt-2 ${viewMode === 'RECEIVABLES' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>{processingId ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Confirmar</button>
                </form>
             </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors"><X size={20} /></button>
            <div className="mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${viewMode === 'RECEIVABLES' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900 dark:text-rose-400'}`}><FileText size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white">{editingId ? 'Editar Título' : viewMode === 'RECEIVABLES' ? 'Novo Recebível' : 'Nova Conta a Pagar'}</h3>
            </div>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Classificação (Entidade)</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                     <button type="button" onClick={() => setFormData({...formData, scope: 'PERSONAL', company_id: ''})} className={`p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 ${formData.scope === 'PERSONAL' ? 'bg-teal-500 text-white border-teal-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><User size={14} /> Pessoal (PF)</button>
                     {companies.map(c => (<button key={c.id} type="button" onClick={() => setFormData({...formData, scope: 'BUSINESS', company_id: c.id})} className={`p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 ${formData.company_id === c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}><Building2 size={14} /> {c.name.substring(0, 15)}</button>))}
                  </div>
               </div>
               <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label><input required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
               <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label><input required type="number" step="0.01" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Reg.</label><input required type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento</label><input required type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /></div>
               </div>
               <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label><select required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}><option value="">Selecione...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
               <div className="flex items-center gap-3 py-2"><input type="checkbox" id="rec_check" checked={formData.is_recurring} onChange={e => setFormData({...formData, is_recurring: e.target.checked})} className="w-5 h-5 rounded-md text-indigo-600" /><label htmlFor="rec_check" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Pagamento Recorrente?</label></div>
               <button type="submit" className={`w-full text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'RECEIVABLES' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}><Save size={16} /> {editingId ? 'Salvar Alterações' : 'Criar Registro'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Overlay */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {notifications.map(n => {
          const t = transactions.find(i => i.id === n.id);
          return (
          <div key={n.id} className={`pointer-events-auto shadow-2xl rounded-2xl p-4 border backdrop-blur-md animate-in slide-in-from-right duration-500 flex flex-col gap-2 ${n.type === 'CRITICAL' ? 'bg-rose-900/95 border-rose-500/30 text-white' : 'bg-amber-900/95 border-amber-500/30 text-white'}`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${n.type === 'CRITICAL' ? 'bg-rose-500/20' : 'bg-amber-500/20'}`}>{n.type === 'CRITICAL' ? <AlertTriangle size={18} /> : <Bell size={18} />}</div>
                <div className="flex-1"><h5 className="text-xs font-black uppercase tracking-widest mb-1">{n.title}</h5><p className="text-xs font-medium opacity-90 leading-relaxed">{n.message}</p></div>
                <button onClick={() => removeNotification(n.id)} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X size={14} /></button>
            </div>
            {t && (<div className="flex items-center gap-2 mt-1 pt-2 border-t border-white/10"><button onClick={(e) => { e.stopPropagation(); initPaymentConfirmation(t); }} className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all pointer-events-auto"><CheckCircle2 size={14} /> Baixar</button></div>)}
          </div>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
             {viewMode === 'RECEIVABLES' ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-rose-500" />}
             {viewMode === 'RECEIVABLES' ? 'Contas a Receber' : 'Contas a Pagar'}
           </h2>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Fluxo Financeiro</p>
        </div>
        
        {/* Month Selector in Header */}
        <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg text-slate-500 dark:text-slate-400 transition-all"><ChevronLeft size={16} /></button>
            <div className="flex items-center gap-2 px-4 min-w-[140px] justify-center">
               <Calendar size={14} className="text-indigo-500" />
               <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
                  {formatMonthDisplay(monthFilter)}
               </span>
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg text-slate-500 dark:text-slate-400 transition-all"><ChevronRight size={16} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
             <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
                <button onClick={() => setScopeFilter('ALL')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scopeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}>Tudo</button>
                <button onClick={() => setScopeFilter('BUSINESS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${scopeFilter === 'BUSINESS' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>PJ</button>
                <button onClick={() => setScopeFilter('PERSONAL')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${scopeFilter === 'PERSONAL' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400'}`}>PF</button>
             </div>
             
             {/* Sub Toggle only for Standard View */}
             {scopeFilter !== 'PERSONAL' && (
                 <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center ml-2">
                    <button onClick={() => setViewMode('RECEIVABLES')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'RECEIVABLES' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-emerald-600'}`}>Receber</button>
                    <button onClick={() => setViewMode('PAYABLES')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'PAYABLES' ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-sm' : 'text-slate-400 hover:text-rose-600'}`}>Pagar</button>
                 </div>
             )}

             <button onClick={() => { setEditingId(null); setShowAddModal(true); }} className="bg-slate-900 dark:bg-white hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-slate-900 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg"><Plus size={16} /> Novo</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {scopeFilter === 'PERSONAL' ? (
              // --- PERSONAL WALLET VIEW DASHBOARD ---
              <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                  <div className="bg-teal-500 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between h-32">
                      <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={64} /></div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Saldo Pessoal (Mês)</p>
                      <h3 className="text-3xl font-black tracking-tight mt-1">R$ {personalWalletStats.balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                      <p className="text-[10px] font-bold opacity-70 mt-1">Fluxo de Caixa (PF)</p>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-all">
                      <div className="absolute -right-4 -top-4 text-emerald-50 dark:text-emerald-900/10 opacity-50 group-hover:scale-110 transition-transform"><TrendingUp size={100} /></div>
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Receber</p>
                          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">R$ {personalWalletStats.income.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg">Pendente: R$ {personalWalletStats.pendingIncome.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-all">
                      <div className="absolute -right-4 -top-4 text-rose-50 dark:text-rose-900/10 opacity-50 group-hover:scale-110 transition-transform"><TrendingDown size={100} /></div>
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar</p>
                          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">R$ {personalWalletStats.expense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-lg">Pendente: R$ {personalWalletStats.pendingExpense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                      </div>
                  </div>
              </div>
          ) : (
              // --- STANDARD BUSINESS/ALL DASHBOARD ---
              <>
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
                        <div className={`absolute top-0 right-0 p-4 opacity-10 ${viewMode === 'RECEIVABLES' ? 'text-emerald-600' : 'text-rose-600'}`}>{viewMode === 'RECEIVABLES' ? <TrendingUp size={48} /> : <TrendingDown size={48} />}</div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total {formatMonthDisplay(monthFilter)}</p>
                        <h3 className={`text-2xl font-black ${viewMode === 'RECEIVABLES' ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                        <div className="flex gap-2 mt-2"><span className="text-[9px] font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg">PJ: {stats.total > 0 ? ((stats.businessTotal/stats.total || 0)*100).toFixed(0) : 0}%</span><span className="text-[9px] font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg">PF: {stats.total > 0 ? ((stats.personalTotal/stats.total || 0)*100).toFixed(0) : 0}%</span></div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vencidos Nesta Visão</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">R$ {stats.overdueVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                        <p className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-lg w-fit mt-2">{stats.overdueCount} títulos atrasados</p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-slate-400 mb-1"><Filter size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Filtros Rápidos</span></div>
                        <div className="relative w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por descrição ou entidade..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold p-2 pl-9 rounded-xl outline-none text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500/20" /></div>
                    </div>
                </div>
                
                <div className="md:col-span-1 bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl flex flex-col justify-center items-center text-center animate-in fade-in">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3"><Landmark size={24} className="text-white" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Previsão de Caixa</p>
                    <p className="text-sm font-medium mt-2">O fluxo {viewMode === 'RECEIVABLES' ? 'de entrada' : 'de saída'} está {stats.overdueCount > 0 ? 'comprometido por atrasos.' : 'saudável.'}</p>
                </div>
              </>
          )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden min-h-[400px]">
         <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                Listagem de Títulos ({filteredItems.length})
                {monthFilter && <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded text-[9px]">Competência: {monthFilter}</span>}
                {scopeFilter === 'PERSONAL' && (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg ml-2">
                        <button onClick={() => setViewMode('RECEIVABLES')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${viewMode === 'RECEIVABLES' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Receber</button>
                        <button onClick={() => setViewMode('PAYABLES')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${viewMode === 'PAYABLES' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}>Pagar</button>
                    </div>
                )}
            </h3>
            <div className="flex gap-2">
               {['ALL', 'PENDING', 'OVERDUE', 'PAID'].map(s => (<button key={s} onClick={() => setStatusFilter(s as any)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${statusFilter === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Abertos' : s === 'OVERDUE' ? 'Atrasados' : 'Baixados'}</button>))}
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full">
               <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                  <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                     <th className="px-6 py-4">Descrição / Entidade</th>
                     <th className="px-6 py-4">Vencimento</th>
                     <th className="px-6 py-4">Categoria</th>
                     <th className="px-6 py-4 text-right">Valor</th>
                     <th className="px-6 py-4 text-center">Status</th>
                     <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredItems.length === 0 ? (
                     <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Nenhum registro encontrado para este período.</td></tr>
                  ) : (
                     groupedData.map(group => (
                        <React.Fragment key={group.id}>
                           <tr className={`${group.type === 'PERSONAL' ? 'bg-teal-50/50 dark:bg-teal-900/10 border-l-4 border-l-teal-500' : 'bg-indigo-50/50 dark:bg-indigo-900/10 border-l-4 border-l-indigo-500'} border-y border-slate-200 dark:border-slate-700`}>
                              <td colSpan={6} className="px-6 py-3">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                       <div className={`p-1.5 rounded-lg ${group.type === 'PERSONAL' ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'}`}>
                                          {group.type === 'PERSONAL' ? <User size={14} /> : <Building2 size={14} />}
                                       </div>
                                       <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{group.title}</span>
                                       <span className="text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{group.items.length} itens</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {group.pendingCount > 0 && (
                                            <button 
                                                onClick={() => handleBulkSettle(group)}
                                                disabled={processingId === `BULK_${group.id}`}
                                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide flex items-center gap-2 shadow-sm hover:shadow transition-all disabled:opacity-50"
                                            >
                                                {processingId === `BULK_${group.id}` ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                                                Quitar {group.pendingCount} Pendências
                                            </button>
                                        )}
                                        <div className="text-right"><span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Subtotal</span><span className={`text-xs font-black ${viewMode === 'RECEIVABLES' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-white'}`}>R$ {group.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                    </div>
                                 </div>
                              </td>
                           </tr>
                           {group.items.map(item => {
                               const isOverdue = item.status === 'OVERDUE';
                               const dueObj = new Date(item.due_date || item.date);
                               dueObj.setHours(0,0,0,0);
                               const todayObj = new Date();
                               todayObj.setHours(0,0,0,0);
                               const diffT = dueObj.getTime() - todayObj.getTime();
                               const dDays = Math.ceil(diffT / (1000 * 60 * 60 * 24));
                               const isNearDue = item.status !== 'PAID' && dDays >= 0 && dDays <= 3;

                               const timeInfo = getRelativeTime(item.due_date || item.date, item.status);
                               const category = categories.find(c => c.id === item.category_id || c.name === item.category);

                               return (
                                  <tr key={item.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                                      isOverdue ? 'border-l-4 border-l-rose-500 bg-rose-50/20' : 
                                      isNearDue ? 'border-l-4 border-l-amber-400 bg-amber-50/40' : ''
                                  }`}>
                                     <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${item.scope === 'PERSONAL' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                              {(item.scope || 'B').charAt(0)}
                                           </div>
                                           <div>
                                              <p className={`text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2 ${isNearDue ? 'font-black' : 'font-black'}`}>
                                                 {isOverdue && <AlertTriangle size={14} className="text-rose-500" />}
                                                 {isNearDue && !isOverdue && <Clock size={14} className="text-amber-500" />}
                                                 {item.description}
                                                 {item.is_recurring && (
                                                    <span title="Transação Recorrente" className="text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 p-1 rounded-full">
                                                        <Repeat size={10} />
                                                    </span>
                                                 )}
                                              </p>
                                              <div className="flex items-center gap-2 mt-1">
                                                 {item.installment_total && (
                                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold">
                                                       {item.installment_current}/{item.installment_total}
                                                    </span>
                                                 )}
                                              </div>
                                           </div>
                                        </div>
                                     </td>
                                     <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                           <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(item.due_date || item.date).toLocaleDateString('pt-BR')}</span>
                                           <span className={`text-[9px] font-black uppercase ${timeInfo.color}`}>{timeInfo.text}</span>
                                        </div>
                                     </td>
                                     <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ backgroundColor: (category?.color || '#cbd5e1') + '20', color: category?.color || '#64748b' }}>
                                           {category?.name || item.category}
                                        </span>
                                     </td>
                                     <td className={`px-6 py-4 text-right font-black text-sm ${viewMode === 'RECEIVABLES' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                        R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                     </td>
                                     <td className="px-6 py-4 text-center">
                                        {item.status === 'PAID' ? (
                                           <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] font-black uppercase">
                                              <CheckCircle2 size={10} /> Baixado
                                           </span>
                                        ) : isOverdue ? (
                                           <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[9px] font-black uppercase">
                                              <AlertCircle size={10} /> Atrasado
                                           </span>
                                        ) : (
                                           <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] font-black uppercase">
                                              <Clock size={10} /> Pendente
                                           </span>
                                        )}
                                     </td>
                                     <td className="px-6 py-4 text-center relative">
                                        <div className="flex items-center justify-center gap-1">
                                           {item.status !== 'PAID' && (
                                              <button 
                                                onClick={(e) => initPaymentConfirmation(item, e)}
                                                className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                                title={viewMode === 'RECEIVABLES' ? "Receber" : "Pagar"}
                                              >
                                                 <CheckCircle2 size={16} />
                                              </button>
                                           )}
                                           <button 
                                             onClick={(e) => toggleMenu(item.id, e)}
                                             className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative"
                                           >
                                              <MoreVertical size={16} />
                                           </button>
                                           
                                           {menuOpenId === item.id && (
                                              <div className="absolute right-8 top-0 z-20 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 action-menu overflow-hidden animate-in zoom-in-95 origin-top-right">
                                                 <button onClick={(e) => openEditModal(item, e)} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-600 dark:text-slate-300 transition-colors">
                                                    <Edit size={14} /> Editar
                                                 </button>
                                                 
                                                 {item.status !== 'PAID' && (
                                                     <button onClick={(e) => initPaymentConfirmation(item, e)} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-400 transition-colors">
                                                        <CheckCircle2 size={14} /> {viewMode === 'RECEIVABLES' ? 'Marcar Recebido' : 'Marcar Pago'}
                                                     </button>
                                                 )}

                                                 <button onClick={(e) => handleManualRecurrence(item, e)} disabled={processingId === `REC_${item.id}`} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 transition-colors">
                                                    {processingId === `REC_${item.id}` ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} 
                                                    Gerar Recorrência
                                                 </button>

                                                 <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                                                 
                                                 <button onClick={(e) => handleDelete(item.id, e)} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-3 text-rose-500 dark:text-rose-400 transition-colors">
                                                    <Trash2 size={14} /> Excluir
                                                 </button>
                                              </div>
                                           )}
                                        </div>
                                     </td>
                                  </tr>
                               );
                           })}
                        </React.Fragment>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default ReceivablesManager;
