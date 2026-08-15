import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sparkles, RefreshCw, TrendingUp, TrendingDown, CheckCircle2, 
  AlertTriangle, Lightbulb, Zap, ArrowRight, ShieldCheck, HelpCircle
} from 'lucide-react';
import { Transaction } from '../types';
import { getDailyFinancialInsight, DailyInsightData } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

interface DailyFinancialInsightCardProps {
  transactions: Transaction[];
  currentMonth: Date;
  activeScope?: 'ALL' | 'BUSINESS' | 'PERSONAL';
}

export const DailyFinancialInsightCard: React.FC<DailyFinancialInsightCardProps> = ({
  transactions,
  currentMonth,
  activeScope = 'ALL'
}) => {
  const [insight, setInsight] = useState<DailyInsightData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filter transactions for the current month
  const currentMonthStr = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [currentMonth]);

  const monthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchMonth = t.date.startsWith(currentMonthStr);
      if (!matchMonth) return false;
      if (activeScope === 'ALL') return true;
      return t.scope === activeScope;
    });
  }, [transactions, currentMonthStr, activeScope]);

  // Today's date string (local)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Today's expenses
  const todayExpenses = useMemo(() => {
    return monthTransactions.filter(t => t.type === 'EXPENSE' && t.date.startsWith(todayStr));
  }, [monthTransactions, todayStr]);

  const todaySpending = useMemo(() => {
    return todayExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [todayExpenses]);

  // Total month expenses & calculation of daily benchmark
  const totalMonthlySpend = useMemo(() => {
    return monthTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [monthTransactions]);

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  // Monthly average daily spend: based on elapsed days or total days
  const monthlyAvgDailySpend = useMemo(() => {
    const elapsedDays = Math.max(1, dayOfMonth);
    return totalMonthlySpend / elapsedDays;
  }, [totalMonthlySpend, dayOfMonth]);

  // Top expense categories for context
  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const cat = t.category || 'Geral';
        map[cat] = (map[cat] || 0) + (Number(t.amount) || 0);
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTransactions]);

  const fetchInsight = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDailyFinancialInsight({
        todaySpending,
        monthlyAvgDailySpend,
        totalMonthlySpend,
        dayOfMonth,
        daysInMonth,
        scope: activeScope,
        topCategories,
        todayExpensesList: todayExpenses.map(t => ({
          description: t.description,
          amount: Number(t.amount) || 0,
          category: t.category
        }))
      });
      setInsight(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load daily insight:", err);
    } finally {
      setIsLoading(false);
    }
  }, [todaySpending, monthlyAvgDailySpend, totalMonthlySpend, dayOfMonth, daysInMonth, activeScope, topCategories, todayExpenses]);

  // Fetch on mount or when key numbers significantly change
  useEffect(() => {
    fetchInsight();
  }, [currentMonthStr, activeScope, todaySpending]);

  const diffPercent = useMemo(() => {
    if (insight?.diffPercent !== undefined) return insight.diffPercent;
    if (monthlyAvgDailySpend <= 0) return todaySpending > 0 ? 100 : 0;
    return Math.round(((todaySpending - monthlyAvgDailySpend) / monthlyAvgDailySpend) * 100);
  }, [insight, todaySpending, monthlyAvgDailySpend]);

  const isAboveAverage = diffPercent > 10;
  const isBelowAverage = diffPercent < -10;
  const isZero = todaySpending === 0;

  // Comparison bar percentage calculation (capped at 100% for visual layout)
  const maxBenchmark = Math.max(monthlyAvgDailySpend * 1.5, todaySpending, 100);
  const todayProgress = Math.min(100, Math.round((todaySpending / maxBenchmark) * 100));
  const avgProgress = Math.min(100, Math.round((monthlyAvgDailySpend / maxBenchmark) * 100));

  return (
    <div 
      id="daily-financial-insight-card"
      className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 dark:from-white dark:via-slate-50 dark:to-indigo-50/40 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-7 text-white dark:text-slate-900 border border-indigo-500/20 dark:border-indigo-200/60 shadow-xl relative overflow-hidden group transition-all"
    >
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-600/5 blur-[90px] rounded-full pointer-events-none -z-0" />
      <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none -z-0" />

      <div className="relative z-10 space-y-5">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 dark:bg-indigo-100 flex items-center justify-center text-indigo-400 dark:text-indigo-600 shadow-inner">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">
                  Daily Financial Insight
                </h3>
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 dark:bg-indigo-100 text-indigo-300 dark:text-indigo-700 border border-indigo-500/30 dark:border-indigo-200">
                  Gemini AI
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                Análise de gastos de hoje vs. média diária do mês
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="refresh-daily-insight-btn"
              onClick={fetchInsight}
              disabled={isLoading}
              title="Recalcular análise com Gemini"
              className="px-3 py-1.5 rounded-xl bg-white/10 dark:bg-slate-200/70 hover:bg-white/20 dark:hover:bg-slate-300 text-white dark:text-slate-800 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin text-indigo-400" : ""} />
              <span>{isLoading ? "Analisando..." : "Atualizar"}</span>
            </button>
          </div>
        </div>

        {/* Comparison Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/5 dark:bg-white border border-white/10 dark:border-slate-200/80 shadow-sm">
          {/* Today's Spend */}
          <div className="flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gasto de Hoje
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <h4 className="text-xl sm:text-2xl font-black tabular-nums tracking-tight">
                R$ {todaySpending.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
            </div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
              {todayExpenses.length} {todayExpenses.length === 1 ? 'saída registrada' : 'saídas registradas'}
            </span>
          </div>

          {/* Monthly Daily Average */}
          <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 dark:border-slate-200 pt-2 sm:pt-0 sm:pl-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Média Diária do Mês
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <h4 className="text-xl sm:text-2xl font-black tabular-nums tracking-tight text-slate-300 dark:text-slate-700">
                R$ {monthlyAvgDailySpend.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <span className="text-[9px] font-bold text-slate-400">/dia</span>
            </div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
              Dia {dayOfMonth} de {daysInMonth} dias
            </span>
          </div>

          {/* Delta / Comparison Status */}
          <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 dark:border-slate-200 pt-2 sm:pt-0 sm:pl-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Variação vs Média
            </span>
            <div className="mt-1">
              {isZero ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 dark:text-emerald-700 dark:bg-emerald-100 text-xs font-black">
                  <CheckCircle2 size={13} />
                  <span>Sem gastos hoje (100% livre)</span>
                </div>
              ) : isAboveAverage ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-400 dark:text-rose-700 dark:bg-rose-100 text-xs font-black">
                  <TrendingUp size={13} />
                  <span>+{Math.abs(diffPercent)}% acima da média</span>
                </div>
              ) : isBelowAverage ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 dark:text-emerald-700 dark:bg-emerald-100 text-xs font-black">
                  <TrendingDown size={13} />
                  <span>{diffPercent}% abaixo da média</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 dark:text-indigo-700 dark:bg-indigo-100 text-xs font-black">
                  <CheckCircle2 size={13} />
                  <span>No padrão (~{diffPercent}%)</span>
                </div>
              )}
            </div>
            <div className="mt-2 w-full bg-white/10 dark:bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(5, todayProgress)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  isAboveAverage 
                    ? 'bg-rose-500' 
                    : isZero 
                    ? 'bg-emerald-400' 
                    : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* AI Analysis & Actionable Tip Section */}
        {isLoading ? (
          <div className="p-4 rounded-2xl bg-white/5 dark:bg-slate-100 border border-white/5 dark:border-slate-200 animate-pulse space-y-3">
            <div className="h-4 bg-white/10 dark:bg-slate-200 rounded w-1/3"></div>
            <div className="h-3 bg-white/10 dark:bg-slate-200 rounded w-5/6"></div>
            <div className="h-10 bg-white/10 dark:bg-slate-200 rounded-xl w-full mt-2"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* AI Summary / Headline */}
            <div className="p-4 rounded-2xl bg-white/5 dark:bg-white border border-white/10 dark:border-slate-200/80 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-600 animate-ping" />
                <h5 className="text-xs sm:text-sm font-black text-white dark:text-slate-900 tracking-tight">
                  {insight?.headline || (isAboveAverage ? `Gasto diário ${diffPercent}% superior à média` : "Ritmo de despesas sob controle")}
                </h5>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-300 dark:text-slate-600 leading-relaxed">
                {insight?.analysis || `Hoje foram desembolsados R$ ${todaySpending.toFixed(2)} em comparação com a média diária de R$ ${monthlyAvgDailySpend.toFixed(2)}.`}
              </p>
            </div>

            {/* Actionable Tip Box */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-emerald-500/15 dark:from-amber-50 dark:via-indigo-50/60 dark:to-emerald-50 border border-amber-500/30 dark:border-amber-200 flex items-start gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 dark:bg-amber-100 flex items-center justify-center text-amber-400 dark:text-amber-600 shrink-0 mt-0.5">
                <Lightbulb size={16} />
              </div>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 dark:text-amber-700">
                    Dica Prática de Ação
                  </span>
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 dark:bg-amber-200 dark:text-amber-800">
                    Hoje
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-100 dark:text-slate-800 leading-snug">
                  {insight?.actionableTip || "Revise os gastos discricionários e aproveite dias de baixo volume para turbinar aportes."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyFinancialInsightCard;
