
import React, { useState } from 'react';
import { ShieldCheck, Loader2, CreditCard, Building2, UserPlus, LogIn, FileText, Download, AlertTriangle, Settings, Database, X, Save, Phone, Fingerprint, Key, Check, Copy, Mail } from 'lucide-react';
import { supabase, formatSupabaseError, updateSupabaseConfig } from '../lib/supabase';
import { User, UserRole, UserPlan, Language } from '../types';
import { EmailService } from '../services/emailService';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  t: any;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, t }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    username: '', 
    password: '',
    email: '', 
    whatsapp: '',
    document: '', 
    plan: 'FREE' as UserPlan,
    companyName: '',
    cnpj: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'IDLE' | 'SENDING' | 'SENT' | 'ERROR'>('IDLE');

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedAccessKey, setGeneratedAccessKey] = useState('');

  // DB Config State
  const [showConfig, setShowConfig] = useState(false);
  const [dbSettings, setDbSettings] = useState({
    url: localStorage.getItem('finanai_db_url') || '',
    key: localStorage.getItem('finanai_db_key') || ''
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSupabaseConfig(dbSettings.url, dbSettings.key);
    setShowConfig(false);
    alert("Conexão atualizada com sucesso!");
  };

  const generateAccessKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setEmailStatus('IDLE');

    const cleanUsername = formData.username.trim();
    const cleanPassword = formData.password.trim();

    try {
      if (isRegistering) {
        if (cleanUsername.length < 3) throw new Error("Nome deve ter pelo menos 3 caracteres.");
        if (cleanPassword.length < 4) throw new Error("Senha deve ter pelo menos 4 caracteres.");
        if (!formData.email || !formData.email.includes('@')) throw new Error("E-mail válido é obrigatório.");
        if (!formData.whatsapp) throw new Error("WhatsApp é obrigatório.");
        if (!formData.document) throw new Error("CPF/CNPJ é obrigatório.");

        const accessKey = generateAccessKey();
        const finalCompanyName = formData.companyName.trim() ? formData.companyName : `${cleanUsername} Corp`;

        const { data: compData, error: compError } = await supabase
          .from('companies')
          .insert([{ name: finalCompanyName, plan: formData.plan, cnpj: formData.cnpj || formData.document }])
          .select().single();
        
        if (compError) throw compError;

        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert([{
            company_id: compData.id,
            username: cleanUsername,
            password: cleanPassword,
            email: formData.email,
            whatsapp: formData.whatsapp,
            document_number: formData.document,
            access_key: accessKey,
            role: 'ADMIN',
            language: 'pt'
          }])
          .select().single();

        if (userError) {
          await supabase.from('companies').delete().eq('id', compData.id);
          throw userError;
        }

        await supabase.from('companies').update({ owner_id: userData.id }).eq('id', compData.id);

        const defaultCats = [
          { company_id: compData.id, name: 'Vendas / Serviços', color: '#10b981', icon: 'Wallet' },
          { company_id: compData.id, name: 'Custos Operacionais', color: '#ef4444', icon: 'TrendingDown' },
          { company_id: compData.id, name: 'Pessoal & Salários', color: '#ec4899', icon: 'Users' },
          { company_id: compData.id, name: 'Marketing', color: '#8b5cf6', icon: 'Zap' }
        ];
        await supabase.from('categories').insert(defaultCats);

        setEmailStatus('SENDING');
        const emailResult = await EmailService.sendWelcomeEmail(formData.email, cleanUsername, accessKey, formData.plan);
        setEmailStatus(emailResult.success ? 'SENT' : 'ERROR');

        setGeneratedAccessKey(accessKey);
        setShowSuccessModal(true);

      } else {
        const { data: userCandidates, error: searchError } = await supabase
          .from('users')
          .select('*, companies(*)')
          .or(`username.ilike.${cleanUsername},access_key.eq.${cleanUsername}`);

        if (searchError) throw searchError;

        const user = userCandidates?.find(u => u.password === cleanPassword);
        if (!user) throw new Error('Credenciais inválidas.');

        const companyData = Array.isArray(user.companies) ? user.companies[0] : user.companies;
        if (companyData && companyData.scheduled_deletion_date) {
            const deletionDate = new Date(companyData.scheduled_deletion_date);
            if (new Date() > deletionDate) throw new Error("Conta encerrada.");
            alert(`Conta agendada para exclusão em ${deletionDate.toLocaleDateString()}.`);
        }

        // FIX: Renamed createdAt to created_at
        onLoginSuccess({
          id: user.id,
          company_id: user.company_id,
          username: user.username,
          email: user.email,
          role: user.role as UserRole,
          plan: (companyData?.plan || 'FREE') as UserPlan,
          language: (user.language as Language) || 'pt',
          created_at: user.created_at,
          access_key: user.access_key
        });
      }
    } catch (err: any) { 
      setError(formatSupabaseError(err)); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedAccessKey);
    alert("Chave copiada!");
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-inter">
      <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px]"></div>
      
      {showSuccessModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
             <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-[2rem] w-full max-w-md shadow-2xl text-center">
                 <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><Check size={40} className="text-emerald-500" /></div>
                 <h2 className="text-2xl font-black text-white mb-2">Credencial Criada!</h2>
                 <p className="text-slate-400 text-sm mb-4">Abaixo está sua Chave de Acesso Única.</p>
                 <div className="bg-black/50 p-4 rounded-xl border border-slate-700 mb-6 relative">
                     <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Sua Access Key</p>
                     <p className="text-xl font-mono font-black text-emerald-400">{generatedAccessKey}</p>
                     <button onClick={copyToClipboard} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500"><Copy size={18} /></button>
                 </div>
                 <button onClick={() => { setShowSuccessModal(false); setIsRegistering(false); }} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-xs">Acessar Terminal</button>
             </div>
         </div>
      )}

      <button onClick={() => setShowConfig(true)} className="absolute top-6 right-6 z-20 text-slate-500 hover:text-indigo-500 p-2"><Settings size={24} /></button>

      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md relative">
              <button onClick={() => setShowConfig(false)} className="absolute top-4 right-4 text-slate-500"><X size={20}/></button>
              <h3 className="text-lg font-black text-white mb-4">Configuração Database</h3>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                 <input className="w-full bg-black/30 border border-slate-700 rounded-xl p-3 text-white text-xs" placeholder="URL" value={dbSettings.url} onChange={e => setDbSettings({...dbSettings, url: e.target.value})} />
                 <input type="password" className="w-full bg-black/30 border border-slate-700 rounded-xl p-3 text-white text-xs" placeholder="Key" value={dbSettings.key} onChange={e => setDbSettings({...dbSettings, key: e.target.value})} />
                 <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase">Salvar</button>
              </form>
           </div>
        </div>
      )}

      <div className="w-full max-w-[480px] relative z-10">
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] mx-auto flex items-center justify-center text-white shadow-2xl mb-4"><Key size={32} /></div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase">FinanAI <span className="text-indigo-500">Access</span></h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2">Terminal de Acesso Seguro</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white font-bold text-sm outline-none" placeholder={isRegistering ? "Nome Completo" : "Usuário ou Chave"} required />
              </div>
              <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white font-bold text-sm outline-none" placeholder="Senha" required />
              </div>

              {isRegistering && (
                <div className="space-y-3 animate-in slide-in-from-top-4 pt-2">
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs" placeholder="E-mail" required />
                  <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs" placeholder="WhatsApp" required />
                      <input type="text" value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs" placeholder="CPF/CNPJ" required />
                  </div>
                  <select value={formData.plan} onChange={e => setFormData({...formData, plan: e.target.value as UserPlan})} className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none appearance-none">
                    <option value="FREE">Plano BÁSICO (Gratuito)</option>
                    <option value="START">Plano START</option>
                    <option value="PRO">Plano PRO</option>
                    <option value="ENTERPRISE">Plano ENTERPRISE</option>
                  </select>
                </div>
              )}
            </div>

            {error && <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-[11px] text-rose-200 font-bold">{error}</div>}
            
            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] py-4 font-black uppercase text-xs shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Criar Conta' : 'Acessar Terminal')}
            </button>
            
            <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(null); }} className="w-full text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-2">
                {isRegistering ? 'Já tenho acesso' : 'Novo por aqui? Criar Perfil'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
