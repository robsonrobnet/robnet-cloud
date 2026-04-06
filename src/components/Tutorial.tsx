
import React from 'react';
import { 
  BookOpen, PlayCircle, CheckCircle2, Settings, 
  Database, Shield, LayoutGrid, HelpCircle, 
  ArrowRight, Info, Lightbulb, Sparkles, 
  Terminal, Globe, FileText, DollarSign, Brain
} from 'lucide-react';

const Tutorial: React.FC = () => {
  const steps = [
    {
      title: "Configuração Inicial",
      description: "Comece configurando seu perfil e as credenciais de serviços no painel de administração.",
      icon: <Settings size={24} />,
      items: [
        "Acesse Configurações > Admin",
        "Configure as chaves de API (Gemini, OpenAI)",
        "Configure o Banco de Dados (Supabase)",
        "Configure o Gateway de Pagamentos (Stripe)"
      ]
    },
    {
      title: "Gestão Financeira",
      description: "Lance suas receitas e despesas para ter um controle total do seu fluxo de caixa.",
      icon: <DollarSign size={24} />,
      items: [
        "Adicione transações manuais ou via Chat AI",
        "Categorize seus lançamentos para relatórios precisos",
        "Acompanhe o Dashboard em tempo real",
        "Gerencie contas a pagar e a receber"
      ]
    },
    {
      title: "NFS-e e Documentos",
      description: "Automatize a emissão de notas fiscais de serviço diretamente pelo sistema.",
      icon: <FileText size={24} />,
      items: [
        "Carregue seu Certificado Digital A1",
        "Configure os dados da prefeitura",
        "Emita notas fiscais com um clique",
        "Assine digitalmente seus documentos"
      ]
    },
    {
      title: "Inteligência Artificial",
      description: "Use o Chat AI para analisar seus dados e automatizar tarefas complexas.",
      icon: <Brain size={24} />,
      items: [
        "Pergunte sobre seu saldo e projeções",
        "Peça para criar novos lançamentos",
        "Solicite análises de categorias",
        "Obtenha insights sobre sua saúde financeira"
      ]
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4 mb-16">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-indigo-100">
          <BookOpen size={40} />
        </div>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Tutorial do Sistema</h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">Guia Completo de Configuração e Operação</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {steps.map((step, idx) => (
          <div 
            key={idx}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-xl hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">
                {step.icon}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{step.title}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Passo {idx + 1}</p>
              </div>
            </div>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8 font-medium">
              {step.description}
            </p>

            <ul className="space-y-4">
              {step.items.map((item, i) => (
                <li key={i} className="flex items-center gap-4 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wide">
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={14} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-16 bg-indigo-600 rounded-[3rem] p-12 text-center text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
          <Sparkles size={120} />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tight mb-4 relative z-10">Precisa de Ajuda Extra?</h2>
        <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mb-8 relative z-10">Nossa equipe de suporte está pronta para ajudar você a configurar seu perfil.</p>
        <button className="bg-white text-indigo-600 px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-50 transition-all shadow-xl relative z-10">
          Falar com Suporte
        </button>
      </div>
    </div>
  );
};

export default Tutorial;
