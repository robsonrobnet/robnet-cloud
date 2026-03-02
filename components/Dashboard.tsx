
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend 
} from 'recharts';
import { 
  TrendingUp, ArrowUpRight, ArrowDownRight, Tag, PieChart as PieChartIcon, 
  Sparkles, CalendarDays, Activity, Building2, User, CreditCard, Calendar,
  Wallet, Landmark, Receipt, Percent, AlertTriangle, FileText, CheckCircle2, Clock, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { Transaction, FinancialSummary, Category, TransactionScope } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  summary: FinancialSummary;
  categories: Category[];
  t: any;
}

type DashboardTab = 'ALL' | 'BUSINESS' | 'PERSONAL';

const COLORS_PALETTE = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6', '#f97316', '#a855f7', '#db2777', '#0ea5e9'
];

const Dashboard: React.FC<DashboardProps> = ({ transactions = [], summary, categories = [], t }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('ALL');

  const getFilteredValues = () => {
    if (activeTab === 'BUSINESS') {
      return {
        income: summary.businessIncome,
        expense: summary.businessExpenses,
        balance: summary.businessIncome - summary.businessExpenses,
        transactions: transactions.filter(t => t.scope === 'BUSINESS')
      };
    }
    if (activeTab === 'PERSONAL') {
      return {
        income: summary.personalIncome,
        expense: summary.personalExpenses,
        balance: summary.personalIncome - summary.personalExpenses,
        transactions: transactions.filter(t => t.scope === 'PERSONAL')
      };
    }
    return { income: summary.totalIncome, expense: summary.totalExpenses, balance: summary.balance, transactions };
  };

  const viewData = getFilteredValues();

  const loanStats = useMemo(() => {
     const loanKeywords = ['cartão', 'credit', 'loan', 'empréstimo', 'financiamento', 'fatura'];
     const relevantItems = viewData.transactions.filter(t => t.type === 'EXPENSE' && ((t.installment_total && t.installment_total >= 1) || loanKeywords.some(k => t.category.toLowerCase().includes(k) || t.description.toLowerCase().includes(k))));
     const total = relevantItems.reduce((acc, t) => acc + Number(t.amount), 0);
     return { total, count: relevantItems.length };
  }, [viewData.transactions]);

  const todaysAgenda = useMemo(() => {
      const todayStr = new Date().toISOString().split('T')[0];
      return viewData.transactions.filter(t => (t.due_date || t.date) === todayStr && t.status !== 'PAID');
  }, [viewData.transactions]);

  const financialStatement = useMemo(() => {
      const revenue = viewData.income;
      const totalOutflow = viewData.expense;
      const debtService = loanStats.total;
      const operationalExpense = totalOutflow - debtService;
      const netResult = revenue - totalOutflow;
      const margin = revenue > 0 ? (netResult / revenue) * 100 : 0;
      return { revenue, operationalExpense, debtService, totalOutflow, netResult, margin };
  }, [viewData, loanStats]);

  const chartData = [
    { name: t.incomes, value: viewData.income || 0.1 },
    { name: t.expenses, value: viewData.expense || 0.1 },
  ];

  const categoryData = viewData.transactions.length > 0 
    ? viewData.transactions.filter(t => t.type === 'EXPENSE').reduce((acc: any[], t) => {
          const existing = acc.find(item => item.name === t.category);
          if (existing) { existing.value += Number(t.amount) || 0; } 
          else {
            const catInfo = categories.find(c => c.name === t.category);
            const autoColor = COLORS_PALETTE[acc.length % COLORS_PALETTE.length];
            acc.push({ name: t.category || 'Outros', value: Number(t.amount) || 0, color: catInfo?.color || autoColor });
          }
          return acc;
        }, []).sort((a, b) => b.value - a.value)
    : [{ name: 'Fixos', value: 2500, color: '#6366f1' }, { name: 'Variáveis', value: 1200, color: '#10b981' }];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-3 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{payload[0].name}</p>
          <p className="text-sm font-black">R$ {payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full md:w-fit overflow-x-auto">
        <button onClick={() => setActiveTab('ALL')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ALL' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Activity size={14} /> Consolidado</button>
        <button onClick={() => setActiveTab('BUSINESS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'BUSINESS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Building2 size={14} /> Empresas</button>
        <button onClick={() => setActiveTab('PERSONAL')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PERSONAL' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><User size={14} /> Pessoal</button>
      </div>

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
           <div className="relative z-10"><div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><CreditCard size={12} /> Cartões & Dívidas</p><Activity size={18} className="text-indigo-500" /></div><h4 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">R$ {loanStats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4><p className="mt-2 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg w-fit">{loanStats.count} obrigações</p></div>
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-950/50 p-1 rounded-[3rem]">
          <div className="bg-white dark:bg-slate-900 rounded-[2.8rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6"><div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center"><Receipt size={24} /></div><div><h3 className="text-xl font-black text-slate-800 dark:text-white">Demonstrativo Mensal</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extrato Consolidado</p></div></div>
              <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl"><ArrowUpRight size={18} /></div><span className="font-black text-emerald-700 dark:text-emerald-400 text-sm uppercase">Receita Total</span></div><span className="font-black text-xl text-emerald-600 tabular-nums">+ R$ {financialStatement.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"><div className="flex items-center gap-3"><div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-xl"><Tag size={18} /></div><span className="font-bold text-slate-600 dark:text-slate-300 text-sm uppercase">Despesas Operacionais</span></div><span className="font-bold text-lg text-slate-600 dark:text-slate-400 tabular-nums">- R$ {financialStatement.operationalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30"><div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><CreditCard size={18} /></div><span className="font-bold text-indigo-700 dark:text-indigo-400 text-sm uppercase">Dívidas e Parcelamentos</span></div><span className="font-bold text-lg text-indigo-600 dark:text-indigo-400 tabular-nums">- R$ {financialStatement.debtService.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-2 border-t border-dashed"></div>
                  <div className={`flex items-center justify-between p-5 rounded-2xl border ${financialStatement.netResult >= 0 ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border-rose-200 dark:border-rose-900/50'}`}><div className="flex items-center gap-3"><div className={`p-2 rounded-xl ${financialStatement.netResult >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{financialStatement.netResult >= 0 ? <Wallet size={20} /> : <AlertTriangle size={20} />}</div><div><span className="font-black text-sm uppercase tracking-widest block">Resultado Líquido</span><span className="text-[10px] opacity-70 font-bold uppercase">Margem: {financialStatement.margin.toFixed(1)}%</span></div></div><span className="font-black text-2xl tabular-nums">R$ {financialStatement.netResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              </div>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mt-8">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500"><FileText size={20} /></div><div><h3 className="text-lg font-black text-slate-800 dark:text-white">Extrato de Movimentações</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalhamento do período</p></div></div></div>
        <div className="overflow-x-auto">
          <table className="w-full">
             <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <th className="px-8 py-4">Data</th>
                   <th className="px-8 py-4">Descrição</th>
                   <th className="px-8 py-4">Categoria</th>
                   <th className="px-8 py-4 text-center">Status</th>
                   <th className="px-8 py-4 text-right">Valor</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {viewData.transactions.length === 0 ? (<tr><td colSpan={5} className="px-8 py-8 text-center text-slate-400 text-xs font-bold">Nenhum lançamento.</td></tr>) : (
                   viewData.transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                         <td className="px-8 py-4"><span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR')}</span></td>
                         <td className="px-8 py-4"><div className="flex items-center gap-2">{t.type === 'INCOME' ? <ArrowUpCircle size={14} className="text-emerald-500" /> : <ArrowDownCircle size={14} className="text-rose-500" />}<span className="text-xs font-bold text-slate-800 dark:text-white">{t.description}</span></div></td>
                         <td className="px-8 py-4"><span className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">{t.category}</span></td>
                         <td className="px-8 py-4 text-center">{t.status === 'PAID' ? <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 size={10}/> Pago</span> : <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-full"><Clock size={10}/> Pendente</span>}</td>
                         <td className={`px-8 py-4 text-right font-black text-xs ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>{t.type === 'EXPENSE' ? '-' : '+'} R$ {Number(t.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                      </tr>
                   ))
                )}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
