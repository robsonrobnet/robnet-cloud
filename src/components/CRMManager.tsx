import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, Plus, Search, Filter, MoreHorizontal, User, 
  Mail, Phone, Calendar, Clock, ArrowRight, CheckCircle2, 
  AlertCircle, Sparkles, TrendingUp, Zap, MessageSquare,
  ChevronRight, Bookmark, Tag, Trash2, Edit3, X, FileText,
  DollarSign, Activity, Send, Globe, History, Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CRMLead, CRMLeadStatus, CRMContact, CRMActivity, User as AppUser } from '../types';
import { FinancialService } from '../services/financialService';
import { aiCRMService } from '../services/aiCRMService';

interface CRMManagerProps {
  currentUser: AppUser;
}

const STAGES: { id: CRMLeadStatus; label: string; color: string }[] = [
  { id: 'NEW', label: 'Prospecção', color: 'bg-blue-500' },
  { id: 'QUALIFIED', label: 'Qualificado', color: 'bg-indigo-500' },
  { id: 'PROPOSAL', label: 'Proposta', color: 'bg-amber-500' },
  { id: 'NEGOTIATION', label: 'Negociação', color: 'bg-purple-500' },
  { id: 'CLOSED_WON', label: 'Fechado', color: 'bg-emerald-500' },
  { id: 'CLOSED_LOST', label: 'Perdido', color: 'bg-rose-500' }
];

const CRMManager: React.FC<CRMManagerProps> = ({ currentUser }) => {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [activeView, setActiveView] = useState<'KANBAN' | 'LIST'>('KANBAN');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Stats
  const stats = useMemo(() => {
    const total = leads.reduce((acc, l) => acc + (l.value || 0), 0);
    const winCount = leads.filter(l => l.status === 'CLOSED_WON').length;
    const activePipeline = leads.filter(l => l.status !== 'CLOSED_WON' && l.status !== 'CLOSED_LOST').length;
    return { total, winCount, activePipeline };
  }, [leads]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await FinancialService.getCRMLeads(currentUser.company_id);
      setLeads(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      FinancialService.getCRMActivities(selectedLead.id).then(setActivities);
    }
  }, [selectedLead]);

  const handleStatusChange = async (leadId: string, newStatus: CRMLeadStatus) => {
    try {
      await FinancialService.updateLeadStatus(leadId, newStatus);
      fetchData();
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, status: newStatus });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAIAnalysis = async () => {
    if (!selectedLead) return;
    setIsAnalyzing(true);
    try {
      const result = await aiCRMService.analyzeLead(selectedLead, activities, selectedLead.contact);
      await FinancialService.updateLeadAI(selectedLead.id, {
        score: result.score,
        insight: result.insight
      });
      // Refresh current lead data
      const updatedLeads = await FinancialService.getCRMLeads(currentUser.company_id);
      setLeads(updatedLeads);
      const matched = updatedLeads.find(l => l.id === selectedLead.id);
      if (matched) setSelectedLead(matched);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredLeads = leads.filter(l => 
    l.title.toLowerCase().includes(filter.toLowerCase()) ||
    l.contact?.name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      {/* Header & Mini Dash */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
             <Target className="text-indigo-600" size={32} /> CRM Neural
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão inteligente de novos negócios</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 flex shadow-sm">
             <button onClick={() => setActiveView('KANBAN')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'KANBAN' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Kanban</button>
             <button onClick={() => setActiveView('LIST')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'LIST' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Lista</button>
          </div>
          <button onClick={() => setShowLeadModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-500/20 transition-all hover:scale-105">
            <Plus size={16} /> Novo Lead
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center"><DollarSign size={28} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pipeline Total</p>
               <h4 className="text-xl font-black text-slate-800 dark:text-white">R$ {stats.total.toLocaleString('pt-BR')}</h4>
            </div>
         </div>
         <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center"><CheckCircle2 size={28} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversões</p>
               <h4 className="text-xl font-black text-slate-800 dark:text-white">{stats.winCount} Negócios Fechados</h4>
            </div>
         </div>
         <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center"><Activity size={28} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativos</p>
               <h4 className="text-xl font-black text-slate-800 dark:text-white">{stats.activePipeline} Leads no Funil</h4>
            </div>
         </div>
      </div>

      {/* Main Board */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-8 custom-scrollbar scroll-smooth snap-x">
          {STAGES.map((stage) => (
            <div key={stage.id} className="min-w-[320px] flex-shrink-0 flex flex-col gap-4 snap-center">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${stage.color}`}></div>
                   <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">{stage.label}</h3>
                   <span className="bg-slate-100 dark:bg-slate-800 text-slate-400 text-[8px] font-black px-2 py-0.5 rounded-full">
                     {filteredLeads.filter(l => l.status === stage.id).length}
                   </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                  R$ {filteredLeads.filter(l => l.status === stage.id).reduce((acc, l) => acc + (l.value || 0), 0).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="flex-1 space-y-4 min-h-[500px] p-2 bg-slate-50/50 dark:bg-slate-900/20 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
                <AnimatePresence>
                  {filteredLeads.filter(l => l.status === stage.id).map((lead) => (
                    <motion.div
                      key={lead.id}
                      layoutId={lead.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer group relative overflow-hidden"
                    >
                      {/* AI Priority Badge */}
                      {lead.priority === 'HIGH' && (
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 transition-opacity">
                          <Zap size={14} className="text-amber-400" />
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight line-clamp-2">{lead.title}</h4>
                        </div>

                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-500">
                             {lead.contact?.name?.[0] || <User size={12} />}
                           </div>
                           <p className="text-[10px] font-bold text-slate-400 truncate">{lead.contact?.name || 'Sem Contato'}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                           <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">R$ {lead.value.toLocaleString('pt-BR')}</p>
                           <div className="flex items-center gap-1.5">
                             <div className={`p-1.5 rounded-lg ${lead.priority === 'HIGH' ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
                               <Clock size={12} />
                             </div>
                             <button className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors">
                               <MessageSquare size={12} />
                             </button>
                           </div>
                        </div>

                        {/* AI Insight Snippet */}
                        {lead.ai_insight && (
                           <div className="mt-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl flex items-start gap-2 border border-indigo-100 dark:border-indigo-900/30">
                              <Sparkles size={10} className="text-indigo-500 mt-0.5" />
                              <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 leading-relaxed italic line-clamp-2">"{lead.ai_insight}"</p>
                           </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Quick Add Placeholder */}
                <button className="w-full py-4 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800 text-slate-300 hover:text-indigo-400 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 group">
                   <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LEAD DRAWER / DETAILS PANEL */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setSelectedLead(null)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            
            <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 20 }}
               className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                       <Target size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-1">{selectedLead.title}</h3>
                       <div className="flex items-center gap-2 mt-1">
                          <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${STAGES.find(s => s.id === selectedLead.status)?.color} text-white`}>
                              {STAGES.find(s => s.id === selectedLead.status)?.label}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">Vago em {new Date(selectedLead.created_at).toLocaleDateString()}</span>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedLead(null)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* AI Analysis Section */}
                <div className="bg-slate-900 dark:bg-white rounded-[2rem] p-6 text-white dark:text-slate-900 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-6 opacity-10"><Brain size={80} /></div>
                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                           <div className="p-1.5 bg-indigo-500 rounded-lg text-white"><Sparkles size={14} /></div>
                           <h4 className="text-xs font-black uppercase tracking-widest">Neural Sales Intelligence</h4>
                        </div>
                        <button 
                          onClick={handleAIAnalysis}
                          disabled={isAnalyzing}
                          className={`p-2 rounded-xl transition-all ${isAnalyzing ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' : 'bg-white/10 dark:bg-slate-100 text-white dark:text-slate-900 border border-white/10 dark:border-slate-200 hover:scale-110 active:scale-95'}`}
                        >
                          <Zap size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="bg-white/10 dark:bg-slate-100 p-4 rounded-2xl border border-white/5 dark:border-slate-200">
                            <p className="text-[9px] font-black uppercase opacity-60">Lead Score</p>
                            <h4 className="text-2xl font-black text-indigo-400">{selectedLead.score || 85}%</h4>
                         </div>
                         <div className="bg-white/10 dark:bg-slate-100 p-4 rounded-2xl border border-white/5 dark:border-slate-200">
                            <p className="text-[9px] font-black uppercase opacity-60">Status de Churn</p>
                            <h4 className="text-lg font-black text-emerald-400 uppercase">Saudável</h4>
                         </div>
                      </div>
                      <p className="text-xs font-bold leading-relaxed opacity-80">
                        {selectedLead.ai_insight || "Baseado nas últimas interações, este lead apresenta alta propensão de fechamento se abordado com uma proposta de valor focada em ROI nos próximos 2 dias."}
                      </p>
                   </div>
                </div>

                {/* Main Info */}
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Valor do Negócio</h4>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center gap-3">
                         <DollarSign size={18} className="text-emerald-500" />
                         <span className="text-sm font-black text-slate-800 dark:text-white">R$ {selectedLead.value.toLocaleString('pt-BR')}</span>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Prioridade</h4>
                      <div className="flex gap-2">
                         {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                            <button key={p} className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${selectedLead.priority === p ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                               {p === 'LOW' ? 'Baixa' : p === 'MEDIUM' ? 'Média' : 'Alta'}
                            </button>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Contact Section */}
                <div className="space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ponto de Contrato</h4>
                   <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] flex items-center gap-4">
                      <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                         {selectedLead.contact?.avatar_url ? <img src={selectedLead.contact.avatar_url} className="w-full h-full object-cover rounded-2xl" /> : <User size={24} />}
                      </div>
                      <div className="flex-1">
                         <h4 className="text-sm font-black text-slate-800 dark:text-white">{selectedLead.contact?.name || 'Sem Contato'}</h4>
                         <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{selectedLead.contact?.position || 'Cargo não informado'} na {selectedLead.contact?.organization || 'Empresa desconhecida'}</p>
                         <div className="flex gap-4 mt-3">
                            <button className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase hover:text-indigo-600 transition-colors"><Mail size={12} /> Email</button>
                            <button className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase hover:text-emerald-600 transition-colors"><Phone size={12} /> WhatsApp</button>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Timeline / Activities */}
                <div className="space-y-6 pt-8">
                   <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Timeline de Atividades</h4>
                      <button className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl hover:text-indigo-500 transition-all"><Plus size={16} /></button>
                   </div>
                   
                   <div className="space-y-4">
                      {activities.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                           <History size={32} className="mx-auto text-slate-200 mb-3" />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada</p>
                        </div>
                      ) : (
                        activities.map((act) => (
                           <div key={act.id} className="relative pl-8 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-slate-100 dark:before:bg-slate-800">
                              <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-indigo-500"></div>
                              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                                 <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                       <div className="p-1 px-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[8px] font-black uppercase tracking-widest">{act.type}</div>
                                       <span className="text-[10px] font-bold text-slate-400">{new Date(act.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {act.completed && <CheckCircle2 size={14} className="text-emerald-500" />}
                                 </div>
                                 <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{act.content}</p>
                              </div>
                           </div>
                        ))
                      )}
                   </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-4">
                 <button className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
                    <History size={18} /> Agendar Follow-up
                 </button>
                 <button className="px-6 py-4 bg-white dark:bg-slate-900 text-indigo-500 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase text-xs tracking-widest shadow-sm hover:bg-indigo-50 transition-all">
                    <Edit3 size={18} />
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW LEAD MODAL */}
      <AnimatePresence>
        {showLeadModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setShowLeadModal(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
            />
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                        <Plus size={24} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Novo Negócio</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Adicionar oportunidade ao pipeline</p>
                     </div>
                  </div>
                  <button onClick={() => setShowLeadModal(false)} className="p-2 text-slate-400 hover:text-rose-500"><X size={24} /></button>
               </div>

               <div className="space-y-6">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Título da Oportunidade</label>
                     <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="Ex: Projeto Expansão Norte" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Valor Estimado</label>
                        <div className="relative">
                           <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
                           <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none" placeholder="0,00" />
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Previsão de Fechamento</label>
                        <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none" />
                     </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                     <button className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3">
                        <Target size={18} /> Criar Negócio
                     </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRMManager;
