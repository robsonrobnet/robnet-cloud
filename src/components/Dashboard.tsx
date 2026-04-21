
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Tag, PieChart as PieChartIcon, 
  Sparkles, CalendarDays, Activity, Building2, User, CreditCard, Calendar,
  Wallet, Landmark, Receipt, Percent, AlertTriangle, FileText, CheckCircle2, Clock, ArrowUpCircle, ArrowDownCircle,
  Zap, Brain, Target, ShieldCheck, Plus, X, Bell
} from 'lucide-react';
import { Transaction, FinancialSummary, Category, TransactionScope, Company } from '../types';
import { FinancialService } from '../services/financialService';

interface DashboardProps {
  transactions: Transaction[];
  currentMonth: Date;
  categories: Category[];
  companies: Company[];
  onAdd: (t: any) => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
  t: any;
}

type DashboardTab = 'ALL' | 'BUSINESS' | 'PERSONAL';

const COLORS_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#14b8a6', '#f97316', '#a855f7', '#db2777', '#0ea5e9'
];

const Dashboard: React.FC<DashboardProps> = ({ transactions = [], currentMonth, categories = [], companies = [], onAdd, onDelete, onUpdate, t }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    description: '', amount: '', category_id: '', scope: 'BUSINESS' as TransactionScope, company_id: '',
    date: new Date().toISOString().split('T')[0], due_date: new Date().toISOString().split('T')[0],
    is_recurring: false, status: 'PENDING' as any, type: 'EXPENSE' as any,
    contact_email: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        category: categories.find(c => c.id === formData.category_id)?.name || 'Outros'
      };

      if (editingTransaction) {
        await FinancialService.updateTransaction(editingTransaction.id, payload);
      } else {
        await onAdd(payload);
      }
      setShowAddModal(false);
      setEditingTransaction(null);
      onUpdate();
    } catch (error) {
      alert("Erro ao salvar: " + error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    await onDelete(id);
  };

  const currentMonthStr = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [currentMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(currentMonthStr));
  }, [transactions, currentMonthStr]);

  const summary = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const amount = Number(t.amount) || 0;
      const isPaid = t.status === 'PAID';
      
      if (t.type === 'INCOME') {
        if (isPaid) {
          acc.totalIncome += amount;
          acc.balance += amount;
          if (t.scope === 'BUSINESS') acc.businessIncome += amount;
          else acc.personalIncome += amount;
        }
      } else {
        // Para despesas, subtraímos do balanço e somamos ao total de gastos (geralmente regime de caixa/competência misto no dashboard)
        acc.totalExpenses += amount;
        acc.balance -= amount;
        if (t.scope === 'BUSINESS') acc.businessExpenses += amount;
        else acc.personalExpenses += amount;
      }
      return acc;
    }, {
      totalIncome: 0, totalExpenses: 0, businessIncome: 0, businessExpenses: 0, personalIncome: 0, personalExpenses: 0, balance: 0
    });
  }, [filteredTransactions]);

  const getFilteredValues = () => {
    if (activeTab === 'BUSINESS') {
      return {
        income: summary.businessIncome,
        expense: summary.businessExpenses,
        balance: summary.businessIncome - summary.businessExpenses,
        transactions: filteredTransactions.filter(t => t.scope === 'BUSINESS')
      };
    }
    if (activeTab === 'PERSONAL') {
      return {
        income: summary.personalIncome,
        expense: summary.personalExpenses,
        balance: summary.personalIncome - summary.personalExpenses,
        transactions: filteredTransactions.filter(t => t.scope === 'PERSONAL')
      };
    }
    return { 
      income: summary.totalIncome, 
      expense: summary.totalExpenses, 
      balance: summary.balance, 
      transactions: filteredTransactions 
    };
  };

  const viewData = getFilteredValues();

  // Monthly Evolution (Last 6 months)
  const monthlyEvolutionData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('pt-BR', { month: 'short' });
      
      const monthTransactions = transactions.filter(t => t.date.startsWith(mStr));
      const filteredMonthTransactions = activeTab === 'ALL' 
        ? monthTransactions 
        : monthTransactions.filter(t => t.scope === activeTab);

      const income = filteredMonthTransactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const expense = filteredMonthTransactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      months.push({
        name: monthName,
        income,
        expense,
        balance: income - expense
      });
    }
    return months;
  }, [transactions, currentMonth, activeTab]);

  const costTypeData = useMemo(() => {
    const expenses = viewData.transactions.filter(t => t.type === 'EXPENSE');
    const fixed = expenses.filter(t => t.cost_type === 'FIXED').reduce((sum, t) => sum + Number(t.amount), 0);
    const variable = expenses.filter(t => t.cost_type === 'VARIABLE').reduce((sum, t) => sum + Number(t.amount), 0);
    const undefined_costs = expenses.filter(t => !t.cost_type).reduce((sum, t) => sum + Number(t.amount), 0);

    return [
      { name: 'Fixo', value: fixed, color: '#f59e0b' },
      { name: 'Variável', value: variable, color: '#3b82f6' },
      { name: 'Não Def.', value: undefined_costs, color: '#94a3b8' }
    ].filter(d => d.value > 0);
  }, [viewData.transactions]);

  const trendData = useMemo(() => {
    if (viewData.transactions.length === 0) return [];
    
    // Group by day
    const daysMap: Record<number, { day: number, income: number, expense: number }> = {};
    
    // Initialize with all days of the month if we have a date
    const firstDate = new Date(viewData.transactions[0].date);
    const lastDay = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
    
    for (let i = 1; i <= lastDay; i++) {
      daysMap[i] = { day: i, income: 0, expense: 0 };
    }

    viewData.transactions.forEach(t => {
      const day = new Date(t.date).getDate();
      if (daysMap[day]) {
        if (t.type === 'INCOME') daysMap[day].income += Number(t.amount);
        else daysMap[day].expense += Number(t.amount);
      }
    });

    return Object.values(daysMap);
  }, [viewData.transactions]);

  const categoryData = useMemo(() => {
    const data = viewData.transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc: any[], t) => {
        const existing = acc.find(item => item.name === t.category);
        if (existing) {
          existing.value += Number(t.amount) || 0;
        } else {
          const catInfo = categories.find(c => c.name === t.category);
          acc.push({ 
            name: t.category || 'Outros', 
            value: Number(t.amount) || 0, 
            color: catInfo?.color || COLORS_PALETTE[acc.length % COLORS_PALETTE.length] 
          });
        }
        return acc;
      }, [])
      .sort((a, b) => b.value - a.value);
    
    return data.length > 0 ? data : [{ name: 'Sem dados', value: 1, color: '#e2e8f0' }];
  }, [viewData.transactions, categories]);

  const loanStats = useMemo(() => {
     const loanKeywords = ['cartão', 'credit', 'loan', 'empréstimo', 'financiamento', 'fatura'];
     const relevantItems = viewData.transactions.filter(t => t.type === 'EXPENSE' && ((t.installment_total && t.installment_total >= 1) || loanKeywords.some(k => t.category.toLowerCase().includes(k) || t.description.toLowerCase().includes(k))));
     const total = relevantItems.reduce((acc, t) => acc + Number(t.amount), 0);
     return { total, count: relevantItems.length };
  }, [viewData.transactions]);

  const financialStatement = useMemo(() => {
      const revenue = viewData.income;
      const totalOutflow = viewData.expense;
      const debtService = loanStats.total;
      const operationalExpense = totalOutflow - debtService;
      const netResult = revenue - totalOutflow;
      const margin = revenue > 0 ? (netResult / revenue) * 100 : 0;
      
      // Intelligent Forecast
      const today = new Date();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const avgDailySpend = dayOfMonth > 0 ? totalOutflow / dayOfMonth : 0;
      const forecastTotal = avgDailySpend * daysInMonth;
      
      return { revenue, operationalExpense, debtService, totalOutflow, netResult, margin, forecastTotal, avgDailySpend };
  }, [viewData, loanStats]);

  const anomalies = useMemo(() => {
    if (viewData.transactions.length < 5) return [];
    const expenses = viewData.transactions.filter(t => t.type === 'EXPENSE').map(t => Number(t.amount));
    const avg = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const stdDev = Math.sqrt(expenses.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / expenses.length);
    const threshold = avg + (stdDev * 2);
    
    return viewData.transactions.filter(t => t.type === 'EXPENSE' && Number(t.amount) > threshold && Number(t.amount) > 500);
  }, [viewData.transactions]);

  const insights = useMemo(() => {
    const list = [];
    if (financialStatement.margin > 20) {
      list.push({ icon: <TrendingUp className="text-emerald-500" />, text: "Sua margem está excelente! Considere investir o excedente.", type: "success" });
    } else if (financialStatement.margin < 5 && financialStatement.margin > 0) {
      list.push({ icon: <AlertTriangle className="text-amber-500" />, text: "Margem apertada. Revise suas despesas variáveis.", type: "warning" });
    } else if (financialStatement.margin <= 0) {
      list.push({ icon: <AlertTriangle className="text-rose-500" />, text: "Atenção: Déficit operacional detectado.", type: "danger" });
    }

    if (loanStats.total > financialStatement.revenue * 0.3) {
      list.push({ icon: <CreditCard className="text-rose-500" />, text: "Endividamento alto: Comprometimento de >30% da receita.", type: "danger" });
    }

    if (financialStatement.forecastTotal > financialStatement.revenue && financialStatement.revenue > 0) {
      list.push({ icon: <Zap className="text-amber-500" />, text: `Projeção de gastos (R$ ${financialStatement.forecastTotal.toFixed(0)}) excede a receita.`, type: "warning" });
    }

    if (anomalies.length > 0) {
      list.push({ icon: <Sparkles className="text-indigo-500" />, text: `${anomalies.length} despesas acima da média detectadas.`, type: "info" });
    }

    return list;
  }, [financialStatement, loanStats, anomalies]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{payload[0].payload.day ? `Dia ${payload[0].payload.day}` : payload[0].name}</p>
          <p className="text-sm font-black">R$ {payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Tab Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full md:w-fit overflow-x-auto">
          <button onClick={() => setActiveTab('ALL')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ALL' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Activity size={14} /> Consolidado</button>
          <button onClick={() => setActiveTab('BUSINESS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'BUSINESS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Building2 size={14} /> Empresas</button>
          <button onClick={() => setActiveTab('PERSONAL')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PERSONAL' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><User size={14} /> Pessoal</button>
        </div>

        <button 
          onClick={() => {
            setFormData({
              description: '', amount: '', category_id: '', scope: activeTab === 'PERSONAL' ? 'PERSONAL' : 'BUSINESS', company_id: companies[0]?.id || '',
              date: new Date().toISOString().split('T')[0], due_date: new Date().toISOString().split('T')[0],
              is_recurring: false, status: 'PENDING', type: 'EXPENSE', contact_email: ''
            });
            setEditingTransaction(null);
            setShowAddModal(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
        >
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.balance}</p>
          <h4 className={`text-2xl font-black tabular-nums ${viewData.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>R$ {viewData.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <div className="mt-2 flex items-center gap-2"><span className={`text-[10px] font-black px-2 py-1 rounded-lg ${viewData.balance >= 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/30'}`}>{activeTab === 'ALL' ? 'Visão Global' : activeTab === 'BUSINESS' ? 'Corporativo' : 'Pessoal'}</span></div>
        </div>
        
        <div className={`${activeTab === 'PERSONAL' ? 'bg-teal-600' : activeTab === 'BUSINESS' ? 'bg-indigo-600' : 'bg-emerald-600'} p-6 rounded-[2.5rem] shadow-xl text-white group transition-all duration-500`}>
          <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t.incomes}</p><ArrowUpRight size={18} /></div>
          <h4 className="text-2xl font-black tabular-nums">R$ {viewData.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl group transition-all">
          <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.expenses}</p><ArrowDownRight size={18} className="text-rose-500" /></div>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">R$ {viewData.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl group transition-all relative overflow-hidden">
           <div className="relative z-10">
             <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Zap size={12} /> Projeção Mensal</p><Target size={18} className="text-amber-500" /></div>
             <h4 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">R$ {financialStatement.forecastTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
             <p className="mt-2 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-lg w-fit">Base: R$ {financialStatement.avgDailySpend.toFixed(0)}/dia</p>
           </div>
        </div>
      </div>

      {/* Bento Grid Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Evolution */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Evolução Mensal</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comparativo de receitas e despesas (6 meses)</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[9px] font-black uppercase text-slate-400">Receitas</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[9px] font-black uppercase text-slate-400">Despesas</span></div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Type Distribution */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">Estrutura de Custos</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Fixo vs Variável</p>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {costTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-400 uppercase">Total</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">R$ {viewData.expense.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            {costTypeData.map((cat, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{cat.name}</span>
                </div>
                <span className="text-[10px] font-black text-slate-800 dark:text-white">R$ {cat.value.toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spending Trends */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Fluxo de Caixa</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tendência diária de entradas e saídas</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[9px] font-black uppercase text-slate-400">Entradas</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[9px] font-black uppercase text-slate-400">Saídas</span></div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">Distribuição</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Gastos por categoria</p>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-400 uppercase">Total</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">R$ {viewData.expense.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          <div className="mt-6 space-y-2 max-h-[120px] overflow-y-auto pr-2">
            {categoryData.slice(0, 4).map((cat, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{cat.name}</span>
                </div>
                <span className="text-[10px] font-black text-slate-800 dark:text-white">{((cat.value / (viewData.expense || 1)) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Insights */}
        <div className="bg-slate-900 dark:bg-white rounded-[3rem] p-8 text-white dark:text-slate-900 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Brain size={120} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-white/10 dark:bg-slate-900/10 rounded-xl flex items-center justify-center"><Sparkles size={20} className="text-indigo-400" /></div>
              <h3 className="text-lg font-black uppercase tracking-tight">Insights IA</h3>
            </div>
            <div className="space-y-4">
              {insights.length > 0 ? insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-white/5 dark:bg-slate-900/5 rounded-2xl border border-white/10 dark:border-slate-900/10">
                  <div className="mt-1">{insight.icon}</div>
                  <p className="text-xs font-bold leading-relaxed">{insight.text}</p>
                </div>
              )) : (
                <div className="flex items-start gap-4 p-4 bg-white/5 dark:bg-slate-900/5 rounded-2xl border border-white/10 dark:border-slate-900/10">
                  <div className="mt-1"><CheckCircle2 className="text-emerald-400" /></div>
                  <p className="text-xs font-bold leading-relaxed">Seu comportamento financeiro está estável este mês. Continue assim!</p>
                </div>
              )}
            </div>
            <button className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">
              <Zap size={14} /> Gerar Relatório Completo
            </button>
          </div>
        </div>

        {/* Financial Statement */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center"><Receipt size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Demonstrativo Mensal</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extrato Consolidado</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Receita Total</span>
                <ArrowUpRight size={14} className="text-emerald-500" />
              </div>
              <p className="text-xl font-black text-emerald-600 tabular-nums">+ R$ {financialStatement.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Despesas Op.</span>
                <Tag size={14} className="text-slate-400" />
              </div>
              <p className="text-xl font-black text-slate-600 dark:text-slate-400 tabular-nums">- R$ {financialStatement.operationalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Dívidas</span>
                <CreditCard size={14} className="text-indigo-500" />
              </div>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">- R$ {financialStatement.debtService.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-4 rounded-2xl border ${financialStatement.netResult >= 0 ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border-rose-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Resultado</span>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Margem: {financialStatement.margin.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-black tabular-nums">R$ {financialStatement.netResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500"><FileText size={20} /></div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Extrato de Movimentações</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalhamento do período</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
             <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <th className="px-8 py-4">Data</th>
                   <th className="px-8 py-4">Descrição</th>
                   <th className="px-8 py-4">Categoria</th>
                   <th className="px-8 py-4 text-center">Status</th>
                   <th className="px-8 py-4 text-right">Valor</th>
                   <th className="px-8 py-4 text-right">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {viewData.transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-xs font-bold italic">Nenhum lançamento encontrado para este período.</td></tr>
                ) : (
                   viewData.transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                         <td className="px-8 py-4"><span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR')}</span></td>
                         <td className="px-8 py-4">
                            <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                  {t.type === 'INCOME' ? <ArrowUpCircle size={14} className="text-emerald-500" /> : <ArrowDownCircle size={14} className="text-rose-500" />}
                                  <span className="text-xs font-bold text-slate-800 dark:text-white">{t.description}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                  {t.is_recurring && <span className="text-[8px] font-black uppercase text-indigo-500 flex items-center gap-0.5"><Clock size={8}/> Recorrente</span>}
                                  {t.installment_total && t.installment_total > 1 && <span className="text-[8px] font-bold text-slate-400">Parcela {t.installment_current}/{t.installment_total}</span>}
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-4"><span className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">{t.category}</span></td>
                         <td className="px-8 py-4 text-center">{t.status === 'PAID' ? <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full"><CheckCircle2 size={10}/> Pago</span> : <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full"><Clock size={10}/> Pendente</span>}</td>
                         <td className={`px-8 py-4 text-right font-black text-xs ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>{t.type === 'EXPENSE' ? '-' : '+'} R$ {Number(t.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                         <td className="px-8 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                 onClick={() => {
                                   setFormData({
                                     description: t.description,
                                     amount: t.amount.toString(),
                                     category_id: t.category_id || '',
                                     scope: t.scope || 'BUSINESS',
                                     company_id: t.company_id || '',
                                     date: t.date,
                                     due_date: t.due_date || t.date,
                                     is_recurring: t.is_recurring || false,
                                     status: t.status,
                                     type: t.type,
                                     contact_email: t.contact_email || ''
                                   });
                                   setEditingTransaction(t);
                                   setShowAddModal(true);
                                 }}
                                 className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                               >
                                 <ArrowUpRight size={16} />
                               </button>
                               <button 
                                 onClick={() => {
                                   if (!t.contact_email) {
                                     alert("Por favor, cadastre um e-mail para este lançamento.");
                                     return;
                                   }
                                   const subject = encodeURIComponent(`Lembrete de Pagamento: ${t.description}`);
                                   const body = encodeURIComponent(`Olá,\n\nGostaríamos de lembrar sobre o pagamento de R$ ${t.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})} referente a ${t.description}, com vencimento em ${new Date(t.due_date || t.date).toLocaleDateString('pt-BR')}.\n\nAtenciosamente,\nEquipe Financeira`);
                                   window.open(`mailto:${t.contact_email}?subject=${subject}&body=${body}`);
                                 }}
                                 className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                 title="Enviar Cobrança"
                               >
                                 <Bell size={16} />
                               </button>
                               <button onClick={() => handleDelete(t.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                                 <ArrowDownRight size={16} />
                               </button>
                            </div>
                         </td>
                      </tr>
                   ))
                )}
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
                {editingTransaction ? <ArrowUpRight size={24} /> : <TrendingUp size={24} />}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">
                  {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}><option value="PENDING">Pendente</option><option value="PAID">Pago / Recebido</option><option value="OVERDUE">Atrasado</option></select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} required>
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2">
                <ShieldCheck size={16} /> {editingTransaction ? 'Salvar Alterações' : 'Confirmar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
