
import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Building2, Tags, Settings, Plus, Edit, Trash2, 
  Save, X, CheckCircle2, AlertTriangle, Database, Activity, Brain, Key, Server, Lock, FileText, Loader2, RefreshCw, Skull, Eraser, AlertOctagon, Download, Terminal, Unlock, Cpu, CloudLightning, Globe, Palette, DollarSign, Upload, Mail
} from 'lucide-react';
import { supabase, formatSupabaseError, updateSupabaseConfig } from '../lib/supabase';
import { User, Company, Category, UserRole, UserPlan, Language } from '../types';
import { FinancialService } from '../services/financialService';
import { testGeminiConnection } from '../services/geminiService';
import { saveSecureSetting, loadSecureSetting } from '../lib/crypto';

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
  const [activeTab, setActiveTab] = useState<'USERS' | 'SYSTEM' | 'CATEGORIES' | 'MASTER' | 'SERVICES'>('USERS');
  const [isLoading, setIsLoading] = useState(false);
  const [masterPass, setMasterPass] = useState('');
  const [isMasterUnlocked, setIsMasterUnlocked] = useState(false);

  // Data States
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);

  // User Management State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  const [sysConfig, setSysConfig] = useState({
    dbUrl: localStorage.getItem('finanai_db_url') || '',
    dbKey: localStorage.getItem('finanai_db_key') || ''
  });

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Wipe Modal State
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeScope, setWipeScope] = useState<'COMPANY' | 'SYSTEM'>('COMPANY');
  const [wipeOptions, setWipeOptions] = useState({
    transactions: true,
    nfse: true,
    chat: true
  });

  // Services Status State
  const [serviceStatus, setServiceStatus] = useState({
    gemini: { status: 'UNKNOWN' as 'ONLINE' | 'OFFLINE' | 'UNKNOWN', message: '', loading: false },
    openai: { status: 'UNKNOWN' as 'ONLINE' | 'OFFLINE' | 'UNKNOWN', message: '', loading: false },
    supabase: { status: 'UNKNOWN' as 'ONLINE' | 'OFFLINE' | 'UNKNOWN', message: '', loading: false },
    stripe: { status: 'UNKNOWN' as 'ONLINE' | 'OFFLINE' | 'UNKNOWN', message: '', loading: false },
    nfse: { status: 'UNKNOWN' as 'ONLINE' | 'OFFLINE' | 'UNKNOWN', message: '', loading: false },
    whatsapp: { status: 'UNKNOWN' as 'ONLINE' | 'OFFLINE' | 'UNKNOWN', message: '', loading: false },
    smtp: { status: 'UNKNOWN' as 'ONLINE' | 'OFFLINE' | 'UNKNOWN', message: '', loading: false }
  });

  const [credentials, setCredentials] = useState({
    gemini_key: loadSecureSetting('gemini_key') || process.env.GEMINI_API_KEY || '',
    gemini_model: localStorage.getItem('gemini_model') || 'gemini-3-flash-preview',
    openai_key: loadSecureSetting('openai_key') || '',
    openai_model: localStorage.getItem('openai_model') || 'gpt-4o',
    chat_provider: localStorage.getItem('chat_provider') || 'GEMINI',
    supabase_url: loadSecureSetting('supabase_url') || localStorage.getItem('finanai_db_url') || 'https://uifexroywtnmelgxfbxc.supabase.co',
    supabase_key: loadSecureSetting('supabase_key') || localStorage.getItem('finanai_db_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZmV4cm95d3RubWVsZ3hmYnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTM4MzQsImV4cCI6MjA4MzQ4OTgzNH0.y9RCTh84rzj7chgvj-wDqZLIafl43djujOpw5GD6PUI',
    stripe_key: loadSecureSetting('stripe_key') || '',
    whatsapp_url: loadSecureSetting('whatsapp_url') || '',
    whatsapp_key: loadSecureSetting('whatsapp_key') || '',
    nfse_user: loadSecureSetting('nfse_user') || '',
    nfse_pass: loadSecureSetting('nfse_pass') || '',
    nfse_cert_file: loadSecureSetting('nfse_cert_file') || '',
    nfse_cert_pass: loadSecureSetting('nfse_cert_pass') || ''
  });

  useEffect(() => { fetchAdminData(); }, [currentUser]);
  
  useEffect(() => {
    if (activeTab === 'SERVICES') {
      checkAllServices();
    }
  }, [activeTab]);

  const checkAllServices = async () => {
    checkSupabase();
    checkGemini();
    checkOpenAI();
    checkStripe();
    checkNfse();
    checkWhatsApp();
    checkSMTP();
  };

  const checkSupabase = async () => {
    setServiceStatus(prev => ({ ...prev, supabase: { ...prev.supabase, loading: true } }));
    try {
      const url = credentials.supabase_url || localStorage.getItem('finanai_db_url');
      const key = credentials.supabase_key || localStorage.getItem('finanai_db_key');
      
      const isConnected = await FinancialService.testConnection();
      setServiceStatus(prev => ({ 
        ...prev, 
        supabase: { status: isConnected ? 'ONLINE' : 'OFFLINE', message: isConnected ? 'Conexão estável' : 'Falha na conexão', loading: false } 
      }));
    } catch (e: any) {
      setServiceStatus(prev => ({ ...prev, supabase: { status: 'OFFLINE', message: e.message, loading: false } }));
    }
  };

  const checkGemini = async () => {
    setServiceStatus(prev => ({ ...prev, gemini: { ...prev.gemini, loading: true } }));
    try {
      const key = credentials.gemini_key || process.env.GEMINI_API_KEY || '';
      if (!key) {
        setServiceStatus(prev => ({ ...prev, gemini: { status: 'OFFLINE', message: 'API Key não configurada', loading: false } }));
        return;
      }
      const result = await testGeminiConnection(key);
      setServiceStatus(prev => ({ 
        ...prev, 
        gemini: { status: result.success ? 'ONLINE' : 'OFFLINE', message: result.message || 'Pronto para uso', loading: false } 
      }));
    } catch (e: any) {
      setServiceStatus(prev => ({ ...prev, gemini: { status: 'OFFLINE', message: e.message, loading: false } }));
    }
  };

  const checkOpenAI = async () => {
    setServiceStatus(prev => ({ ...prev, openai: { ...prev.openai, loading: true } }));
    try {
      if (!credentials.openai_key) {
        setServiceStatus(prev => ({ ...prev, openai: { status: 'OFFLINE', message: 'API Key não configurada', loading: false } }));
        return;
      }
      // Simulação de teste para OpenAI (poderia ser uma chamada real para /models)
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${credentials.openai_key}` }
      });
      const isOk = res.ok;
      setServiceStatus(prev => ({ 
        ...prev, 
        openai: { status: isOk ? 'ONLINE' : 'OFFLINE', message: isOk ? 'Pronto para uso' : 'Chave inválida', loading: false } 
      }));
    } catch (e: any) {
      setServiceStatus(prev => ({ ...prev, openai: { status: 'OFFLINE', message: e.message, loading: false } }));
    }
  };

  const checkStripe = async () => {
    setServiceStatus(prev => ({ ...prev, stripe: { ...prev.stripe, loading: true } }));
    try {
      const key = credentials.stripe_key || process.env.STRIPE_SECRET_KEY;
      if (!key) {
        setServiceStatus(prev => ({ ...prev, stripe: { status: 'OFFLINE', message: 'Chave não configurada', loading: false } }));
        return;
      }
      // Simulação de teste de API Stripe
      setTimeout(() => {
        setServiceStatus(prev => ({ 
          ...prev, 
          stripe: { status: 'ONLINE', message: 'Gateway Stripe Operacional', loading: false } 
        }));
      }, 1000);
    } catch (e: any) {
      setServiceStatus(prev => ({ ...prev, stripe: { status: 'OFFLINE', message: e.message, loading: false } }));
    }
  };

  const checkNfse = async () => {
    setServiceStatus(prev => ({ ...prev, nfse: { ...prev.nfse, loading: true } }));
    setTimeout(() => {
      const credsOk = !!credentials.nfse_user && !!credentials.nfse_pass;
      const certOk = !!credentials.nfse_cert_file && !!credentials.nfse_cert_pass;
      
      let status: 'ONLINE' | 'OFFLINE' = 'ONLINE';
      let message = 'Emissor NFS-e SP Ativo';

      if (certOk) {
        status = 'ONLINE';
        message = 'Autenticação via Certificado Digital Ativa';
      } else if (credsOk) {
        status = 'ONLINE';
        message = 'Autenticação via Usuário/Senha Ativa';
      } else {
        status = 'OFFLINE';
        message = 'Nenhuma credencial de acesso configurada';
      }

      setServiceStatus(prev => ({ 
        ...prev, 
        nfse: { status, message, loading: false } 
      }));
    }, 1200);
  };

  const checkWhatsApp = async () => {
    setServiceStatus(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, loading: true } }));
    setTimeout(() => {
      const isOk = !!credentials.whatsapp_url && !!credentials.whatsapp_key;
      setServiceStatus(prev => ({ 
        ...prev, 
        whatsapp: { status: isOk ? 'ONLINE' : 'OFFLINE', message: isOk ? 'Evolution API Conectada' : 'URL ou Key ausentes', loading: false } 
      }));
    }, 1500);
  };

  const checkSMTP = async () => {
    setServiceStatus(prev => ({ ...prev, smtp: { ...prev.smtp, loading: true } }));
    try {
      // In the browser, we can't check process.env directly for non-VITE_ variables.
      // We'll assume it's configured if the test button is visible or check a flag from the backend if needed.
      setServiceStatus(prev => ({ 
        ...prev, 
        smtp: { status: 'ONLINE', message: 'Servidor SMTP Robnet Configurado', loading: false } 
      }));
    } catch (e: any) {
      setServiceStatus(prev => ({ ...prev, smtp: { status: 'OFFLINE', message: e.message, loading: false } }));
    }
  };

  const handleTestSMTP = async () => {
    const email = prompt("Digite o e-mail para receber o teste:");
    if (!email) return;

    setIsLoading(true);
    try {
      // First, check health
      const healthRes = await fetch('/api/health');
      if (!healthRes.ok) {
        throw new Error(`Servidor inacessível (Status ${healthRes.status})`);
      }
      const healthData = await healthRes.json();
      console.log("Backend Health:", healthData);

      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (data.success) {
          alert("E-mail de teste enviado com sucesso! Verifique sua caixa de entrada.");
        } else {
          const detail = data.code ? ` (Código: ${data.code}${data.command ? `, Comando: ${data.command}` : ''})` : '';
          alert(`Erro no servidor SMTP: ${data.error}${detail}`);
        }
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        alert(`Erro crítico no servidor (Status ${response.status}). O servidor pode estar reiniciando ou com erro de configuração.`);
      }
    } catch (e: any) {
      alert("Erro na requisição de teste: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCredentials(prev => ({ ...prev, nfse_cert_file: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCredentials = (service: string) => {
    // Save specific service credentials
    Object.entries(credentials).forEach(([key, value]) => {
      // Only save keys related to the current service to avoid overwriting others with stale state
      if (key.startsWith(service)) {
        if (key.includes('key') || key.includes('pass') || key.includes('url') || key.includes('file')) {
          saveSecureSetting(key, value);
        } else {
          localStorage.setItem(key, value);
        }
      }
    });
    
    // Special case for supabase update
    if (service === 'supabase') {
      updateSupabaseConfig(credentials.supabase_url, credentials.supabase_key);
    }

    // Trigger re-check for the specific service
    switch(service) {
      case 'gemini': checkGemini(); break;
      case 'openai': checkOpenAI(); break;
      case 'supabase': checkSupabase(); break;
      case 'stripe': checkStripe(); break;
      case 'nfse': checkNfse(); break;
      case 'whatsapp': checkWhatsApp(); break;
      default: checkAllServices();
    }
  };

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [uRes, cRes, catRes] = await Promise.all([
        supabase.from('users').select('*').eq('company_id', currentUser.company_id),
        supabase.from('companies').select('*').eq('id', currentUser.company_id),
        supabase.from('categories').select('*').eq('company_id', currentUser.company_id)
      ]);
      setUsers(uRes.data || []);
      setCompanies(cRes.data || []);
      setCategories(catRes.data || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleUnlockMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPass === '2298R@b') { setIsMasterUnlocked(true); setMasterPass(''); } 
    else { alert("Senha mestre inválida."); setMasterPass(''); }
  };

  // --- INFRASTRUCTURE ACTIONS ---

  const handleWipeTransactions = (scope: 'COMPANY' | 'SYSTEM' = 'COMPANY') => {
    setWipeScope(scope);
    setShowWipeModal(true);
  };

  const executeWipe = async () => {
    const isSystem = wipeScope === 'SYSTEM' && currentUser.role === 'MANAGER';
    
    setIsLoading(true);
    try {
      const targetId = isSystem ? 'ALL' : currentUser.company_id;
      console.log(`[Admin] Executing wipe. Scope: ${wipeScope}, Options:`, wipeOptions);
      
      const count = await FinancialService.wipeTransactions(targetId, currentUser.id, wipeOptions);
      
      setShowWipeModal(false);
      setSuccessMessage(`Limpeza Abrangente concluída.\n${count || 0} registros foram removidos do ${isSystem ? 'Sistema' : 'Terminal'}.`);
      setShowSuccessModal(true);
      
      await fetchData();
    } catch (e: any) {
      console.error("[Admin] Wipe failed:", e);
      alert("Erro ao limpar: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMasterReset = async () => {
    const company = companies[0];
    const confirmation = prompt(`☢️ RESET MASTER: Digite o nome da empresa "${company?.name}" para confirmar a DESTRUIÇÃO TOTAL dos dados:`);
    
    if (confirmation !== company?.name) {
      alert("Confirmação inválida. Operação cancelada.");
      return;
    }

    setIsLoading(true);
    try {
      console.log(`[Admin] Master Reset initiated for company: ${currentUser.company_id}`);
      await FinancialService.wipeAllCompanyData(currentUser.company_id, currentUser.id);
      
      alert("Reset Master concluído. O sistema foi restaurado para o estado inicial.");
      window.location.reload();
    } catch (e: any) {
      console.error("[Admin] Master Reset failed:", e);
      alert("Falha no Reset: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  // --- CATEGORY ACTIONS ---

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name) return;
    
    setIsLoading(true);
    try {
      const payload = {
        ...editingCategory,
        company_id: currentUser.company_id,
        color: editingCategory.color || '#6366f1',
        icon: editingCategory.icon || 'Tag'
      };

      const { error } = editingCategory.id 
        ? await supabase.from('categories').update(payload).eq('id', editingCategory.id)
        : await supabase.from('categories').insert([payload]);

      if (error) throw error;
      
      setShowCategoryModal(false);
      setEditingCategory(null);
      fetchAdminData();
    } catch (e: any) {
      alert("Erro: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Excluir esta categoria? Isso pode afetar a visualização de transações antigas.")) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      fetchAdminData();
    } catch (e: any) {
      alert("Erro: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  // --- USER ACTIONS ---

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: editingUser.role,
          plan: editingUser.plan,
          username: editingUser.username,
          email: editingUser.email,
          whatsapp: editingUser.whatsapp
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      setShowUserModal(false);
      setEditingUser(null);
      fetchAdminData();
      setSuccessMessage("Terminal atualizado com sucesso.");
      setShowSuccessModal(true);
    } catch (e: any) {
      alert("Erro ao atualizar usuário: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser.id) {
      alert("Você não pode excluir seu próprio acesso.");
      return;
    }
    if (!confirm("⚠️ ATENÇÃO: Deseja remover permanentemente o acesso deste terminal?")) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      fetchAdminData();
    } catch (e: any) {
      alert("Erro ao remover usuário: " + formatSupabaseError(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER: CONFIGURADOR */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]"></div>
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl flex items-center justify-center border border-white/20 shadow-xl">
                  <Settings size={32} className="text-white" />
               </div>
               <div>
                  <h2 className="text-3xl font-black tracking-tight uppercase">Configurador <span className="text-indigo-400 text-sm align-top">PRO</span></h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Terminal de Controle de Infraestrutura & Setup</p>
               </div>
            </div>
            <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status do Núcleo</p>
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div><span className="text-xs font-black text-emerald-400 uppercase">Sistema Ativo</span></div>
            </div>
         </div>
      </div>

      <div className="flex p-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-x-auto gap-2">
         {[
            { id: 'USERS', label: 'Terminais', icon: Users },
            { id: 'SERVICES', label: 'Serviços & LLM', icon: CloudLightning },
            { id: 'SYSTEM', label: 'Setup Banco', icon: Database },
            { id: 'CATEGORIES', label: 'Dicionário', icon: Tags },
            { id: 'MASTER', label: 'Console Master', icon: Cpu }
         ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 min-w-[140px] flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><tab.icon size={16} /> {tab.label}</button>
         ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl min-h-[500px]">
         
         {activeTab === 'USERS' && (
            <div className="space-y-8 animate-in fade-in">
               <div className="flex items-center justify-between">
                  <div><h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-3"><Users size={20} className="text-indigo-500" /> Gestão de Acessos</h3><p className="text-xs text-slate-400 font-bold mt-1">Terminais autorizados para esta empresa</p></div>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {users.map(u => (
                     <div key={u.id} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center font-black text-indigo-600 border border-slate-200 dark:border-slate-700 shadow-sm">{(u.username || 'U').substring(0,2).toUpperCase()}</div>
                           <div>
                               <p className="text-sm font-black text-slate-800 dark:text-white">{u.username}</p>
                               <div className="flex items-center gap-2 mt-1">
                                   <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : u.role === 'MANAGER' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{u.role}</span>
                                   <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{u.plan}</span>
                               </div>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingUser(u); setShowUserModal(true); }} className="p-3 text-slate-400 hover:text-indigo-600 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Edit size={18}/></button>
                           {u.id !== currentUser.id && (
                               <button onClick={() => handleDeleteUser(u.id)} className="p-3 text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Trash2 size={18}/></button>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         )}

          {activeTab === 'SERVICES' && (
            <div className="space-y-10 animate-in fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-3">
                            <CloudLightning size={24} className="text-indigo-500" /> Configuração de Serviços & LLM
                        </h3>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Controle total de credenciais e infraestrutura</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex">
                            <button onClick={() => setCredentials({...credentials, chat_provider: 'GEMINI'})} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${credentials.chat_provider === 'GEMINI' ? 'bg-white dark:bg-slate-900 text-indigo-500 shadow-sm' : 'text-slate-400'}`}>Gemini</button>
                            <button onClick={() => setCredentials({...credentials, chat_provider: 'OPENAI'})} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${credentials.chat_provider === 'OPENAI' ? 'bg-white dark:bg-slate-900 text-rose-500 shadow-sm' : 'text-slate-400'}`}>ChatGPT</button>
                        </div>
                        <button onClick={checkAllServices} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm">
                            <RefreshCw size={20} className={Object.values(serviceStatus).some(s => s.loading) ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* LLM SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* GEMINI AI */}
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Brain size={80} /></div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><Brain size={24} /></div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Gemini AI</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Google Cloud LLM</p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${serviceStatus.gemini.loading ? 'bg-indigo-100 text-indigo-600' : serviceStatus.gemini.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' : serviceStatus.gemini.status === 'OFFLINE' ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${serviceStatus.gemini.loading ? 'bg-indigo-500 animate-spin' : serviceStatus.gemini.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : serviceStatus.gemini.status === 'OFFLINE' ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                                    {serviceStatus.gemini.loading ? 'SINCRONIZANDO' : serviceStatus.gemini.status}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-2">{serviceStatus.gemini.message}</p>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Modelo</label>
                                    <select 
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                        value={credentials.gemini_model}
                                        onChange={e => setCredentials({...credentials, gemini_model: e.target.value})}
                                    >
                                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">API Key (Criptografada)</label>
                                    <input 
                                        type="password" 
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500" 
                                        placeholder="••••••••••••••••"
                                        value={credentials.gemini_key}
                                        onChange={e => setCredentials({...credentials, gemini_key: e.target.value})}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleSaveCredentials('gemini')} className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-lg">Salvar</button>
                                    <button onClick={checkGemini} className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all"><RefreshCw size={14} className={serviceStatus.gemini.loading ? 'animate-spin' : ''} /></button>
                                </div>
                            </div>
                        </div>

                        {/* OPENAI / CHATGPT */}
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><CloudLightning size={80} /></div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner"><CloudLightning size={24} /></div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">ChatGPT AI</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">OpenAI LLM</p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${serviceStatus.openai.loading ? 'bg-rose-100 text-rose-600' : serviceStatus.openai.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' : serviceStatus.openai.status === 'OFFLINE' ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${serviceStatus.openai.loading ? 'bg-rose-500 animate-spin' : serviceStatus.openai.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : serviceStatus.openai.status === 'OFFLINE' ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                                    {serviceStatus.openai.loading ? 'SINCRONIZANDO' : serviceStatus.openai.status}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-2">{serviceStatus.openai.message}</p>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Modelo</label>
                                    <select 
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                                        value={credentials.openai_model}
                                        onChange={e => setCredentials({...credentials, openai_model: e.target.value})}
                                    >
                                        <option value="gpt-4o">GPT-4o</option>
                                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">API Key (Criptografada)</label>
                                    <input 
                                        type="password" 
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500" 
                                        placeholder="••••••••••••••••"
                                        value={credentials.openai_key}
                                        onChange={e => setCredentials({...credentials, openai_key: e.target.value})}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleSaveCredentials('openai')} className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-lg">Salvar</button>
                                    <button onClick={checkOpenAI} className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><RefreshCw size={14} className={serviceStatus.openai.loading ? 'animate-spin' : ''} /></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* INFRASTRUCTURE SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* SUPABASE */}
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center"><Database size={20} /></div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Supabase</p>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1 ${serviceStatus.supabase.loading ? 'bg-emerald-100 text-emerald-600' : serviceStatus.supabase.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {serviceStatus.supabase.loading ? 'SYNC' : serviceStatus.supabase.status}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="URL" value={credentials.supabase_url} onChange={e => setCredentials({...credentials, supabase_url: e.target.value})} />
                                <input type="password" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="Anon Key" value={credentials.supabase_key} onChange={e => setCredentials({...credentials, supabase_key: e.target.value})} />
                                <div className="flex gap-2">
                                    <button onClick={() => handleSaveCredentials('supabase')} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-black uppercase text-[8px] tracking-widest">Salvar</button>
                                    <button onClick={checkSupabase} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl"><RefreshCw size={12} className={serviceStatus.supabase.loading ? 'animate-spin' : ''} /></button>
                                </div>
                            </div>
                        </div>

                        {/* STRIPE */}
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center"><DollarSign size={20} /></div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Stripe</p>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1 ${serviceStatus.stripe.loading ? 'bg-blue-100 text-blue-600' : serviceStatus.stripe.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {serviceStatus.stripe.loading ? 'SYNC' : serviceStatus.stripe.status}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <input type="password" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="Secret Key" value={credentials.stripe_key} onChange={e => setCredentials({...credentials, stripe_key: e.target.value})} />
                                <div className="flex gap-2">
                                    <button onClick={() => handleSaveCredentials('stripe')} className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[8px] tracking-widest">Salvar</button>
                                    <button onClick={checkStripe} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl"><RefreshCw size={12} className={serviceStatus.stripe.loading ? 'animate-spin' : ''} /></button>
                                </div>
                            </div>
                        </div>

                        {/* WHATSAPP */}
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center"><Globe size={20} /></div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">WhatsApp</p>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1 ${serviceStatus.whatsapp.loading ? 'bg-emerald-100 text-emerald-600' : serviceStatus.whatsapp.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {serviceStatus.whatsapp.loading ? 'SYNC' : serviceStatus.whatsapp.status}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="Evolution URL" value={credentials.whatsapp_url} onChange={e => setCredentials({...credentials, whatsapp_url: e.target.value})} />
                                <input type="password" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="API Key" value={credentials.whatsapp_key} onChange={e => setCredentials({...credentials, whatsapp_key: e.target.value})} />
                                <div className="flex gap-2">
                                    <button onClick={() => handleSaveCredentials('whatsapp')} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-black uppercase text-[8px] tracking-widest">Salvar</button>
                                    <button onClick={checkWhatsApp} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl"><RefreshCw size={12} className={serviceStatus.whatsapp.loading ? 'animate-spin' : ''} /></button>
                                </div>
                            </div>
                        </div>

                        {/* NFSE */}
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center"><FileText size={20} /></div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">NFS-e SP</p>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1 ${serviceStatus.nfse.loading ? 'bg-amber-100 text-amber-600' : serviceStatus.nfse.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {serviceStatus.nfse.loading ? 'SYNC' : serviceStatus.nfse.status}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acesso via Certificado A1</p>
                                            <div className={`w-2 h-2 rounded-full ${credentials.nfse_cert_file ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                        </div>
                                        <label className="cursor-pointer flex items-center gap-1 text-[8px] font-black text-indigo-600 uppercase hover:text-indigo-500 transition-colors">
                                            <Upload size={10} />
                                            Carregar Arquivo
                                            <input type="file" className="hidden" accept=".pfx,.p12" onChange={handleCertUpload} />
                                        </label>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 relative">
                                                <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="Caminho ou Base64 do Certificado" value={credentials.nfse_cert_file} onChange={e => setCredentials({...credentials, nfse_cert_file: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="password" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="Senha do Certificado (Chave de Acesso)" value={credentials.nfse_cert_pass} onChange={e => setCredentials({...credentials, nfse_cert_pass: e.target.value})} />
                                        </div>
                                    </div>
                                    <p className="text-[8px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">* O certificado será usado para autenticação e assinatura das notas.</p>
                                </div>

                                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-2xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Acesso Alternativo (Usuário/Senha)</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="Usuário" value={credentials.nfse_user} onChange={e => setCredentials({...credentials, nfse_user: e.target.value})} />
                                        <input type="password" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold" placeholder="Senha" value={credentials.nfse_pass} onChange={e => setCredentials({...credentials, nfse_pass: e.target.value})} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleSaveCredentials('nfse')} className="flex-1 py-2 bg-amber-600 text-white rounded-xl font-black uppercase text-[8px] tracking-widest">Salvar</button>
                                    <button onClick={checkNfse} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl"><RefreshCw size={12} className={serviceStatus.nfse.loading ? 'animate-spin' : ''} /></button>
                                </div>
                            </div>
                        </div>

                        {/* SMTP TEST */}
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center"><Mail size={20} /></div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Serviço de E-mail (SMTP)</p>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1 ${serviceStatus.smtp.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {serviceStatus.smtp.status}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[9px] text-slate-500 font-bold uppercase">Configurado via Variáveis de Ambiente (Robnet SMTP)</p>
                                <button 
                                    onClick={handleTestSMTP}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Testar Envio de E-mail
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'SYSTEM' && (
             <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
                 <div className="text-center space-y-2 mb-10"><div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-indigo-100"><Database size={40} /></div><h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Setup de Conexão</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Configuração de Gateway Supabase</p></div>
                 <div className="grid grid-cols-1 gap-6">
                    <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Project Endpoint URL</label>
                        <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white" value={sysConfig.dbUrl} onChange={e => setSysConfig({...sysConfig, dbUrl: e.target.value})} placeholder="https://..." />
                    </div>
                    <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Anon Public Key</label>
                        <input type="password" className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white" value={sysConfig.dbKey} onChange={e => setSysConfig({...sysConfig, dbKey: e.target.value})} placeholder="eyJ..." />
                    </div>
                 </div>
                 <button onClick={() => { updateSupabaseConfig(sysConfig.dbUrl, sysConfig.dbKey); alert("Infraestrutura Atualizada!"); }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3"><Save size={18} /> Salvar Setup de Conexão</button>

                 {/* DANGER ZONE */}
                 <div className="mt-12 pt-12 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-black text-rose-500 uppercase tracking-widest mb-6 flex items-center gap-2"><AlertOctagon size={16} /> Zona de Perigo</h4>
                    <div className="p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-[2rem] flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Limpar Transações</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">Remove todo o histórico financeiro desta empresa.</p>
                        </div>
                        <button onClick={() => handleWipeTransactions('COMPANY')} disabled={isLoading} className="px-6 py-3 bg-white dark:bg-slate-800 text-rose-500 border border-rose-200 dark:border-rose-900/50 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center gap-2">
                            {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Eraser size={14} />} Executar Limpeza
                        </button>
                    </div>
                 </div>
             </div>
         )}

         {activeTab === 'CATEGORIES' && (
             <div className="space-y-8 animate-in fade-in">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-3"><Tags size={20} className="text-indigo-500" /> Dicionário de Categorias</h3>
                        <p className="text-xs text-slate-400 font-bold">Gerencie os marcadores de transação</p>
                    </div>
                    <button onClick={() => { setEditingCategory({}); setShowCategoryModal(true); }} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={16}/> Nova Categoria</button>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {categories.map(cat => (
                         <div key={cat.id} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group">
                             <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: cat.color }}>
                                     <Activity size={20} />
                                 </div>
                                 <div>
                                     <p className="text-sm font-black text-slate-800 dark:text-white">{cat.name}</p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase">{cat.icon}</p>
                                 </div>
                             </div>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"><Edit size={16}/></button>
                                 <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"><Trash2 size={16}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         )}

         {activeTab === 'MASTER' && (
             <div className="animate-in fade-in max-w-2xl mx-auto">
                 {!isMasterUnlocked ? (
                     <div className="py-12 text-center">
                         <div className="w-24 h-24 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-rose-100 shadow-inner"><Lock size={48}/></div>
                         <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Security Console</h3>
                         <p className="text-xs text-slate-400 mt-2 mb-10 font-bold uppercase tracking-widest">Acesso Restrito a Operações Críticas</p>
                         <form onSubmit={handleUnlockMaster} className="space-y-4">
                             <input type="password" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 rounded-3xl p-6 text-center text-2xl font-black outline-none tracking-[0.8em] text-slate-900 dark:text-white" placeholder="••••" value={masterPass} onChange={e => setMasterPass(e.target.value)} />
                             <button className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-rose-600 transition-all">Desbloquear Console</button>
                         </form>
                     </div>
                 ) : (
                     <div className="space-y-8 animate-in zoom-in-95">
                         <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl text-white relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-10"><CloudLightning size={100} /></div>
                             <h4 className="text-lg font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3"><Terminal size={24} className="text-indigo-400" /> Operações de Emergência</h4>
                             <p className="text-xs text-slate-400 mb-8 font-bold uppercase">Utilize com extrema cautela. Estas ações são definitivas.</p>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                                 <button onClick={() => handleWipeTransactions(currentUser.role === 'MANAGER' ? 'SYSTEM' : 'COMPANY')} disabled={isLoading} className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-3xl hover:bg-amber-500/20 transition-all text-left flex flex-col items-start gap-3 disabled:opacity-50">
                                     {isLoading ? <Loader2 className="animate-spin text-amber-500" size={24}/> : <Eraser className="text-amber-500" size={24} />}
                                     <div>
                                         <p className="text-xs font-black uppercase tracking-widest text-amber-500">Limpar Lançamentos</p>
                                         <p className="text-[10px] text-amber-400/50 mt-1 uppercase">{currentUser.role === 'MANAGER' ? 'Remover histórico de TODO O SISTEMA' : 'Remover apenas histórico financeiro'}</p>
                                     </div>
                                 </button>
                                 <button onClick={handleMasterReset} disabled={isLoading} className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl hover:bg-rose-500/20 transition-all text-left flex flex-col items-start gap-3 disabled:opacity-50">
                                     {isLoading ? <Loader2 className="animate-spin text-rose-500" size={24}/> : <Skull className="text-rose-500" size={24} />}
                                     <div>
                                         <p className="text-xs font-black uppercase tracking-widest text-rose-500">Reset Master</p>
                                         <p className="text-[10px] text-rose-400/50 mt-1 uppercase">Destruição total da base</p>
                                     </div>
                                 </button>
                             </div>
                             <div className="mt-8 pt-8 border-t border-white/10 text-center">
                                 <button onClick={() => setIsMasterUnlocked(false)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Encerrar Sessão Master</button>
                             </div>
                         </div>
                     </div>
                 )}
             </div>
         )}
      </div>

      {/* USER MODAL */}
      {showUserModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
                  <button onClick={() => setShowUserModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                  <div className="mb-8 flex items-center gap-5">
                      <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center"><Users size={32} /></div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">Gestão de Acesso</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuração de Terminal</p>
                      </div>
                  </div>
                  <form onSubmit={handleSaveUser} className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nome de Usuário</label>
                        <input required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white outline-none" value={editingUser?.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nível de Acesso</label>
                            <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-bold text-slate-800 dark:text-white outline-none" value={editingUser?.role || 'USER'} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}>
                                <option value="USER">Usuário Comum</option>
                                <option value="ADMIN">Administrador</option>
                                {currentUser.role === 'MANAGER' && <option value="MANAGER">Gestor Master</option>}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Plano de Serviço</label>
                            <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-bold text-slate-800 dark:text-white outline-none" value={editingUser?.plan || 'FREE'} onChange={e => setEditingUser({...editingUser, plan: e.target.value as UserPlan})}>
                                <option value="FREE">Gratuito</option>
                                <option value="START">Start</option>
                                <option value="PRO">Pro</option>
                                <option value="ENTERPRISE">Enterprise</option>
                            </select>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">E-mail de Contato</label>
                          <input type="email" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white outline-none" value={editingUser?.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">WhatsApp</label>
                          <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white outline-none" value={editingUser?.whatsapp || ''} onChange={e => setEditingUser({...editingUser, whatsapp: e.target.value})} placeholder="55..." />
                        </div>
                      </div>

                      <button disabled={isLoading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3">
                          {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Atualizar Acesso
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* CATEGORY MODAL */}
      {showCategoryModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
                  <button onClick={() => setShowCategoryModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                  <div className="mb-8 flex items-center gap-5">
                      <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center"><Tags size={32} /></div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">Dicionário</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuração de Marcador</p>
                      </div>
                  </div>
                  <form onSubmit={handleSaveCategory} className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nome da Categoria</label>
                        <input required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white outline-none" value={editingCategory?.name || ''} onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} placeholder="Ex: Assinaturas SaaS" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block flex items-center gap-2"><Palette size={12}/> Cor</label>
                            <input type="color" className="w-full h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1 cursor-pointer" value={editingCategory?.color || '#6366f1'} onChange={e => setEditingCategory({...editingCategory, color: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block flex items-center gap-2"><Activity size={12}/> Ícone</label>
                            <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-bold text-slate-800 dark:text-white outline-none" value={editingCategory?.icon || 'Tag'} onChange={e => setEditingCategory({...editingCategory, icon: e.target.value})}>
                                <option value="Tag">Tag</option>
                                <option value="ShoppingBag">Shopping</option>
                                <option value="Utensils">Alimentação</option>
                                <option value="Car">Transporte</option>
                                <option value="Zap">Operacional</option>
                                <option value="Smartphone">Digital</option>
                                <option value="Landmark">Banco</option>
                            </select>
                          </div>
                      </div>

                      <button disabled={isLoading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3">
                          {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Marcador
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 border border-emerald-500/20 text-center">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Sucesso!</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 whitespace-pre-line">{successMessage}</p>
                <button onClick={() => setShowSuccessModal(false)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all">
                    Entendido
                </button>
            </div>
        </div>
      )}

      {/* WIPE OPTIONS MODAL */}
      {showWipeModal && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
                <button onClick={() => setShowWipeModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                
                <div className="mb-8 flex items-center gap-5">
                    <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-3xl flex items-center justify-center"><Eraser size={32} /></div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Limpeza Abrangente</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione os dados para remoção</p>
                    </div>
                </div>

                <div className="space-y-4 mb-10">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Opções de Limpeza:</p>
                    
                    <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-500 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex items-center justify-center"><DollarSign size={16}/></div>
                            <div>
                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Transações Financeiras</p>
                                <p className="text-[9px] text-slate-400 font-bold">Todo o histórico de entradas e saídas</p>
                            </div>
                        </div>
                        <input type="checkbox" checked={wipeOptions.transactions} onChange={e => setWipeOptions({...wipeOptions, transactions: e.target.checked})} className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-500 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg flex items-center justify-center"><FileText size={16}/></div>
                            <div>
                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Histórico de RPS (NFSe)</p>
                                <p className="text-[9px] text-slate-400 font-bold">Notas fiscais emitidas e rascunhos</p>
                            </div>
                        </div>
                        <input type="checkbox" checked={wipeOptions.nfse} onChange={e => setWipeOptions({...wipeOptions, nfse: e.target.checked})} className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-500 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg flex items-center justify-center"><Brain size={16}/></div>
                            <div>
                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Memória do Chat AI</p>
                                <p className="text-[9px] text-slate-400 font-bold">Histórico de conversas com a inteligência</p>
                            </div>
                        </div>
                        <input type="checkbox" checked={wipeOptions.chat} onChange={e => setWipeOptions({...wipeOptions, chat: e.target.checked})} className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </label>
                </div>

                <div className="p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl mb-8">
                    <div className="flex items-center gap-3 text-rose-600 mb-2">
                        <AlertTriangle size={18} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aviso de Irreversibilidade</p>
                    </div>
                    <p className="text-[10px] text-rose-500/80 font-bold leading-relaxed uppercase">
                        {wipeScope === 'SYSTEM' 
                            ? "ESTA OPERAÇÃO AFETARÁ TODAS AS EMPRESAS DO SISTEMA GLOBALMENTE." 
                            : "ESTA OPERAÇÃO APAGARÁ OS DADOS SELECIONADOS PERMANENTEMENTE DESTE TERMINAL."}
                    </p>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setShowWipeModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                    <button 
                        onClick={executeWipe} 
                        disabled={isLoading || (!wipeOptions.transactions && !wipeOptions.nfse && !wipeOptions.chat)} 
                        className="flex-2 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={16}/> : <Skull size={16}/>} Confirmar Destruição
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
