
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu, Loader2, ChevronLeft, ChevronRight, Calendar, Moon, Sun } from 'lucide-react';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Transaction, AppView, ChatMessage, User, Language, Category, Company } from './types';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import TransactionList from './components/TransactionList';
import Sidebar from './components/Sidebar';
import AdminSettings from './components/AdminSettings';
import ReceivablesManager from './components/ReceivablesManager';
import CreditLoansManager from './components/CreditLoansManager';
import NfseManager from './components/NfseManager';
import Login from './components/Login';
import { translations } from './lib/translations';
import { FinancialService } from './services/financialService';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('pt');
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  // Apply Theme
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  
  // Date State for Monthly Filtering - Defaults to Today (Current Month)
  const [currentDate, setCurrentDate] = useState(new Date());

  const t = translations[language];

  useEffect(() => {
    const saved = localStorage.getItem('finanai_session_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
        setLanguage(parsed.language || 'pt');
      } catch (e) { localStorage.removeItem('finanai_session_v3'); }
    }
  }, []);

  // Performance: useCallback garante que a função não seja recriada a cada render,
  // evitando que componentes filhos (como TransactionList) renderizem sem necessidade.
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      // Executa a sincronização em background para não bloquear a UI inicial se demorar
      FinancialService.syncRecurrence(currentUser.company_id).catch(console.warn);

      const [transData, catData, msgData] = await Promise.all([
        FinancialService.getTransactions(currentUser.company_id, currentUser.id, currentUser.role),
        FinancialService.getCategories(currentUser.company_id),
        FinancialService.getChatHistory(currentUser.id)
      ]);

      let companiesData: Company[] = [];
      if (currentUser.role === 'MANAGER') {
         const { data } = await supabase.from('companies').select('*');
         companiesData = data || [];
      } else {
         // Carrega a empresa principal + empresas que o usuário é dono (owner_id)
         const { data } = await supabase.from('companies')
            .select('*')
            .or(`id.eq.${currentUser.company_id},owner_id.eq.${currentUser.id}`);
         companiesData = data || [];
      }
      setCompanies(companiesData);

      const today = new Date().toISOString().split('T')[0];
      
      if (transData) {
        // Processamento de dados otimizado
        const processedTransactions = transData.map(t => {
          let status = t.status || 'PAID';
          if (status === 'PENDING' && t.due_date && t.due_date < today) {
            status = 'OVERDUE';
          }
          return { ...t, status, costType: t.cost_type, scope: t.scope || 'BUSINESS' };
        });
        setTransactions(processedTransactions);
      }

      if (catData) setCategories(catData);
      if (msgData) setMessages(msgData);

    } catch (e) { 
      console.error("Fetch Error:", e); 
    } finally { 
      setIsLoading(false); 
    }
  }, [currentUser]); // Dependência explícita

  useEffect(() => { if (currentUser) fetchData(); }, [currentUser, fetchData]);

  const handleAddTransaction = async (newTrans: any) => {
    if (!currentUser) return;
    try {
      console.log("Processing AI Input:", newTrans);

      let matchingCategory = categories.find(c => c.id === newTrans.category_id);
      if (!matchingCategory && newTrans.category) {
        matchingCategory = categories.find(c => c.name.toLowerCase() === newTrans.category.toLowerCase());
      }
      
      let finalDate = newTrans.date;
      if (!finalDate || finalDate === 'Invalid Date') {
         finalDate = new Date().toISOString().split('T')[0];
      } else {
         try {
            const d = new Date(finalDate);
            if (!isNaN(d.getTime())) {
                finalDate = d.toISOString().split('T')[0];
            } else {
                finalDate = new Date().toISOString().split('T')[0];
            }
         } catch {
            finalDate = new Date().toISOString().split('T')[0];
         }
      }
      
      let finalAmount = 0;
      if (typeof newTrans.amount === 'number') {
          finalAmount = newTrans.amount;
      } else if (typeof newTrans.amount === 'string') {
          let cleanStr = newTrans.amount.replace(/[^\d.,-]/g, '');
          if (cleanStr.includes(',') && !cleanStr.includes('.')) {
             cleanStr = cleanStr.replace(',', '.');
          } else if (cleanStr.includes('.') && cleanStr.includes(',')) {
             if (cleanStr.lastIndexOf(',') > cleanStr.lastIndexOf('.')) {
                 cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
             }
          }
          finalAmount = parseFloat(cleanStr);
      }
      if (isNaN(finalAmount)) finalAmount = 0;
      
      const payload = {
        user_id: currentUser.id,
        company_id: newTrans.company_id || currentUser.company_id, // Allow override
        category_id: matchingCategory?.id || null,
        category: matchingCategory?.name || newTrans.category || 'Outros', 
        description: newTrans.description ? String(newTrans.description) : 'Transação Importada',
        amount: Math.abs(finalAmount),
        type: newTrans.type || 'EXPENSE',
        status: newTrans.status || 'PAID',
        cost_type: newTrans.costType || 'VARIABLE',
        scope: newTrans.scope || 'BUSINESS',
        date: finalDate,
        due_date: newTrans.due_date || finalDate,
        is_recurring: !!newTrans.is_recurring,
        installment_current: newTrans.installment_current,
        installment_total: newTrans.installment_total
      };
      
      const response = await FinancialService.addTransaction(payload);
      const { data, error } = response;
      const isDuplicate = (response as any).isDuplicate;

      if (isDuplicate) {
         console.warn(`Skipped duplicate: ${payload.description}`);
         return; 
      }

      if (error) throw error;
      
      // Atualiza dados após inserção
      fetchData();
    } catch (e: any) { 
      console.error("Critical error in handleAddTransaction:", e); 
    }
  };

  const handleSaveMessage = async (msg: ChatMessage) => {
    if (!currentUser) return;
    try {
      await FinancialService.saveChatMessage(currentUser.id, msg.role, msg.content);
    } catch (e) {
      console.error("Error saving message:", e);
    }
  };

  const handlePrevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const filteredTransactions = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;
    return transactions.filter(t => t.date.startsWith(monthStr));
  }, [transactions, currentDate]);

  const summary = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const amount = Number(t.amount) || 0;
      const scope = t.scope || 'BUSINESS';
      
      if (t.type === 'INCOME') {
        if (t.status === 'PAID') {
          acc.totalIncome += amount;
          acc.balance += amount;
          if (scope === 'BUSINESS') acc.businessIncome += amount;
          else acc.personalIncome += amount;
        } else if (t.status === 'PENDING') {
          acc.pendingReceivables += amount;
        } else if (t.status === 'OVERDUE') {
          acc.overdueReceivables += amount;
        }
      } else {
        acc.totalExpenses += amount;
        acc.balance -= amount;
        if (scope === 'BUSINESS') acc.businessExpenses += amount;
        else acc.personalExpenses += amount;

        if (t.costType === 'FIXED') acc.fixedExpenses += amount;
        else acc.variableExpenses += amount;
      }
      return acc;
    }, { 
      totalIncome: 0, totalExpenses: 0, balance: 0, 
      fixedExpenses: 0, variableExpenses: 0, 
      pendingReceivables: 0, overdueReceivables: 0,
      businessIncome: 0, businessExpenses: 0,
      personalIncome: 0, personalExpenses: 0
    });
  }, [filteredTransactions]);

  if (!currentUser) return <Login onLoginSuccess={setCurrentUser} t={t} />;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-inter transition-colors duration-300">
      <SpeedInsights />
      <Sidebar currentView={view} setView={setView} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} currentUser={currentUser} onLogout={() => setCurrentUser(null)} t={t} />
      <main className="flex-1 lg:ml-64 relative flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 md:px-10 shrink-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><Menu size={24} /></button>
            <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase hidden md:block">FinanAI OS / {view}</h1>
          </div>
          
          {(view === AppView.DASHBOARD || view === AppView.TRANSACTIONS) && (
             <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg text-slate-500 dark:text-slate-400 transition-all"><ChevronLeft size={16} /></button>
                <div className="flex items-center gap-2 px-4 min-w-[140px] justify-center">
                   <Calendar size={14} className="text-emerald-500" />
                   <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
                      {currentDate.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' })}
                   </span>
                </div>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg text-slate-500 dark:text-slate-400 transition-all"><ChevronRight size={16} /></button>
             </div>
          )}

          <div className="flex items-center gap-4">
             {/* Theme Toggle */}
             <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-all">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
             </button>

             <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{currentUser.username}</p>
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Terminal: {currentUser.role}</p>
             </div>
             <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 text-white rounded-xl flex items-center justify-center font-black text-xs border-2 border-emerald-500/20">{(currentUser.username[0] || 'U').toUpperCase()}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
          <div className="max-w-6xl mx-auto h-full">
            {isLoading ? <div className="flex flex-col items-center justify-center h-full"><Loader2 className="animate-spin text-emerald-500 mb-4" size={48} /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Neural Syncing...</p></div> 
            : (view === AppView.RECEIVABLES || view === AppView.PAYABLES) ? 
              <ReceivablesManager 
                defaultMode={view === AppView.RECEIVABLES ? 'RECEIVABLES' : 'PAYABLES'} 
                transactions={transactions} 
                categories={categories} 
                companies={companies} 
                t={t} 
                onUpdate={fetchData} 
                onAdd={handleAddTransaction} 
              />
            : view === AppView.LOANS ?
               <CreditLoansManager transactions={transactions} categories={categories} onUpdate={fetchData} />
            : view === AppView.NFSE ?
               <NfseManager currentUser={currentUser} />
            : view === AppView.TRANSACTIONS ? 
              <TransactionList 
                transactions={filteredTransactions} 
                categories={categories}
                companies={companies} 
                onDelete={async (id) => { await FinancialService.deleteTransaction(id); fetchData(); }} 
                onAdd={handleAddTransaction} 
                onUpdate={fetchData}
                t={t} 
              />
            : view === AppView.CHAT ? 
              <div className="h-[calc(100vh-12rem)]">
                <ChatInterface 
                  onAddTransaction={handleAddTransaction} 
                  onSaveMessage={handleSaveMessage} 
                  messages={messages} 
                  setMessages={setMessages} 
                  currentUser={currentUser} 
                  t={t} 
                  currentLang={language}
                  transactions={transactions}
                  categories={categories}
                  companies={companies}
                  onUpdateData={fetchData} 
                />
              </div>
            : view === AppView.ADMIN ? <AdminSettings currentUser={currentUser} t={t} language={language} onLanguageChange={setLanguage} fetchData={fetchData} />
            : <Dashboard transactions={filteredTransactions} summary={summary} categories={categories} t={t} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
