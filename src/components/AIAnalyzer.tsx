
import React, { useState, useRef } from 'react';
import { 
  FileSearch, Upload, ArrowRight, Loader2, Sparkles, 
  CheckCircle2, AlertCircle, Trash2, X, Brain, Zap,
  TrendingUp, Wallet, Receipt, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeFinancialInput, Attachment } from '../services/geminiService';
import { Transaction, User, Category } from '../types';

interface AIAnalyzerProps {
  currentUser: User;
  onProcessed: (transactions: Partial<Transaction>[]) => void;
  onCancel: () => void;
}

export default function AIAnalyzer({ currentUser, onProcessed, onCancel }: AIAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        alert("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selected);
    }
  };

  const processDocument = async () => {
    if (!preview || !file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const attachment: Attachment = {
        mimeType: file.type,
        data: preview
      };

      const aiResponse = await analyzeFinancialInput(
        "Analise este documento financeiro e extraia todas as transações possíveis. Se for um extrato bancário, extraia cada linha. Se for um recibo, extraia os detalhes principais.",
        attachment,
        'pt'
      );

      if (aiResponse.extractedTransactions && aiResponse.extractedTransactions.length > 0) {
        setResult(aiResponse);
      } else {
        throw new Error(aiResponse.textResponse || "Não foi possível localizar transações neste documento.");
      }
    } catch (err: any) {
      setError(err.message || "Erro crítico na análise.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (result?.extractedTransactions) {
      onProcessed(result.extractedTransactions);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
              <Brain size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Scanner Financeiro IA</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Extração Neural de Documentos & Extratos</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {!result ? (
            <div className="space-y-8">
              {/* Dropzone */}
              {!preview ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] p-16 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-50/10 transition-all group"
                >
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 group-hover:scale-110 group-hover:text-indigo-500 transition-all duration-500">
                    <Upload size={48} />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-slate-800 dark:text-white">Selecione seu Documento</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Arraste ou clique para enviar PDF, PNG ou JPG</p>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Preview do Arquivo</h4>
                      <button onClick={() => { setFile(null); setPreview(null); }} className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1"><Trash2 size={12} /> Remover</button>
                    </div>
                    <div className="aspect-[3/4] bg-slate-950 rounded-[2.5rem] overflow-hidden border border-slate-800 flex items-center justify-center relative">
                      {file?.type === 'application/pdf' ? (
                        <div className="text-center p-8">
                          <FileSearch size={64} className="text-indigo-500 mx-auto mb-4" />
                          <p className="text-white font-bold">{file.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase mt-2">Documento PDF pronto para análise</p>
                        </div>
                      ) : (
                        <img src={preview} className="w-full h-full object-contain" alt="Document Preview" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col justify-center items-center text-center space-y-8">
                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-[2rem] flex items-center justify-center">
                      <Sparkles size={40} className={isProcessing ? 'animate-pulse' : ''} />
                    </div>
                    <div className="max-w-xs">
                      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Análise Neural Pronta</h3>
                      <p className="text-xs text-slate-400 font-bold leading-relaxed mt-4">
                        Nossa IA irá identificar automaticamente valores, datas, categorias e fornecedores deste documento.
                      </p>
                    </div>

                    {error && (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 w-full">
                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-[11px] text-rose-600 font-bold text-left leading-tight">{error}</p>
                      </div>
                    )}

                    <button 
                      onClick={processDocument}
                      disabled={isProcessing}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] py-5 font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-500/20 flex items-center justify-center gap-3 disabled:opacity-50 transition-all hover:scale-[1.02]"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          Processando Visão Computacional...
                        </>
                      ) : (
                        <>
                          <Zap size={20} />
                          Iniciar Análise IA
                        </>
                      )}
                    </button>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tempo estimado: 5-8 segundos</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4">
              <div className="bg-emerald-500 text-white p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl shadow-emerald-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><CheckCircle2 size={24} /></div>
                  <div>
                    <h4 className="font-black uppercase text-xs tracking-wider">Extração Concluída</h4>
                    <p className="text-[10px] opacity-80 font-bold uppercase">{result.extractedTransactions.length} registros identificados com sucesso</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black opacity-50 uppercase mb-1">Total Extraído</p>
                  <p className="text-xl font-black tabular-nums">R$ {result.extractedTransactions.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Dados Identificados</h4>
                <div className="grid grid-cols-1 gap-3">
                  {result.extractedTransactions.map((t: any, i: number) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl flex items-center justify-between group hover:border-indigo-200 transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                          {t.type === 'INCOME' ? <Wallet size={18} /> : <Receipt size={18} />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase line-clamp-1">{t.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                            <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase">{t.category}</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${t.scope === 'BUSINESS' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{t.scope === 'PERSONAL' ? 'Pessoal' : 'PJ'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black tabular-nums ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                          {t.type === 'INCOME' ? '+' : '-'} R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        {result && (
          <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex gap-4">
            <button 
              onClick={() => setResult(null)} 
              className="flex-1 py-4 bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-slate-50 transition-all"
            >
              Analisar Outro
            </button>
            <button 
              onClick={handleConfirm}
              className="flex-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all transform active:scale-95"
            >
              <CheckCircle2 size={18} /> Importar {result.extractedTransactions.length} Registros
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
