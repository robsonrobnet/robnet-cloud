import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, Trash2, Edit, X, Sparkles, Filter, Check, AlertCircle, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType, KnowledgeBaseArticle } from '../types';

interface KnowledgeBaseManagerProps {
  currentUser: UserType;
}

const CATEGORIES = ['NFS-e', 'Impostos', 'Reforma Tributária', 'CRM', 'Financeiro', 'Geral'] as const;

export default function KnowledgeBaseManager({ currentUser }: KnowledgeBaseManagerProps) {
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Modal states
  const [readingArticle, setReadingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [editingArticle, setEditingArticle] = useState<Partial<KnowledgeBaseArticle> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      // Fetch articles: global ones (company_id is null) or company-specific ones
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const rawData = data || [];
      const hasSPArticle = rawData.some((art: any) => art.title && art.title.includes('NFS-e SP (Prefeitura de São Paulo)'));
      
      let finalData = [...rawData];
      
      if (!hasSPArticle) {
        try {
          const { data: insertedData, error: insertError } = await supabase
            .from('knowledge_base')
            .insert([{
              category: 'NFS-e',
              title: 'Diretrizes de Emissão NFS-e SP (Prefeitura de São Paulo): ISS e NBS',
              content: `A prefeitura municipal de São Paulo possui diretrizes específicas para a emissão de NFS-e (Nota Fiscal de Serviços Eletrônica) a partir de Recibos Provisórios de Serviços (RPS).\n\n1. ALÍQUOTAS DE ISS (Imposto sobre Serviços):\nAs alíquotas do ISS em São Paulo mudam conforme o código do serviço paulistano (atividades exercidas), variando de 2% (alíquota mínima constitucional) até 5% (alíquota máxima).\n- Retenção na Fonte: Alguns serviços estão sujeitos à retenção do ISS pelo tomador de acordo com a Lei Municipal nº 13.701/2003. Em caso de retenção, a flag "iss_retained" deve ser habilitada para deduzir o valor no cálculo final de liquidação.\n\n2. NBS (Nomenclatura Brasileira de Serviços):\nA classificação correta pela NBS é obrigatória em São Paulo para determinar a correlação tributária precisa. O preenchimento nulo ou inadequado pode ocasionar rejeição das notas pela prefeitura ou enquadramento incorreto de alíquota.\n\n3. PRAZO DE CONVERSÃO:\nTodo RPS gerado no FinanAI deve ser transmitido e convertido em NFS-e paulistana definitiva em até 10 dias corridos a partir da data de sua emissão, sem ultrapassar o dia 5 do mês subsequente ao prestado, sob risco de retenções retroativas e penalidades.`,
              company_id: null
            }])
            .select();
            
          if (!insertError && insertedData && insertedData.length > 0) {
            finalData = [insertedData[0], ...finalData];
          } else {
            console.warn("Insert returned error or empty, using in-memory fallback:", insertError);
            const fallbackArticle: KnowledgeBaseArticle = {
              id: 'sp_fallback_id',
              category: 'NFS-e',
              title: 'Diretrizes de Emissão NFS-e SP (Prefeitura de São Paulo): ISS e NBS',
              content: `A prefeitura municipal de São Paulo possui diretrizes específicas para a emissão de NFS-e (Nota Fiscal de Serviços Eletrônica) a partir de Recibos Provisórios de Serviços (RPS).\n\n1. ALÍQUOTAS DE ISS (Imposto sobre Serviços):\nAs alíquotas do ISS em São Paulo mudam conforme o código do serviço paulistano (atividades exercidas), variando de 2% (alíquota mínima constitucional) até 5% (alíquota máxima).\n- Retenção na Fonte: Alguns serviços estão sujeitos à retenção do ISS pelo tomador de acordo com a Lei Municipal nº 13.701/2003. Em caso de retenção, a flag "iss_retained" deve ser habilitada para deduzir o valor no cálculo final de liquidação.\n\n2. NBS (Nomenclatura Brasileira de Serviços):\nA classificação correta pela NBS é obrigatória em São Paulo para determinar a correlação tributária precisa. O preenchimento nulo ou inadequado pode ocasionar rejeição das notas pela prefeitura ou enquadramento incorreto de alíquota.\n\n3. PRAZO DE CONVERSÃO:\nTodo RPS gerado no FinanAI deve ser transmitido e convertido em NFS-e paulistana definitiva em até 10 dias corridos a partir da data de sua emissão, sem ultrapassar o dia 5 do mês subsequente ao prestado, sob risco de retenções retroativas e penalidades.`,
              company_id: null,
              created_at: new Date().toISOString()
            };
            finalData = [fallbackArticle, ...finalData];
          }
        } catch (e) {
          console.error("Failed to insert SP article in DB, showing local fallback:", e);
          const fallbackArticle: KnowledgeBaseArticle = {
            id: 'sp_fallback_id',
            category: 'NFS-e',
            title: 'Diretrizes de Emissão NFS-e SP (Prefeitura de São Paulo): ISS e NBS',
            content: `A prefeitura municipal de São Paulo possui diretrizes específicas para a emissão de NFS-e (Nota Fiscal de Serviços Eletrônica) a partir de Recibos Provisórios de Serviços (RPS).\n\n1. ALÍQUOTAS DE ISS (Imposto sobre Serviços):\nAs alíquotas do ISS em São Paulo mudam conforme o código do serviço paulistano (atividades exercidas), variando de 2% (alíquota mínima constitucional) até 5% (alíquota máxima).\n- Retenção na Fonte: Alguns serviços estão sujeitos à retenção do ISS pelo tomador de acordo com a Lei Municipal nº 13.701/2003. Em caso de retenção, a flag "iss_retained" deve ser habilitada para deduzir o valor no cálculo final de liquidação.\n\n2. NBS (Nomenclatura Brasileira de Serviços):\nA classificação correta pela NBS é obrigatória em São Paulo para determinar a correlação tributária precisa. O preenchimento nulo ou inadequado pode ocasionar rejeição das notas pela prefeitura ou enquadramento incorreto de alíquota.\n\n3. PRAZO DE CONVERSÃO:\nTodo RPS gerado no FinanAI deve ser transmitido e convertido em NFS-e paulistana definitiva em até 10 dias corridos a partir da data de sua emissão, sem ultrapassar o dia 5 do mês subsequente ao prestado, sob risco de retenções retroativas e penalidades.`,
            company_id: null,
            created_at: new Date().toISOString()
          };
          finalData = [fallbackArticle, ...finalData];
        }
      }
      
      setArticles(finalData);
    } catch (err: any) {
      console.error('Error loading knowledge base:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle?.title || !editingArticle?.category || !editingArticle?.content) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editingArticle.id;
      const payload: any = {
        title: editingArticle.title,
        category: editingArticle.category,
        content: editingArticle.content,
        // Mark as company-specific unless master user explicitly wants to create global support articles
        company_id: currentUser.is_master && editingArticle.company_id === null ? null : currentUser.company_id
      };

      if (isNew) {
        const { error } = await supabase.from('knowledge_base').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('knowledge_base')
          .update(payload)
          .eq('id', editingArticle.id);
        if (error) throw error;
      }

      setEditingArticle(null);
      await fetchArticles();
      alert(isNew ? 'Artigo criado com sucesso!' : 'Artigo atualizado com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar artigo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este artigo da base de conhecimento?')) return;

    try {
      const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
      if (error) throw error;
      
      setArticles(prev => prev.filter(a => a.id !== id));
      if (readingArticle?.id === id) setReadingArticle(null);
      alert('Artigo removido com sucesso!');
    } catch (err: any) {
      alert('Erro ao excluir artigo: ' + err.message);
    }
  };

  // Filter articles local state
  const filteredArticles = articles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(search.toLowerCase()) || 
                          art.category.toLowerCase().includes(search.toLowerCase()) ||
                          art.content.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || art.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const isEditable = (art: KnowledgeBaseArticle) => {
    // Users can edit their company-specific articles. Master users can edit all.
    if (currentUser.is_master) return true;
    return art.company_id === currentUser.company_id;
  };

  const isAdmin = currentUser.role === 'MANAGER' || currentUser.is_master;

  return (
    <div id="knowledge_base_manager_container" className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 dark:bg-slate-950 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl opacity-50" />
        <div className="z-10">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <BookOpen size={24} />
            </span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={12} /> Inteligência Integrada
            </span>
          </div>
          <h1 className="text-3xl font-black text-white mt-3 tracking-tight">Base de Conhecimento</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1">Navegue pelas documentações, diretrizes tributárias e notas fiscais para embasar a IA</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setEditingArticle({ title: '', category: 'NFS-e', content: '', company_id: currentUser.company_id })}
            className="z-10 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-4 rounded-[2rem] text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center gap-2"
          >
            <Plus size={16} /> Adicionar Documento
          </button>
        )}
      </div>

      {/* FILTER & SEARCH COMPONENT */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="relative w-full md:flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar artigos por título, conteúdo ou palavras-chave..." 
            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-slate-400 shrink-0" />
          <select 
            className="w-full md:w-48 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 px-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="all">Todas as Categorias</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ARTICLES GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Consultando Registro Fiscal...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-12 rounded-[2rem] text-center max-w-xl mx-auto space-y-4">
          <AlertCircle size={40} className="text-slate-400 mx-auto" />
          <h3 className="text-base font-black text-slate-800 dark:text-white">Nenhum documento encontrado</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-relaxed">Não localizamos artigos para os critérios pesquisados. Crie documentações para enriquecer o raciocínio da inteligência artificial.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredArticles.map(art => {
            const isGlobal = !art.company_id;
            return (
              <div 
                key={art.id} 
                className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-xl flex flex-col justify-between hover:border-emerald-500/30 transition-all hover:translate-y-[-2px] group"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-full">
                      {art.category}
                    </span>
                    {isGlobal ? (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full flex items-center gap-1">
                        <Sparkles size={10} /> Global
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-full">
                        Empresa
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight group-hover:text-emerald-500 transition-colors">
                    {art.title}
                  </h3>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold font-sans line-clamp-3">
                    {art.content}
                  </p>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => setReadingArticle(art)}
                    className="text-xs font-black text-emerald-500 group-hover:underline uppercase tracking-wider flex items-center gap-1.5"
                  >
                    Ler Artigo Completo
                  </button>

                  {isEditable(art) && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingArticle(art)} 
                        className="p-2 text-slate-400 hover:text-indigo-500 bg-slate-50 dark:bg-slate-950 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-all"
                        title="Editar Artigo"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteArticle(art.id)} 
                        className="p-2 text-slate-400 hover:text-rose-500 bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all"
                        title="Excluir Artigo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* READ MODAL */}
      {readingArticle && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 rounded-t-3xl">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full">
                  {readingArticle.category}
                </span>
                <h3 className="text-lg font-black text-slate-850 dark:text-white mt-2 leading-tight">
                  {readingArticle.title}
                </h3>
              </div>
              <button 
                onClick={() => setReadingArticle(null)}
                className="p-2 text-slate-450 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar text-slate-700 dark:text-slate-300">
              <p className="text-xs leading-relaxed font-bold font-sans whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                {readingArticle.content}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-3xl">
              {isEditable(readingArticle) && (
                <button 
                  onClick={() => {
                    setEditingArticle(readingArticle);
                    setReadingArticle(null);
                  }}
                  className="bg-indigo-600 text-white font-black px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition"
                >
                  Editar Artigo
                </button>
              )}
              <button 
                onClick={() => setReadingArticle(null)}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:scale-[1.01] transition"
              >
                Fechar Artigo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE & EDIT FORM MODAL */}
      {editingArticle && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Form */}
            <form onSubmit={handleSaveArticle} className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 rounded-t-3xl">
                <div>
                  <h3 className="text-lg font-black text-slate-850 dark:text-white flex items-center gap-2">
                    <Sparkles className="text-emerald-500" size={18} />
                    {editingArticle.id ? 'Editar Documento' : 'Novo Documento Inteligente'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Insira as diretrizes fiscais e tributárias para alimentar o sistema</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingArticle(null)}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Título da Documentação</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Alíquotas de ISS Retido São Paulo" 
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 px-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={editingArticle.title || ''}
                    onChange={e => setEditingArticle(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                    required
                  />
                </div>

                {/* Grid Category & Scope */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Categoria</label>
                    <select 
                      className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 px-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={editingArticle.category || 'NFS-e'}
                      onChange={e => setEditingArticle(prev => prev ? ({ ...prev, category: e.target.value as any }) : null)}
                      required
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Scope/Company Mode */}
                  <div className="space-y-4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Escopo de Publicação</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingArticle(prev => prev ? ({ ...prev, company_id: currentUser.company_id }) : null)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all border ${editingArticle.company_id ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/10' : 'bg-slate-50 dark:bg-slate-950/30 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                      >
                        Empresa Local
                      </button>
                      <button
                        type="button"
                        disabled={!currentUser.is_master}
                        onClick={() => setEditingArticle(prev => prev ? ({ ...prev, company_id: null }) : null)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all border ${!editingArticle.company_id ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-slate-50 dark:bg-slate-950/30 text-slate-400 border-slate-105 dark:border-slate-800'} ${!currentUser.is_master ? 'opacity-40 cursor-not-allowed' : ''}`}
                        title={!currentUser.is_master ? 'Apenas administradores master criam artigos globais' : ''}
                      >
                        Global (Sistema)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Conteúdo / Artigo Completo</label>
                  <textarea 
                    rows={8}
                    placeholder="Escreva detalhadamente as regras de cálculo, portarias, alíquotas de ISS, diretrizes de preenchimento ou regras do negócio. O agente de IA lerá esses dados em tempo real ao interagir no chat com os usuários..." 
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 custom-scrollbar leading-relaxed"
                    value={editingArticle.content || ''}
                    onChange={e => setEditingArticle(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                    required
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/20 rounded-b-3xl">
                <button 
                  type="button"
                  onClick={() => setEditingArticle(null)}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-black px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/10 flex items-center gap-2 transition"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-emerald-500 rounded-full animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {editingArticle.id ? 'Atualizar Documento' : 'Salvar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
