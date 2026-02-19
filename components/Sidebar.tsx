
import React from 'react';
import { 
  LayoutDashboard, Receipt, MessageSquare, LogOut, ChevronRight, Shield, TrendingUp, TrendingDown, Lock, CreditCard, FileText, Crown, Clock
} from 'lucide-react';
import { AppView, User } from '../types';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentUser: User;
  onLogout: () => void;
  t: any;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, setIsOpen, currentUser, onLogout, t }) => {
  
  // LOGICA DE TRIAL E PLANOS
  const accessLevel = React.useMemo(() => {
    // FIX: renamed createdAt to created_at
    const created = new Date(currentUser.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isTrial = diffDays <= 15;
    const daysLeft = 15 - diffDays;

    // Se estiver no trial, considera como ENTERPRISE temporariamente para degustação
    const effectivePlan = isTrial ? 'ENTERPRISE' : currentUser.plan;

    return { 
        isTrial, 
        daysLeft, 
        effectivePlan,
        rawPlan: currentUser.plan 
    };
  }, [currentUser]);

  // Definição de Permissões por Plano Efetivo
  const canAccess = (feature: string) => {
      const plan = accessLevel.effectivePlan;
      
      switch(feature) {
          case 'BASIC': return true; // Dashboard, Transactions (FREE+)
          case 'INTERMEDIATE': return ['START', 'PRO', 'ENTERPRISE'].includes(plan); // Receivables, Payables
          case 'PROFESSIONAL': return ['PRO', 'ENTERPRISE'].includes(plan); // Loans, AI
          case 'ENTERPRISE': return ['ENTERPRISE'].includes(plan); // NFSe
          default: return false;
      }
  };

  const menu = [
    { 
        id: AppView.DASHBOARD, 
        label: t.dashboard, 
        icon: LayoutDashboard, 
        allowed: canAccess('BASIC'),
        reqLabel: 'Free'
    },
    { 
        id: AppView.TRANSACTIONS, 
        label: t.finances, 
        icon: Receipt, 
        allowed: canAccess('BASIC'),
        reqLabel: 'Free'
    },
    { 
        id: AppView.RECEIVABLES, 
        label: "Contas a Receber", 
        icon: TrendingUp, 
        allowed: canAccess('INTERMEDIATE'),
        reqLabel: 'Básico'
    },
    { 
        id: AppView.PAYABLES, 
        label: "Contas a Pagar", 
        icon: TrendingDown, 
        allowed: canAccess('INTERMEDIATE'),
        reqLabel: 'Básico'
    },
    { 
        id: AppView.LOANS, 
        label: "Cartões & Empréstimos", 
        icon: CreditCard, 
        allowed: canAccess('PROFESSIONAL'),
        reqLabel: 'Intermed.' 
    },
    { 
        id: AppView.CHAT, 
        label: t.ai_assistant, 
        icon: MessageSquare, 
        allowed: canAccess('PROFESSIONAL'),
        reqLabel: 'Intermed.'
    },
    { 
        id: AppView.NFSE, 
        label: "NFS-e São Paulo", 
        icon: FileText, 
        allowed: canAccess('ENTERPRISE'),
        reqLabel: 'Profissional'
    },
  ];

  const handleNav = (item: any) => {
    if (!item.allowed) {
        alert(`O módulo ${item.label} está disponível apenas no plano ${item.reqLabel} ou superior.\n\nSeu plano atual: ${currentUser.plan}`);
        return;
    }
    setView(item.id);
    setIsOpen(false);
  };

  const isElevated = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 transform transition-all duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20">F</div>
            <div>
                <span className="font-black text-lg tracking-tighter text-slate-900 dark:text-white block">FinanAI <span className="text-indigo-500">OS</span></span>
                {accessLevel.isTrial && (
                    <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                        <Clock size={10} /> Trial: {accessLevel.daysLeft} dias
                    </span>
                )}
            </div>
          </div>
          
          <div className="flex-1 space-y-1">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2 tracking-widest">Módulos</p>
            {menu.map(item => (
              <button 
                key={item.id} 
                onClick={() => handleNav(item)} 
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold transition-all ${
                  currentView === item.id 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' 
                    : !item.allowed
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed hover:bg-transparent'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} />
                  <span className="text-xs">{item.label}</span>
                </div>
                {!item.allowed ? (
                   <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      <Lock size={10} className="text-slate-400" />
                   </div>
                ) : (
                  currentView === item.id && <ChevronRight size={14} className="opacity-50" />
                )}
              </button>
            ))}
            
            {isElevated && (
                <div className="pt-6">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2 tracking-widest">Gestão</p>
                    <button onClick={() => handleNav({id: AppView.ADMIN, allowed: true})} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${currentView === AppView.ADMIN ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <Shield size={18} />
                        <span className="text-xs">{currentUser.role === 'MANAGER' ? t.master_panel : t.admin_panel}</span>
                    </button>
                </div>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 mb-3 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                    <Crown size={14} className={accessLevel.isTrial ? "text-emerald-500 animate-pulse" : "text-indigo-500"} />
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                        {accessLevel.isTrial ? 'Enterprise Trial' : `Plano ${currentUser.plan}`}
                    </span>
                </div>
                {!accessLevel.isTrial && currentUser.plan === 'FREE' && (
                    <p className="text-[9px] text-slate-400 leading-tight">Faça upgrade para liberar recursos.</p>
                )}
            </div>

            <div className="flex items-center gap-3 mb-4 px-1">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center font-black text-xs uppercase">
                  {(currentUser.username || '??').substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                  <p className="text-xs font-black truncate text-slate-800 dark:text-white">{currentUser.username}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[120px]">ID: {currentUser.access_key ? '***' + currentUser.access_key.slice(-4) : '...'}</p>
              </div>
            </div>
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all font-bold text-xs">
                <LogOut size={18} /> {t.logout}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
