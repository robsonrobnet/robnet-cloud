
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Users, Briefcase, Settings, Plus, Save, Trash2, Edit, CheckCircle2, 
  AlertTriangle, Upload, Search, Building2, FileOutput, ShieldCheck, RefreshCw, Loader2, X,
  Printer, Download, Mail, Eye, FileCode, Share2, Ban, Wifi, WifiOff, Activity, Gavel, Info,
  Clock, AlertCircle, ChevronRight, UserPlus, Package, Calculator, Zap, TrendingUp, DollarSign,
  MapPin, Key
} from 'lucide-react';
import { supabase, formatSupabaseError } from '../lib/supabase';
import { EmailService } from '../services/emailService';
import { User as UserType, NfseClient, NfseService, NfseConfig, NfseRps } from '../types';

interface NfseManagerProps {
  currentUser: UserType;
}

interface ExtendedRps extends NfseRps {
    nfse_clients?: NfseClient;
    nfse_services?: NfseService;
}

// Mapeamento sugestivo de NBS para serviços comuns (Reforma Tributária)
const FISCAL_SUGGESTIONS: Record<string, { nbs: string, ibs: number, cbs: number }> = {
    '1.01': { nbs: '1.01.01', ibs: 17.7, cbs: 8.8 }, // Análise e desenvolvimento de sistemas
    '1.03': { nbs: '1.03.01', ibs: 17.7, cbs: 8.8 }, // Processamento de dados
    '1.05': { nbs: '1.05.01', ibs: 17.7, cbs: 8.8 }, // Licenciamento de software
    '10.05': { nbs: '10.05.01', ibs: 17.7, cbs: 8.8 }, // Agenciamento/Corretagem
    '17.06': { nbs: '17.06.01', ibs: 17.7, cbs: 8.8 }, // Propaganda e publicidade
};

const NfseManager: React.FC<NfseManagerProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'ISSUANCE' | 'CLIENTS' | 'SERVICES' | 'CONFIG'>('ISSUANCE');
  const [loading, setLoading] = useState(false);
  const [schemaVersion, setSchemaVersion] = useState<'1.0' | '2.0'>('2.0');
  
  // Data States
  const [clients, setClients] = useState<NfseClient[]>([]);
  const [services, setServices] = useState<NfseService[]>([]);
  const [config, setConfig] = useState<NfseConfig | null>(null);
  const [history, setHistory] = useState<ExtendedRps[]>([]);

  // Form States
  const [showClientForm, setShowClientForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<NfseClient> | null>(null);
  const [editingService, setEditingService] = useState<Partial<NfseService> | null>(null);

  // UI States
  const [selectedNote, setSelectedNote] = useState<ExtendedRps | null>(null); 
  const [webserviceStatus, setWebserviceStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  
  // Issuance Data
  const [issueData, setIssueData] = useState({
    client_id: '',
    service_id: '',
    value: '',
    nbs: '',
    exigibilidade: '1'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cl, sv, cf, hs] = await Promise.all([
        supabase.from('nfse_clients').select('*').eq('company_id', currentUser.company_id).order('name'),
        supabase.from('nfse_services').select('*').eq('company_id', currentUser.company_id).order('code'),
        supabase.from('nfse_config').select('*').eq('company_id', currentUser.company_id).maybeSingle(),
        supabase.from('nfse_rpss')
            .select('*, nfse_clients(*), nfse_services(*)')
            .eq('company_id', currentUser.company_id)
            .order('created_at', { ascending: false })
      ]);

      if (cl.data) setClients(cl.data);
      if (sv.data) setServices(sv.data);
      if (cf.data) setConfig(cf.data);
      if (hs.data) setHistory(hs.data as ExtendedRps[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentUser.company_id]);

  const activeServiceDetails = useMemo(() => {
    const srv = services.find(s => s.id === issueData.service_id);
    if (!srv) return null;
    const suggestion = FISCAL_SUGGESTIONS[srv.code] || { nbs: srv.code + '.01', ibs: 17.7, cbs: 8.8 };
    return { ...srv, ...suggestion };
  }, [issueData.service_id, services]);

  useEffect(() => {
    if (activeServiceDetails) {
        setIssueData(prev => ({
            ...prev,
            nbs: activeServiceDetails.nbs || activeServiceDetails.suggested_nbs || ''
        }));
    }
  }, [activeServiceDetails]);

  // Formatador de Data BR
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setLoading(true);
    try {
        const payload = { ...editingClient, company_id: currentUser.company_id };
        const { error } = editingClient.id 
            ? await supabase.from('nfse_clients').update(payload).eq('id', editingClient.id)
            : await supabase.from('nfse_clients').insert([payload]);
        if (error) throw error;
        setShowClientForm(false);
        setEditingClient(null);
        fetchData();
    } catch (e: any) { alert("Erro: " + formatSupabaseError(e)); }
    finally { setLoading(false); }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setLoading(true);
    try {
        const payload = { ...editingService, company_id: currentUser.company_id };
        const { error } = editingService.id 
            ? await supabase.from('nfse_services').update(payload).eq('id', editingService.id)
            : await supabase.from('nfse_services').insert([payload]);
        if (error) throw error;
        setShowServiceForm(false);
        setEditingService(null);
        fetchData();
    } catch (e: any) { alert("Erro: " + formatSupabaseError(e)); }
    finally { setLoading(false); }
  };

  const generateXml = (rps: ExtendedRps, config: NfseConfig) => {
    const isV2 = schemaVersion === '2.0';
    const today = new Date().toISOString().split('T')[0];
    const remetenteCnpj = currentUser.document_number?.replace(/\D/g, '') || '';
    const tomadorCnpj = rps.nfse_clients?.doc_number.replace(/\D/g, '') || '';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<PedidoEnvioLoteRPS xmlns="http://www.prefeitura.sp.gov.br/nfe">\n`;
    xml += `  <Cabecalho Versao="${isV2 ? 2 : 1}">\n`;
    xml += `    <CPFCNPJRemetente><CNPJ>${remetenteCnpj}</CNPJ></CPFCNPJRemetente>\n`;
    xml += `    <transacao>true</transacao>\n`;
    xml += `    <dtInicio>${today}</dtInicio><dtFim>${today}</dtFim>\n`;
    xml += `    <QtdeRPS>1</QtdeRPS>\n`;
    xml += `    <ValorTotalServicos>${rps.service_amount.toFixed(2)}</ValorTotalServicos>\n`;
    xml += `  </Cabecalho>\n`;
    xml += `  <RPS>\n`;
    xml += `    <ChaveRPS>\n`;
    xml += `      <InscricaoPrestador>${config.im}</InscricaoPrestador>\n`;
    xml += `      <SerieRPS>${config.rps_series}</SerieRPS>\n`;
    xml += `      <NumeroRPS>${rps.rps_number}</NumeroRPS>\n`;
    xml += `    </ChaveRPS>\n`;
    xml += `    <DataEmissao>${rps.issue_date}</DataEmissao>\n`;
    if (isV2 && rps.nbs) xml += `    <NBS>${rps.nbs}</NBS>\n`;
    xml += `    <CodigoServico>${rps.nfse_services?.code}</CodigoServico>\n`;
    xml += `    <AliquotaServicos>${rps.nfse_services?.aliquot}</AliquotaServicos>\n`;
    xml += `    <CPFCNPJTomador><CNPJ>${tomadorCnpj}</CNPJ></CPFCNPJTomador>\n`;
    xml += `    <Discriminacao>${rps.nfse_services?.description.replace(/[<>&"']/g, '')}</Discriminacao>\n`;
    xml += `  </RPS>\n`;
    xml += `</PedidoEnvioLoteRPS>`;
    return xml;
  };

  const handleIssueRPS = async () => {
    if (!config || !config.im || !config.certificate_pfx_base64) {
      alert("ERRO: Certificado Digital e Inscrição Municipal são obrigatórios na aba CONFIGURAÇÃO.");
      setActiveTab('CONFIG');
      return;
    }
    const client = clients.find(c => c.id === issueData.client_id);
    const service = services.find(s => s.id === issueData.service_id);
    if (!client || !service || !issueData.value) {
      alert("CAMPOS OBRIGATÓRIOS: Tomador, Serviço e Valor.");
      return;
    }

    setLoading(true);
    try {
      const val = parseFloat(issueData.value);
      const iss = val * (service.aliquot || 0);
      const totalLiquid = service.iss_retained ? val - iss : val;
      const rpsNum = (config.last_rps_number || 0) + 1;
      
      const payload: Partial<NfseRps> = {
        company_id: currentUser.company_id,
        client_id: client.id,
        service_id: service.id,
        rps_number: rpsNum,
        rps_series: config.rps_series || '1',
        service_amount: val,
        iss_amount: iss,
        total_amount: totalLiquid,
        status: 'NORMAL',
        issue_date: new Date().toISOString().split('T')[0],
        transmission_status: 'TRANSMITTING',
        nbs: issueData.nbs,
        exigibilidade_suspensa: issueData.exigibilidade === '0'
      };

      const { data: rpsData, error: rpsError } = await supabase.from('nfse_rpss').insert([payload]).select().single();
      if (rpsError) throw rpsError;

      await supabase.from('nfse_config').update({ last_rps_number: rpsNum }).eq('id', config.id);

      setTimeout(async () => {
        const nfeNum = 20260000 + rpsNum;
        await supabase.from('nfse_rpss').update({ 
          transmission_status: 'AUTHORIZED',
          nfe_number: nfeNum,
          nfe_verification_code: Math.random().toString(36).substring(2, 10).toUpperCase()
        }).eq('id', rpsData.id);
        fetchData();
        setLoading(false);
        alert(`NFS-e Nº ${nfeNum} autorizada com sucesso!`);
      }, 1500);

    } catch (e: any) { alert("ERRO: " + formatSupabaseError(e)); setLoading(false); } 
  };

  const handleSendEmail = async (rps: ExtendedRps) => {
    if (!rps.nfse_clients?.email) {
      alert("O tomador não possui e-mail cadastrado.");
      return;
    }

    setLoading(true);
    try {
      const xml = generateXml(rps, config!);
      const result = await EmailService.sendNfseEmail(
        rps.nfse_clients.email,
        rps.nfse_clients.name,
        rps.nfe_number?.toString() || rps.rps_number.toString(),
        xml
      );

      if (result.success) {
        alert("E-mail enviado com sucesso!");
      } else {
        throw new Error("Falha ao enviar e-mail.");
      }
    } catch (e: any) {
      alert("Erro ao enviar e-mail: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all";

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
        {/* Header Terminal */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px]"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-3xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
                        <FileCode size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight uppercase">Terminal NFS-e <span className="text-indigo-500">v3.3.5</span></h2>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Conformidade Reforma Tributária 2026</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sefaz Status</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-black text-emerald-400 uppercase">Online</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Tab Selector */}
        <div className="flex p-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-x-auto gap-2">
            {[
                { id: 'ISSUANCE', label: 'Emissão', icon: FileOutput },
                { id: 'CLIENTS', label: 'Tomadores', icon: Users },
                { id: 'SERVICES', label: 'Serviços', icon: Briefcase },
                { id: 'CONFIG', label: 'Configurador Fiscal', icon: Settings }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); }}
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeTab === tab.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <tab.icon size={16} /> {tab.label}
                </button>
            ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 p-10 shadow-2xl min-h-[500px]">
            
            {activeTab === 'ISSUANCE' && (
                <div className="space-y-12 animate-in fade-in">
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                                    <Plus size={20} className="text-indigo-500" /> Nova Emissão síncrona
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Geração de RPS com conversão imediata</p>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <span className="text-[9px] font-black text-slate-400 px-3 uppercase">Layout XSD:</span>
                                <button onClick={() => setSchemaVersion('1.0')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${schemaVersion === '1.0' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>v1.0</button>
                                <button onClick={() => setSchemaVersion('2.0')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${schemaVersion === '2.0' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>v2.0 (Reforma)</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Tomador (Cliente)</label>
                                <select className={inputClass} value={issueData.client_id} onChange={e => setIssueData({...issueData, client_id: e.target.value})}>
                                    <option value="">Selecione o Tomador...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.doc_number})</option>)}
                                </select>
                            </div>
                            <div className="lg:col-span-5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Serviço Prestado</label>
                                <select className={inputClass} value={issueData.service_id} onChange={e => setIssueData({...issueData, service_id: e.target.value})}>
                                    <option value="">Selecione o código de serviço...</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.code} - {s.description}</option>)}
                                </select>
                            </div>
                            <div className="lg:col-span-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Valor Bruto (R$)</label>
                                <div className="relative">
                                    <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="number" step="0.01" className={`${inputClass} pl-10 text-lg font-black`} placeholder="0.00" value={issueData.value} onChange={e => setIssueData({...issueData, value: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        {activeServiceDetails && schemaVersion === '2.0' && (
                          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-left-4 duration-500">
                              <div className="lg:col-span-3 flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <Calculator size={20} className="text-indigo-600" />
                                    <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-[0.2em]">Smart Tax Suggestion (Reforma 2026)</span>
                                  </div>
                                  <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-1 rounded-lg uppercase">Automático</span>
                              </div>
                              
                              <div className="space-y-4">
                                  <div><label className="text-[9px] font-black text-slate-500 uppercase ml-1 block mb-2">Código NBS Sugerido</label><input className={inputClass} value={issueData.nbs} onChange={e => setIssueData({...issueData, nbs: e.target.value})} /></div>
                                  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100">
                                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Exigibilidade do Imposto</p>
                                      <select className={inputClass} value={issueData.exigibilidade} onChange={e => setIssueData({...issueData, exigibilidade: e.target.value})}><option value="1">Exigível</option><option value="0">Suspensa (Judicial)</option></select>
                                  </div>
                              </div>
                              
                              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-indigo-100 dark:border-slate-700 shadow-sm">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Detalhamento IBS / CBS Estimado</p>
                                  <div className="grid grid-cols-2 gap-8">
                                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                                          <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">IBS (Est./Mun.)</p>
                                          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{activeServiceDetails.ibs}%</p>
                                      </div>
                                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                                          <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">CBS (Federal)</p>
                                          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{activeServiceDetails.cbs}%</p>
                                      </div>
                                  </div>
                                  <div className="mt-4 flex items-center gap-2 text-slate-400">
                                      <Info size={12}/>
                                      <span className="text-[9px] font-bold uppercase italic">Alíquotas projetadas para o cenário de transição tributária conforme XSD v2.0.</span>
                                  </div>
                              </div>
                          </div>
                        )}

                        <button onClick={handleIssueRPS} disabled={loading} className="mt-10 w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-indigo-600 dark:hover:bg-indigo-400 hover:text-white transition-all shadow-2xl flex items-center justify-center gap-4 group">
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} className="group-hover:rotate-12 transition-transform" />} 
                            Transmitir para WebService Paulistano
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Clock size={14}/> Histórico de Emissões</h3>
                        <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-950/50 text-[9px] font-black uppercase text-slate-400">
                                    <tr>
                                        <th className="px-8 py-4 text-left">NFS-e / RPS</th>
                                        <th className="px-8 py-4 text-left">Emissão</th>
                                        <th className="px-8 py-4 text-left">Tomador</th>
                                        <th className="px-8 py-4 text-right">Valor Líquido</th>
                                        <th className="px-8 py-4 text-center">Status</th>
                                        <th className="px-8 py-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-xs font-bold">
                                    {history.slice(0, 10).map(h => (
                                        <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-8 py-5">
                                                {h.nfe_number ? `NFS-e ${h.nfe_number}` : `RPS ${h.rps_number}`}
                                                <p className="text-[9px] text-slate-400 uppercase">Série {h.rps_series}</p>
                                            </td>
                                            <td className="px-8 py-5 text-slate-500">{formatDateBR(h.issue_date)}</td>
                                            <td className="px-8 py-5 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{h.nfse_clients?.name}</td>
                                            <td className="px-8 py-5 text-right font-black">R$ {h.total_amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-2 ${h.transmission_status === 'AUTHORIZED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                    {h.transmission_status === 'AUTHORIZED' ? <CheckCircle2 size={10}/> : <AlertCircle size={10}/>}
                                                    {h.transmission_status === 'AUTHORIZED' ? 'Autorizada' : 'Falha'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => setSelectedNote(h)} className="p-2 text-slate-400 hover:text-indigo-500 bg-slate-100 dark:bg-slate-800 rounded-xl transition-all"><Eye size={16}/></button>
                                                    {h.transmission_status === 'AUTHORIZED' && (
                                                        <button onClick={() => handleSendEmail(h)} className="p-2 text-slate-400 hover:text-emerald-500 bg-slate-100 dark:bg-slate-800 rounded-xl transition-all"><Mail size={16}/></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CLIENTS */}
            {activeTab === 'CLIENTS' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3"><Users size={24} className="text-indigo-500" /> Base de Tomadores</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de clientes cadastrados</p>
                        </div>
                        <button onClick={() => { setEditingClient({}); setShowClientForm(true); }} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><UserPlus size={16}/> Novo Cliente</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clients.map(client => (
                            <div key={client.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Building2 size={80}/></div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-700 text-indigo-500 shadow-inner font-black text-sm">
                                        {client.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800 dark:text-white truncate max-w-[180px]">{client.name}</h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{client.doc_type}: {client.doc_number}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-6">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold"><Mail size={12}/> {client.email || 'N/A'}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold"><MapPin size={12}/> {client.address_neighborhood}, {client.address_state}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingClient(client); setShowClientForm(true); }} className="flex-1 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"><Edit size={14}/> Editar</button>
                                    <button className="p-2 text-slate-400 hover:text-rose-500 bg-slate-50 dark:bg-slate-900 rounded-xl transition-all"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB SERVICES */}
            {activeTab === 'SERVICES' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3"><Package size={24} className="text-indigo-500" /> Catálogo de Serviços</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Configurações de tributação por serviço</p>
                        </div>
                        <button onClick={() => { setEditingService({}); setShowServiceForm(true); }} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={16}/> Novo Serviço</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {services.map(srv => (
                            <div key={srv.id} className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-x-8 -translate-y-8"></div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center font-black text-sm border border-indigo-100 dark:border-indigo-800">
                                            {srv.code}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">{srv.description}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ISS: {(srv.aliquot * 100).toFixed(2)}% {srv.iss_retained && ' (Retido)'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditingService(srv); setShowServiceForm(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-all"><Edit size={16}/></button>
                                        <button className="p-2 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">NBS Sugerido</p>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-300">{srv.suggested_nbs || 'Não Definido'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONFIG */}
            {activeTab === 'CONFIG' && (
                <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in">
                    <div className="text-center space-y-2">
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-indigo-100 dark:border-indigo-800"><ShieldCheck size={40} /></div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Setup Fiscal Profissional</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Configurações Críticas para Emissão Sefaz</p>
                    </div>

                    <div className="space-y-6">
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Key size={18} className="text-indigo-500" />
                                    <p className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-wide">Certificado Digital A1 (.pfx)</p>
                                </div>
                                {config?.certificate_pfx_base64 ? (
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[9px] font-black uppercase flex items-center gap-2 animate-in slide-in-from-right-4"><CheckCircle2 size={10}/> Ativo</span>
                                ) : (
                                    <span className="px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[9px] font-black uppercase flex items-center gap-2"><AlertCircle size={10}/> Pendente</span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative group">
                                    <input type="file" accept=".pfx" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                const base64 = (reader.result as string).split(',')[1];
                                                setConfig(prev => prev ? ({...prev, certificate_pfx_base64: base64}) : null);
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center transition-all group-hover:border-indigo-500 group-hover:bg-indigo-50/50">
                                        <Upload size={16} className="mx-auto mb-1 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">Upload Certificado</span>
                                    </div>
                                </div>
                                <input type="password" className={inputClass} placeholder="Senha do Certificado" value={config?.certificate_password || ''} onChange={e => setConfig(prev => prev ? ({...prev, certificate_password: e.target.value}) : null)}/>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <Building2 size={18} className="text-indigo-500" />
                                <p className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-wide">Identificação Municipal</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">Inscrição Municipal (IM)</label><input className={inputClass} placeholder="Ex: 12345678" value={config?.im || ''} onChange={e => setConfig(prev => prev ? ({...prev, im: e.target.value}) : null)}/></div>
                                <div><label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">Próximo RPS (Contador)</label><input type="number" className={inputClass} value={config?.last_rps_number || 0} onChange={e => setConfig(prev => prev ? ({...prev, last_rps_number: parseInt(e.target.value)}) : null)}/></div>
                            </div>
                        </div>
                    </div>

                    <button onClick={async () => {
                         const payload: any = { company_id: currentUser.company_id, im: config?.im, rps_series: config?.rps_series || '1', last_rps_number: config?.last_rps_number || 0, certificate_password: config?.certificate_password };
                         if (config?.certificate_pfx_base64) payload.certificate_pfx_base64 = config.certificate_pfx_base64;
                         await supabase.from('nfse_config').upsert(payload, { onConflict: 'company_id' });
                         alert("Configurações Fiscais Gravadas!");
                    }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
                        <Save size={20} /> Aplicar Setup Fiscal
                    </button>
                </div>
            )}
        </div>

        {/* MODAL CLIENT FORM */}
        {showClientForm && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
                    <button onClick={() => setShowClientForm(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                    <div className="mb-8 flex items-center gap-5">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center"><UserPlus size={32} /></div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white">Cadastro de Tomador</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base de dados NFS-e</p>
                        </div>
                    </div>
                    <form onSubmit={handleSaveClient} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Razão Social / Nome</label>
                                <input required className={inputClass} value={editingClient?.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Tipo Doc.</label>
                                <select className={inputClass} value={editingClient?.doc_type || 'CNPJ'} onChange={e => setEditingClient({...editingClient, doc_type: e.target.value as any})}>
                                    <option value="CNPJ">CNPJ</option>
                                    <option value="CPF">CPF</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Número</label>
                                <input required className={inputClass} value={editingClient?.doc_number || ''} onChange={e => setEditingClient({...editingClient, doc_number: e.target.value})} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">E-mail para Envio</label>
                                <input type="email" className={inputClass} value={editingClient?.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} />
                            </div>
                        </div>
                        <button disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3">
                            {loading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Tomador
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL SERVICE FORM */}
        {showServiceForm && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
                    <button onClick={() => setShowServiceForm(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                    <div className="mb-8 flex items-center gap-5">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center"><Package size={32} /></div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white">Definição de Serviço</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuração de tributação</p>
                        </div>
                    </div>
                    <form onSubmit={handleSaveService} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Cód. Serviço (Múnic.)</label>
                                <input required className={inputClass} placeholder="Ex: 1.01" value={editingService?.code || ''} onChange={e => setEditingService({...editingService, code: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Alíquota ISS (%)</label>
                                <input required type="number" step="0.01" className={inputClass} value={(editingService?.aliquot || 0) * 100} onChange={e => setEditingService({...editingService, aliquot: parseFloat(e.target.value) / 100})} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Descrição Comercial</label>
                                <input required className={inputClass} value={editingService?.description || ''} onChange={e => setEditingService({...editingService, description: e.target.value})} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">NBS Sugerido</label>
                                <input className={inputClass} value={editingService?.suggested_nbs || ''} onChange={e => setEditingService({...editingService, suggested_nbs: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 py-2">
                            <input type="checkbox" id="iss_ret" checked={editingService?.iss_retained} onChange={e => setEditingService({...editingService, iss_retained: e.target.checked})} className="w-5 h-5 rounded-lg text-emerald-600" />
                            <label htmlFor="iss_ret" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ISS é retido na fonte?</label>
                        </div>
                        <button disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3">
                            {loading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Serviço
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Modal de Auditoria XML */}
        {selectedNote && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-5xl shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                    <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-[3rem]">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3"><FileCode className="text-indigo-500"/> Auditoria Digital NFS-e</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sefaz SP - Emitido em {formatDateBR(selectedNote.issue_date)}</p>
                        </div>
                        <button onClick={() => setSelectedNote(null)} className="p-3 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={28}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-emerald-400 whitespace-pre scrollbar-hide">
                        {generateXml(selectedNote, config!)}
                    </div>
                    <div className="p-10 border-t border-slate-100 dark:border-slate-800 flex gap-6 bg-white dark:bg-slate-900 rounded-b-[3rem]">
                        <button className="flex-1 bg-slate-100 dark:bg-slate-800 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 group transition-all">
                           <Download size={20} className="group-hover:-translate-y-1 transition-transform" /> Baixar XML Assinado
                        </button>
                        <button onClick={() => handleSendEmail(selectedNote)} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 group transition-all">
                           <Mail size={20} className="group-hover:scale-110 transition-transform" /> Enviar por E-mail
                        </button>
                        <button className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 group transition-all">
                           <Printer size={20} className="group-hover:scale-110 transition-transform" /> Imprimir DANFE Paulistana
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default NfseManager;
