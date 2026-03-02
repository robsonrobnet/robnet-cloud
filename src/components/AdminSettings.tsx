
import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Building2, Tags, Settings, Plus, Edit, Trash2, 
  Save, X, CheckCircle2, AlertTriangle, Database, Activity, Brain, Key, Server, Lock, FileText, Loader2, RefreshCw, Skull, Eraser, AlertOctagon, Download, Terminal, Unlock, Cpu, CloudLightning, Globe, Palette
} from 'lucide-react';
import { supabase, formatSupabaseError, updateSupabaseConfig } from '../lib/supabase';
import { User, Company, Category, UserRole, UserPlan, Language } from '../types';
import { FinancialService } from '../services/financialService';

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
  const [activeTab, setActiveTab] = useState<'USERS' | 'SYSTEM' | 'CATEGORIES' | 'MASTER'>('USERS');
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

  const [sysConfig, setSysConfig] = useState({
    dbUrl: localStorage.getItem('finanai_db_url') || '',
    dbKey: localStorage.getItem('finanai_db_key') || ''
  });

  useEffect(() => { fetchAdminData(); }, [currentUser]);

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
    if (masterPass === '2298R@bnet') { setIsMasterUnlocked(true); setMasterPass(''); } 
    else { alert("Senha mestre inválida."); setMasterPass(''); }
  };

  // --- INFRASTRUCTURE ACTIONS ---

  const handleWipeTransactions = async () => {
    if (!confirm("⚠️ CUIDADO: Isso apagará TODO o histórico financeiro da empresa. Esta ação é irreversível. Deseja continuar?")) return;
    
    setIsLoading(true);
    try {
      console.log(`[Admin] Wiping transactions for company: ${currentUser.company_id}`);
      await FinancialService.wipeTransactions(currentUser.company_id);
      
      alert("Sucesso: Histórico de transações limpo.");
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
                           <div><p className="text-sm font-black text-slate-800 dark:text-white">{u.username}</p><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>{u.role}</span></div>
                        </div>
                        <button className="p-3 text-slate-400 hover:text-indigo-600 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700"><Edit size={18}/></button>
                     </div>
                  ))}
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
                                 <button onClick={handleWipeTransactions} disabled={isLoading} className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all text-left flex flex-col items-start gap-3 disabled:opacity-50">
                                     {isLoading ? <Loader2 className="animate-spin text-amber-400" size={24}/> : <Eraser className="text-amber-400" size={24} />}
                                     <div>
                                         <p className="text-xs font-black uppercase tracking-widest">Limpar Transações</p>
                                         <p className="text-[10px] text-slate-500 mt-1 uppercase">Zerar histórico financeiro</p>
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
    </div>
  );
};

export default AdminSettings;
