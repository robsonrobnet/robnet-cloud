
import React, { useState, useEffect } from 'react';
import { 
  Users, Building2, Shield, Settings, Plus, Edit, Trash2, 
  Save, X, CheckCircle2, AlertTriangle, Database, Lock, 
  Unlock, Key, ShieldCheck, LayoutGrid, ToggleLeft, ToggleRight, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Company, UserPlan, AppView } from '../types';

const MasterConfig: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Company>>({});
  const [masterPassword, setMasterPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const MASTER_PASSWORD = 'MASTER_FINANAI_2026';

  useEffect(() => {
    if (isAuthorized) {
      fetchCompanies();
    }
  }, [isAuthorized]);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (e) {
      console.error("Error fetching companies:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorize = () => {
    if (masterPassword === MASTER_PASSWORD) {
      setIsAuthorized(true);
    } else {
      alert("Senha Master Incorreta!");
    }
  };

  const handleEdit = (company: Company) => {
    setIsEditing(company.id);
    setEditForm({
      ...company,
      enabled_modules: company.enabled_modules || Object.keys(AppView).filter(k => k !== 'MASTER_CONFIG')
    });
  };

  const handleSave = async () => {
    if (!isEditing) return;
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: editForm.name,
          plan: editForm.plan,
          enabled_modules: editForm.enabled_modules
        })
        .eq('id', isEditing);

      if (error) throw error;
      
      setCompanies(companies.map(c => c.id === isEditing ? { ...c, ...editForm } as Company : c));
      setIsEditing(null);
      alert("Perfil atualizado com sucesso!");
    } catch (e) {
      console.error("Error saving company:", e);
      alert("Erro ao salvar perfil.");
    }
  };

  const toggleModule = (module: string) => {
    const current = editForm.enabled_modules || [];
    if (current.includes(module)) {
      setEditForm({ ...editForm, enabled_modules: current.filter(m => m !== module) });
    } else {
      setEditForm({ ...editForm, enabled_modules: [...current, module] });
    }
  };

  const createNewProfile = async () => {
    if (!newProfileName) {
      alert("Por favor, informe o nome do perfil.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create Company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([{ 
          name: newProfileName, 
          plan: 'FREE',
          enabled_modules: ['DASHBOARD', 'TRANSACTIONS', 'CHAT', 'TUTORIAL']
        }])
        .select();

      if (companyError) throw companyError;
      if (!companyData) throw new Error("Falha ao criar empresa");

      const newCompany = companyData[0];

      // 2. Create Default Admin User for this Company
      const accessKey = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          company_id: newCompany.id,
          username: 'admin',
          password: '123', // Default password for first access
          role: 'ADMIN',
          plan: 'FREE',
          access_key: accessKey,
          created_at: new Date().toISOString()
        }]);

      if (userError) throw userError;

      setCompanies([newCompany, ...companies]);
      setNewProfileName('');
      setIsCreating(false);
      
      alert(`Perfil "${newProfileName}" criado com sucesso!\n\nDados de Acesso Iniciais:\nUsuário: admin\nSenha: 123\nChave: ${accessKey}\n\nO perfil está totalmente zerado e pronto para configuração.`);
    } catch (e) {
      console.error("Error creating company:", e);
      alert("Erro ao criar perfil. Verifique a conexão com o banco de dados.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Acesso Master</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Digite a senha para gerenciar perfis</p>
          
          <div className="space-y-4">
            <input 
              type="password" 
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center text-lg font-black tracking-[0.5em] outline-none focus:border-rose-500 transition-all"
              placeholder="••••••••"
              value={masterPassword}
              onChange={e => setMasterPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuthorize()}
            />
            <button 
              onClick={handleAuthorize}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-lg"
            >
              Autenticar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Configurador Master</h1>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Gerenciamento Global de Perfis e Módulos</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all shadow-xl flex items-center gap-3"
        >
          <Plus size={18} /> Novo Perfil
        </button>
      </div>

      {isCreating && (
        <div className="mb-12 bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border-2 border-dashed border-indigo-200 dark:border-indigo-800 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Criar Novo Perfil</h2>
            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
              placeholder="Nome da Empresa / Perfil"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createNewProfile()}
            />
            <button 
              onClick={createNewProfile}
              disabled={isLoading}
              className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Confirmar Criação
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
            * O perfil será criado automaticamente com um usuário administrador padrão (admin/123).
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin text-indigo-600"><Database size={40} /></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {companies.map(company => (
            <div 
              key={company.id}
              className={`bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border transition-all ${isEditing === company.id ? 'border-indigo-500 shadow-2xl ring-4 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-800 shadow-xl hover:border-indigo-300'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-3xl flex items-center justify-center shadow-inner">
                    <Building2 size={32} />
                  </div>
                  <div>
                    {isEditing === company.id ? (
                      <input 
                        className="text-xl font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none"
                        value={editForm.name}
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                      />
                    ) : (
                      <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{company.name}</h3>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                        {company.plan}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">ID: {company.id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isEditing === company.id ? (
                    <>
                      <button onClick={handleSave} className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-lg"><Save size={20} /></button>
                      <button onClick={() => setIsEditing(null)} className="p-4 bg-rose-100 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-lg"><X size={20} /></button>
                    </>
                  ) : (
                    <button onClick={() => handleEdit(company)} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-lg"><Edit size={20} /></button>
                  )}
                </div>
              </div>

              {isEditing === company.id && (
                <div className="mt-10 pt-10 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Settings size={14} /> Configuração de Plano
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {(['FREE', 'START', 'PRO', 'ENTERPRISE'] as UserPlan[]).map(p => (
                          <button 
                            key={p}
                            onClick={() => setEditForm({...editForm, plan: p})}
                            className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${editForm.plan === p ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <LayoutGrid size={14} /> Módulos Liberados
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.keys(AppView).filter(k => k !== 'MASTER_CONFIG').map(module => (
                          <button 
                            key={module}
                            onClick={() => toggleModule(module)}
                            className={`py-3 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-between ${editForm.enabled_modules?.includes(module) ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border border-slate-100 dark:border-slate-800'}`}
                          >
                            {module}
                            {editForm.enabled_modules?.includes(module) ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MasterConfig;
