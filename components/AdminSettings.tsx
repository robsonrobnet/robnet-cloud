
import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Building2, Tags, Settings, Plus, Edit, Trash2, 
  Save, X, CheckCircle2, AlertTriangle, Database, Activity, Brain, Key, Server, Lock, FileText, Loader2, RefreshCw, Skull, Eraser, AlertOctagon, Download, Terminal, Unlock
} from 'lucide-react';
import { supabase, formatSupabaseError, updateSupabaseConfig } from '../lib/supabase';
import { User, Company, Category, UserRole, UserPlan, Language } from '../types';

interface AdminSettingsProps {
  currentUser: User;
  t: any;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  fetchData: () => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ 
  currentUser, t, language, onLanguageChange, fetchData 
}) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'COMPANIES' | 'CATEGORIES' | 'SYSTEM' | 'MASTER'>('USERS');
  const [isLoading, setIsLoading] = useState(false);
  const [masterPass, setMasterPass] = useState('');
  const [isMasterUnlocked, setIsMasterUnlocked] = useState(false);

  // Data States
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Config States
  const [sysConfig, setSysConfig] = useState({
    dbUrl: localStorage.getItem('finanai_db_url') || '',
    dbKey: localStorage.getItem('finanai_db_key') || ''
  });

  // Edit States
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [editPassword, setEditPassword] = useState('');

  // SCRIPT SQL COMPLETO PARA SUPABASE
  const FULL_SQL_SCRIPT = `-- FINANAI OS v6.0 - FULL DATABASE SETUP
-- Execute este script no SQL Editor do Supabase para montar a estrutura do zero.

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA: COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'FREE' CHECK (plan IN ('FREE', 'START', 'PRO', 'ENTERPRISE')),
  cnpj TEXT,
  owner_id UUID,
  scheduled_deletion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  document_number TEXT,
  access_key TEXT UNIQUE,
  role TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'MANAGER')),
  language TEXT DEFAULT 'pt',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA: CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'Tag',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA: TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, 
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category TEXT, 
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('INCOME', 'EXPENSE')),
  status TEXT DEFAULT 'PAID' CHECK (status IN ('PAID', 'PENDING', 'OVERDUE')),
  cost_type TEXT DEFAULT 'VARIABLE',
  scope TEXT DEFAULT 'BUSINESS',
  date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  is_recurring BOOLEAN DEFAULT FALSE,
  installment_current INTEGER, 
  installment_total INTEGER, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA: CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT,
  content TEXT NOT NULL,
  timestamp BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELAS NFSe
CREATE TABLE IF NOT EXISTS public.nfse_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  im TEXT,
  rps_series TEXT DEFAULT '1',
  last_rps_number INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.nfse_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  doc_number TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DESABILITAR RLS PARA TESTES RÁPIDOS
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse_clients DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
`;

  useEffect(() => {
    fetchAdminData();
  }, [currentUser]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const { data: u } = await supabase.from('users').select('*').eq('company_id', currentUser.company_id);
      const { data: c } = await supabase.from('companies').select('*').eq('id', currentUser.company_id);
      const { data: cat } = await supabase.from('categories').select('*').eq('company_id', currentUser.company_id);
      setUsers(u || []);
      setCompanies(c || []);
      setCategories(cat || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPass === '2298R@bnet') {
      setIsMasterUnlocked(true);
      setMasterPass('');
    } else {
      alert("Senha Master incorreta. Operação cancelada.");
      setMasterPass('');
    }
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([FULL_SQL_SCRIPT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finanai_full_setup.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    alert("Script SQL gerado com sucesso! Use-o no SQL Editor do Supabase.");
  };

  const handleClearTransactions = async () => {
    const confirmText = "LIMPAR";
    const userInput = prompt(`AVISO DE LIMPEZA\nDigite "${confirmText}" para apagar TODOS os lançamentos da empresa:`);
    if (userInput !== confirmText) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('company_id', currentUser.company_id);
      if (error) throw error;
      alert("Operação concluída: Todos os lançamentos foram apagados.");
      fetchData();
    } catch (e: any) {
      alert("Erro ao limpar dados: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImmediateMasterDelete = async () => {
    const confirmText = "DELETAR TUDO";
    const userInput = prompt(`ZONA DE PERIGO\nDigite "${confirmText}" para apagar a empresa e todos os dados vinculados AGORA:`);
    if (userInput !== confirmText) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('companies').delete().eq('id', currentUser.company_id);
      if (error) throw error;
      alert("Conta encerrada com sucesso. Você será desconectado.");
      localStorage.removeItem('finanai_session_v3');
      window.location.reload();
    } catch (e: any) {
      alert("Erro crítico: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.id) return;
    setIsLoading(true);
    try {
        const payload: any = { username: editingUser.username, role: editingUser.role };
        if (editPassword) payload.password = editPassword;

        const { error } = await supabase.from('users').update(payload).eq('id', editingUser.id);
        if (error) throw error;
        
        alert("Operação concluída: Usuário atualizado com sucesso.");
        setShowEditUserModal(false);
        setEditPassword('');
        fetchAdminData();
    } catch (e: any) {
        alert("Erro ao atualizar: " + formatSupabaseError(e));
    } finally {
        setIsLoading(false);
    }
  };

  const isOwner = companies.find(c => c.id === currentUser.company_id)?.owner_id === currentUser.id;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px]"></div>
         <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-5">
               <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                  <Shield size={28} />
               </div>
               <div>
                  <h2 className="text-xl font-black tracking-tight">{currentUser.role === 'MANAGER' ? 'Gestão Master' : 'Painel Admin'}</h2>
                  <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mt-1">Configurações de Infraestrutura</p>
               </div>
            </div>
         </div>
      </div>

      {/* TABS */}
      <div className="flex p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-lg overflow-x-auto">
         {[
            { id: 'USERS', label: 'Usuários', icon: Users },
            { id: 'SYSTEM', label: 'Conexão DB', icon: Server },
            { id: 'MASTER', label: 'Console Master', icon: Terminal }
         ].map(tab => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
               }`}
            >
               <tab.icon size={14} /> {tab.label}
            </button>
         ))}
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-xl min-h-[400px]">
         
         {activeTab === 'USERS' && (
            <div className="space-y-4">
               <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Controle de Terminais</h3>
               <div className="space-y-2">
                  {users.map(u => (
                     <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xs uppercase">{u.username.substring(0,2)}</div>
                           <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-white">{u.username}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{u.role} • {new Date(u.created_at).toLocaleDateString()}</p>
                           </div>
                        </div>
                        <button onClick={() => { setEditingUser(u); setShowEditUserModal(true); }} className="p-2 text-slate-400 hover:text-indigo-500 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 transition-all"><Edit size={16}/></button>
                     </div>
                  ))}
               </div>
            </div>
         )}

         {activeTab === 'SYSTEM' && (
             <div className="space-y-6 animate-in fade-in">
                 <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2"><Server size={16}/> Configurações de Conexão</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Database Project URL</label>
                         <input className="w-full bg-white dark:bg-slate-900 border rounded-xl p-3 text-xs font-bold mt-1" value={sysConfig.dbUrl} onChange={e => setSysConfig({...sysConfig, dbUrl: e.target.value})} />
                     </div>
                     <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anon Public Key</label>
                         <input type="password" className="w-full bg-white dark:bg-slate-900 border rounded-xl p-3 text-xs font-bold mt-1" value={sysConfig.dbKey} onChange={e => setSysConfig({...sysConfig, dbKey: e.target.value})} />
                     </div>
                 </div>
                 <button onClick={() => { updateSupabaseConfig(sysConfig.dbUrl, sysConfig.dbKey); alert("Operação concluída: Credenciais de banco atualizadas localmente."); }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-black uppercase text-xs shadow-md">Atualizar Conexões</button>
             </div>
         )}

         {activeTab === 'MASTER' && (
             <div className="animate-in fade-in">
                 {!isMasterUnlocked ? (
                     <div className="max-w-md mx-auto py-12 text-center">
                         <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-rose-100 dark:border-rose-900/30"><Lock size={40}/></div>
                         <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Console de Segurança (Master)</h3>
                         <p className="text-xs text-slate-400 mt-2 mb-8">Digite a senha para acessar ferramentas de infraestrutura e limpeza.</p>
                         <form onSubmit={handleUnlockMaster} className="space-y-4">
                             <input 
                                type="password" 
                                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center text-sm font-black outline-none focus:ring-4 focus:ring-rose-500/10 tracking-[0.5em]" 
                                placeholder="••••••••" 
                                value={masterPass}
                                onChange={e => setMasterPass(e.target.value)}
                             />
                             <button className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-rose-600 dark:hover:bg-rose-500 transition-all shadow-lg">
                                 <Unlock size={16}/> Desbloquear Console
                             </button>
                         </form>
                     </div>
                 ) : (
                     <div className="space-y-8 animate-in slide-in-from-top-4">
                         <div className="bg-indigo-50 dark:bg-indigo-950/30 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                             <div className="flex items-center justify-between mb-6">
                                 <div>
                                     <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <Database size={20} /> Script SQL de Montagem
                                     </h3>
                                     <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">Gere o código para montar todo o banco Supabase em um novo projeto.</p>
                                 </div>
                                 <button onClick={handleDownloadSQL} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg transition-all">
                                     <Download size={14}/> Baixar Script SQL
                                 </button>
                             </div>
                             <div className="bg-slate-900 rounded-2xl p-5 overflow-hidden border border-slate-800 shadow-inner font-mono text-[10px] text-emerald-500">
                                 -- Script de criação de tabelas, índices e relações.<br/>
                                 -- Inclui transações, categorias e módulo fiscal.
                             </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                             <div className="bg-amber-50 dark:bg-amber-950/20 p-8 rounded-[2.5rem] border border-amber-200 dark:border-amber-800/30">
                                 <h3 className="text-sm font-black text-amber-600 uppercase tracking-widest flex items-center gap-2 mb-4"><Eraser size={18} /> Limpar Lançamentos</h3>
                                 <p className="text-xs text-amber-800 dark:text-amber-400 font-medium mb-6 leading-relaxed">Apaga todas as transações financeiras. Preserva usuários e cadastros.</p>
                                 <button onClick={handleClearTransactions} disabled={isLoading} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 transition-all">
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />} Executar Limpeza
                                 </button>
                             </div>

                             <div className="bg-rose-50 dark:bg-rose-950/20 p-8 rounded-[2.5rem] border border-rose-200 dark:border-rose-800/30">
                                 <h3 className="text-sm font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 mb-4"><Skull size={18} /> Master Reset</h3>
                                 <p className="text-xs text-rose-800 dark:text-rose-400 font-medium mb-6 leading-relaxed">Destruição total da empresa no banco de dados. Irreversível.</p>
                                 <button onClick={handleImmediateMasterDelete} disabled={isLoading} className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 transition-all">
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <AlertOctagon size={16} />} Apagar Tudo Agora
                                 </button>
                             </div>
                         </div>
                         <div className="text-center pt-4"><button onClick={() => setIsMasterUnlocked(false)} className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors">Bloquear Console</button></div>
                     </div>
                 )}
             </div>
         )}
      </div>

      {/* MODAL EDIT USER */}
      {showEditUserModal && editingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                  <button onClick={() => setShowEditUserModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                  <div className="mb-6 flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center"><Edit size={24} /></div>
                      <h3 className="text-xl font-black">Editar Usuário</h3>
                  </div>
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} required />
                      <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                          <option value="USER">Padrão</option>
                          <option value="ADMIN">Admin</option>
                          <option value="MANAGER">Manager</option>
                      </select>
                      <input type="password" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold" placeholder="Nova Senha (opcional)" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                      <button disabled={isLoading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 rounded-xl font-black uppercase text-xs shadow-lg">
                          {isLoading ? <Loader2 className="animate-spin" size={16}/> : 'Salvar Alterações'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminSettings;
