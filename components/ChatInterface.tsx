
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Loader2, Sparkles, Mic, MicOff, X, Building2, User, FileText, FileSpreadsheet, File, Maximize2, Check, Calendar as CalendarIcon, DollarSign, Tag, AlertTriangle, Trash2, ArrowRight, Clock, Calendar, FileCode } from 'lucide-react';
import { ChatMessage, Transaction, User as UserType, Language, TransactionScope, Company, Category } from '../types';
import { analyzeFinancialInput, Attachment } from '../services/geminiService';
import { FinancialService } from '../services/financialService';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onAddTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onSaveMessage: (msg: ChatMessage) => void;
  currentUser: UserType;
  t: any;
  currentLang: Language;
  onClose?: () => void; 
  transactions?: Transaction[];
  categories: Category[];
  companies: Company[]; 
  onUpdateData?: () => void; // New prop to trigger global refresh after edits
}

const STATUS_MAP: Record<string, string> = {
    'PAID': 'Baixado',
    'PENDING': 'Pendente',
    'OVERDUE': 'Em Atraso'
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, setMessages, onAddTransaction, onSaveMessage, currentUser, t, currentLang, onClose, transactions = [], categories, companies, onUpdateData }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null); // For Images
  
  const [manualScope, setManualScope] = useState<TransactionScope | 'AUTO'>('AUTO');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Recognition Refs
  const recognitionRef = useRef<any>(null);
  const silenceTimer = useRef<any>(null);

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<Partial<Transaction>[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<{ id: string; fields: Partial<Transaction> }[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);

  // ... (Voice recognition logic) ...
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // IMPROVED CONFIGURATION FOR LONGER PAUSES
      recognitionRef.current.continuous = true; // Keep listening even after a pause
      recognitionRef.current.interimResults = true; 
      recognitionRef.current.lang = currentLang === 'pt' ? 'pt-BR' : 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        // Clear silence timer on every result (user is speaking)
        if (silenceTimer.current) clearTimeout(silenceTimer.current);

        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        
        if (finalTranscript) {
            setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
        }

        // Set a new silence timer (Wait 2.5 seconds of silence before stopping)
        silenceTimer.current = setTimeout(() => {
            if (recognitionRef.current && isListening) {
                recognitionRef.current.stop();
                setIsListening(false);
            }
        }, 2500);
      };

      recognitionRef.current.onerror = () => {
          setIsListening(false);
          if (silenceTimer.current) clearTimeout(silenceTimer.current);
      };
      
      // Removing direct onend=false to prevent premature stopping, handled by timer/manual toggle
      recognitionRef.current.onend = () => {
          // Only truly stop if we are not intending to listen (fallback)
          // setIsListening(false); 
      };
    }
    
    return () => {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [currentLang]);

  const toggleListening = () => {
    if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
    } else { 
        setIsListening(true); 
        try {
            recognitionRef.current?.start();
        } catch (e) {
            console.error("Mic start error", e);
            setIsListening(false);
        }
    }
  };

  useEffect(() => {
    if (scrollRef.current) setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  }, [messages, isLoading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else setFilePreview(null);
    }
  };

  // --- NEW: PASTE HANDLER ---
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                e.preventDefault(); // Prevent pasting binary string
                setSelectedFile(file);
                
                const reader = new FileReader();
                reader.onloadend = () => setFilePreview(reader.result as string);
                reader.readAsDataURL(file);
                return; // Stop after first image found
            }
        }
    }
  };

  const clearFile = () => { setSelectedFile(null); setFilePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const getDatabaseContext = () => {
    if (!transactions || transactions.length === 0) return "Nenhum dado no banco.";
    const recent = transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 200);
    const header = "ID,Data,Descrição,Valor,Tipo,Status,Categoria,Contexto(PJ/PF)";
    const rows = recent.map(t => `${t.id},${t.date},${t.description.replace(/,/g, ' ')},${t.amount},${t.type},${t.status},${t.category},${t.scope || 'BUSINESS'}`).join('\n');
    return `\nDADOS DO BANCO DE DADOS (Últimos 200 lançamentos com ID):\n${header}\n${rows}`;
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;
    
    // Stop listening if sending manually
    if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: selectedFile ? `[Arquivo: ${selectedFile.name}] ${input}` : input, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    onSaveMessage(userMsg);
    
    const currentInput = input;
    const currentFile = selectedFile;
    const forcedScope = manualScope;
    
    // Detect file type for auto-processing logic
    const isAutoProcessFile = currentFile && (
        currentFile.name.toLowerCase().endsWith('.ofx') ||
        currentFile.name.toLowerCase().endsWith('.pdf') ||
        currentFile.name.toLowerCase().endsWith('.csv') ||
        currentFile.name.toLowerCase().endsWith('.txt') ||
        currentFile.name.toLowerCase().endsWith('.xlsx') ||
        currentFile.name.toLowerCase().endsWith('.xls')
    );

    setInput(''); clearFile(); setIsLoading(true);

    let attachment: Attachment | undefined;
    if (currentFile) {
      attachment = await new Promise<Attachment>((resolve, reject) => {
        const reader = new FileReader();
        const fileName = currentFile.name.toLowerCase();
        
        // 1. PROCESSAMENTO DE EXCEL (XLSX/XLS) -> CONVERTER PARA CSV
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
           reader.readAsArrayBuffer(currentFile);
           reader.onload = (e) => {
              try {
                  const data = new Uint8Array(e.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(data, { type: 'array' });
                  const firstSheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[firstSheetName];
                  // Converte para CSV para a IA ler facilmente como texto
                  const csv = XLSX.utils.sheet_to_csv(worksheet);
                  resolve({ mimeType: 'text/csv', data: csv });
              } catch (err) {
                  console.error("Erro ao converter Excel", err);
                  reject(err);
              }
           };
        }
        // 2. PROCESSAMENTO DE TEXTO (CSV, OFX, TXT)
        else if (fileName.endsWith('.csv') || fileName.endsWith('.ofx') || fileName.endsWith('.txt')) {
          reader.readAsText(currentFile);
          reader.onload = () => resolve({ mimeType: fileName.endsWith('.ofx') ? 'text/ofx' : 'text/csv', data: reader.result as string });
        } 
        // 3. PROCESSAMENTO DE IMAGEM/PDF (OCR Nativo do Gemini)
        else {
          reader.readAsDataURL(currentFile);
          reader.onload = () => resolve({ mimeType: currentFile.type || 'application/pdf', data: reader.result as string });
        }
      });
    }

    let promptText = forcedScope !== 'AUTO' ? `${currentInput}. (Force Context: ${forcedScope})` : currentInput;
    const dbContext = getDatabaseContext();
    const chatHistory = updatedMessages.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content || '' }] })); chatHistory.pop();

    const result = await analyzeFinancialInput(promptText, attachment, currentLang, dbContext, chatHistory);
    
    let hasPendingActions = false;
    
    // --- LÓGICA DE CADASTRO AUTOMÁTICO DE CLIENTES (NFS-e) ---
    if (result.extractedClients && result.extractedClients.length > 0) {
        for (const client of result.extractedClients) {
            if (!client.name) continue; // Skip invalid
            const { error } = await supabase.from('nfse_clients').insert([{
                ...client,
                company_id: currentUser.company_id,
                // Garantir campos mínimos se a IA não retornou
                doc_type: client.doc_type || 'CNPJ',
                address_street: client.address_street || 'Endereço não informado',
                address_number: client.address_number || 'S/N',
                address_neighborhood: client.address_neighborhood || 'Bairro não informado',
                address_zip: client.address_zip || '00000000',
                address_city_code: client.address_city_code || '3550308', // Default SP
                address_state: client.address_state || 'SP'
            }]);
            
            if (!error) {
                result.textResponse += `\n✅ **CADASTRO SUCESSO:** Cliente *${client.name}* adicionado à base NFS-e.`;
            } else {
                result.textResponse += `\n❌ **ERRO:** Falha ao cadastrar *${client.name}*: ${error.message}`;
            }
        }
    }

    // --- LÓGICA DE INSERÇÃO AUTOMÁTICA DE TRANSAÇÕES ---
    if (result.extractedTransactions && result.extractedTransactions.length > 0) {
      if (isAutoProcessFile) {
          // Processa Automaticamente sem Modal para arquivos estruturados
          let importedCount = 0;
          result.extractedTransactions.forEach(t => {
              const payload = {
                  ...t,
                  scope: forcedScope !== 'AUTO' ? forcedScope : (t.scope || 'BUSINESS'),
                  company_id: currentUser.company_id,
                  date: t.date || new Date().toISOString().split('T')[0],
                  // Tenta resolver o nome da categoria ou usa o sugerido
                  category: t.category || categories.find(c => c.id === t.category_id)?.name || 'Outros'
              };
              onAddTransaction(payload as any);
              importedCount++;
          });
          
          // Adiciona feedback na mensagem da IA
          result.textResponse += `\n\n✅ **IMPORTAÇÃO AUTOMÁTICA:** ${importedCount} registros foram processados e incluídos diretamente do arquivo ${currentFile?.name.split('.').pop()?.toUpperCase()}.`;
          setPendingTransactions([]); // Limpa pendências para não abrir modal
      } else {
          // Processo Manual (Imagens / Texto) -> Abre Modal para revisão
          setPendingTransactions(result.extractedTransactions.map(t => ({...t, scope: forcedScope !== 'AUTO' ? forcedScope : (t.scope || 'BUSINESS'), company_id: currentUser.company_id, date: t.date || new Date().toISOString().split('T')[0]})));
          hasPendingActions = true;
      }
    } else {
      setPendingTransactions([]);
    }

    // Updates e Deletions (Geralmente requerem confirmação por segurança)
    if (result.updates && result.updates.length > 0) {
       setPendingUpdates(result.updates.map(u => u.fields.status === 'PAID' && !u.fields.date ? { ...u, fields: { ...u.fields, date: new Date().toISOString().split('T')[0] } } : u));
       hasPendingActions = true;
    } else setPendingUpdates([]);

    if (result.deletions && result.deletions.length > 0) {
        setPendingDeletions(result.deletions);
        hasPendingActions = true;
    } else setPendingDeletions([]);

    if (hasPendingActions) setShowReviewModal(true);

    const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: result.textResponse, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    onSaveMessage(aiMsg);
    setIsLoading(false);
  };

  // ... (Modal logic same as before, focusing on Render of Updates) ...
  const handleConfirmTransaction = (index: number, t: Partial<Transaction>) => {
      onAddTransaction({ ...t, category: t.category || categories.find(c => c.id === t.category_id)?.name || 'Outros' } as any);
      const newList = [...pendingTransactions]; newList.splice(index, 1); setPendingTransactions(newList); checkIfEmpty();
  };

  const handleConfirmUpdate = async (index: number, update: { id: string, fields: any }) => {
      try { await FinancialService.updateTransaction(update.id, update.fields); if (onUpdateData) onUpdateData(); const newList = [...pendingUpdates]; newList.splice(index, 1); setPendingUpdates(newList); checkIfEmpty(); } catch (e) { alert("Erro ao atualizar: " + e); }
  };

  const handleConfirmDelete = async (index: number, id: string) => {
      try { await FinancialService.deleteTransaction(id); if (onUpdateData) onUpdateData(); const newList = [...pendingDeletions]; newList.splice(index, 1); setPendingDeletions(newList); checkIfEmpty(); } catch (e) { alert("Erro ao excluir: " + e); }
  };

  const updateUpdateField = (index: number, field: string, value: any) => { const newList = [...pendingUpdates]; newList[index].fields = { ...newList[index].fields, [field]: value }; setPendingUpdates(newList); };
  const discardAll = () => { setPendingTransactions([]); setPendingUpdates([]); setPendingDeletions([]); setShowReviewModal(false); };
  const checkIfEmpty = () => { if (pendingTransactions.length === 0 && pendingUpdates.length === 0 && pendingDeletions.length === 0) setShowReviewModal(false); };
  const updatePending = (index: number, field: string, value: any) => { const newList = [...pendingTransactions]; newList[index] = { ...newList[index], [field]: value }; setPendingTransactions(newList); };
  
  const getFileIcon = (mime: string, name: string) => { 
      if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) return <FileSpreadsheet size={20} className="text-emerald-500" />;
      if (name.endsWith('.ofx')) return <FileCode size={20} className="text-indigo-500" />;
      if (name.endsWith('.pdf')) return <FileText size={20} className="text-rose-500" />;
      return <File size={20} className="text-slate-500" />; 
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative">
      {/* REVIEW MODAL OVERLAY */}
      {showReviewModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-3xl">
                  <div><h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Sparkles size={20} className="text-emerald-500" /> Auditoria & Confirmação</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Confirme as ações sugeridas pela IA</p></div>
                  <button onClick={discardAll} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* DELETIONS */}
                  {pendingDeletions.length > 0 && (
                      <div className="space-y-3">
                          <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2"><Trash2 size={14}/> Exclusões Sugeridas</h4>
                          {pendingDeletions.map((id, idx) => {
                              const t = transactions?.find(item => item.id === id);
                              return (
                                  <div key={id} className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-4 rounded-xl flex items-center justify-between">
                                      <div><p className="font-bold text-slate-800 dark:text-white text-sm">{t?.description}</p><p className="text-xs text-slate-500">R$ {t?.amount} • {t?.date}</p></div>
                                      <button onClick={() => handleConfirmDelete(idx, id)} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Confirmar Exclusão</button>
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {/* UPDATES (Enhanced) */}
                  {pendingUpdates.length > 0 && (
                      <div className="space-y-3">
                          <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Check size={14}/> Atualizações / Pagamentos</h4>
                          {pendingUpdates.map((update, idx) => {
                              const t = transactions?.find(item => item.id === update.id);
                              const isPaying = update.fields.status === 'PAID';
                              const companyName = companies.find(c => c.id === t?.company_id)?.name || 'Corporativo';
                              const typeLabel = t?.type === 'INCOME' ? 'Receita' : 'Despesa';
                              
                              return (
                                  <div key={update.id} className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-4 rounded-xl flex flex-col gap-3">
                                      {/* Full Data Display */}
                                      <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                              <p className="font-black text-slate-800 dark:text-white text-sm">{t?.description}</p>
                                              <div className="flex flex-wrap gap-2 mt-1">
                                                  <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{t?.category}</span>
                                                  <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{companyName}</span>
                                                  <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{typeLabel}</span>
                                                  <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">Vence: {new Date(t?.due_date || t?.date || '').toLocaleDateString()}</span>
                                              </div>
                                              <p className="text-xs font-black text-slate-700 dark:text-slate-300 mt-2">
                                                  Valor: R$ {Number(t?.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                              </p>
                                          </div>
                                          <div className="flex items-center gap-2 text-indigo-500 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm">
                                              <ArrowRight size={14} />
                                              <span className="text-[10px] font-black uppercase">
                                                  {isPaying ? 'BAIXAR [PAGAR]' : 'ALTERAR'}
                                              </span>
                                          </div>
                                      </div>
                                      
                                      {/* Payment Date Input */}
                                      {isPaying && (
                                          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 mt-1">
                                              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1 mb-1">
                                                  <Calendar size={12} /> Data do Pagamento
                                              </label>
                                              <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={update.fields.date || new Date().toISOString().split('T')[0]} onChange={(e) => updateUpdateField(idx, 'date', e.target.value)} />
                                          </div>
                                      )}
                                      
                                      {/* Changes Diff Display with Status Translation */}
                                      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg text-xs border border-slate-100 dark:border-slate-800">
                                          {Object.entries(update.fields).map(([key, val]) => {
                                              if (key === 'date' && isPaying) return null; 
                                              let displayVal = String(val);
                                              if (key === 'status') displayVal = STATUS_MAP[String(val)] || val as string;
                                              return (
                                                  <div key={key} className="flex justify-between py-1 border-b border-dashed border-slate-100 dark:border-slate-800 last:border-0">
                                                      <span className="text-slate-400 font-bold uppercase text-[10px]">{key}</span>
                                                      <span className="font-black text-slate-700 dark:text-slate-300 uppercase">{displayVal}</span>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                      <button onClick={() => handleConfirmUpdate(idx, update)} className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all">Confirmar Atualização</button>
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {/* CREATIONS (Original Logic) */}
                  {pendingTransactions.length > 0 && (
                     <div className="space-y-4">
                        <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Novos Lançamentos</h4>
                        {/* ... (Pending Transactions Map as before) ... */}
                        {pendingTransactions.map((item, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label><input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white" value={item.description || ''} onChange={(e) => updatePending(idx, 'description', e.target.value)}/></div>
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label><div className="relative"><DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="number" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 pl-8 text-sm font-bold text-slate-800 dark:text-white" value={item.amount || ''} onChange={(e) => updatePending(idx, 'amount', Number(e.target.value))}/></div></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label><div className="relative"><CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="date" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 pl-8 text-xs font-bold text-slate-800 dark:text-white" value={item.date || ''} onChange={(e) => updatePending(idx, 'date', e.target.value)}/></div></div>
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entidade</label><div className="flex gap-1 p-1 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-600"><button onClick={() => updatePending(idx, 'scope', 'BUSINESS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${item.scope === 'BUSINESS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>PJ</button><button onClick={() => updatePending(idx, 'scope', 'PERSONAL')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${item.scope === 'PERSONAL' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400'}`}>PF</button></div></div>
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label><div className="flex gap-1 p-1 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-600"><button onClick={() => updatePending(idx, 'type', 'EXPENSE')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${item.type === 'EXPENSE' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400'}`}>Saída</button><button onClick={() => updatePending(idx, 'type', 'INCOME')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${item.type === 'INCOME' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>Entrada</button></div></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {item.scope === 'BUSINESS' && (<div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa Vinculada</label><select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={item.company_id || ''} onChange={(e) => updatePending(idx, 'company_id', e.target.value)}><option value="">Selecione a Empresa...</option>{companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>)}
                                    <div className={item.scope === 'PERSONAL' ? 'md:col-span-2' : ''}><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Tag size={10} /> Categoria {(!item.category_id && !item.category) && <span className="text-rose-500">*</span>}</label><select className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 ${(!item.category_id && !item.category) ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 dark:border-slate-600'}`} value={item.category_id || ''} onChange={(e) => updatePending(idx, 'category_id', e.target.value)}><option value="">Selecione...</option>{categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
                                </div>
                                <div className="flex gap-2 pt-2"><button onClick={() => { const newList = [...pendingTransactions]; newList.splice(idx, 1); setPendingTransactions(newList); checkIfEmpty(); }} className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-xl font-black text-xs uppercase hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-all">Descartar</button><button onClick={() => handleConfirmTransaction(idx, item)} className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs uppercase hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"><Check size={14} /> Confirmar</button></div>
                            </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
        </div>
      )}
      
      {/* ... (Rest of ChatInterface: Chat Bubbles, Input Bar - Unchanged) ... */}
      <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg relative transition-all ${isListening ? 'bg-rose-500 scale-110' : 'bg-emerald-600'}`}>{isListening ? <Mic size={20} className="animate-pulse" /> : <Sparkles size={20} />}{isListening && <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></span>}</div>
          <div><span className="font-black text-slate-800 dark:text-white tracking-tight block leading-tight text-sm">FinanAI Assistant</span><span className={`text-[10px] font-black uppercase tracking-widest ${isListening ? 'text-rose-500' : 'text-emerald-600'}`}>{isListening ? 'Ouvindo... (Aguardando fala)' : 'Multimodal Active'}</span></div>
        </div>
        {onClose && <button onClick={onClose} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"><X size={20} /></button>}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/30 dark:bg-slate-950/30">
        {messages.map((m) => (<div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-[2rem] p-4 md:p-5 shadow-sm border ${m.role === 'user' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-none border-slate-900 dark:border-white' : 'bg-emerald-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border-emerald-100 dark:border-slate-700'}`}><p className="text-xs md:text-sm font-medium leading-relaxed whitespace-pre-line text-current">{m.content || <span className="italic opacity-50">[Sem conteúdo de texto]</span>}</p></div></div>))}
        {isLoading && <div className="flex justify-start"><div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full px-4 py-3 flex items-center gap-3 shadow-sm"><Loader2 className="animate-spin text-emerald-600" size={16} /><span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Auditor FinanAI analisando...</span></div></div>}
      </div>
      <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shrink-0">
        {selectedFile && <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 w-fit pr-4 animate-in slide-in-from-bottom-2">{filePreview ? <img src={filePreview} className="w-10 h-10 object-cover rounded-xl border border-slate-200 dark:border-slate-600" alt="Preview" /> : <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-600">{getFileIcon(selectedFile.type, selectedFile.name)}</div>}<div className="flex flex-col"><span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate max-w-[150px]">{selectedFile.name}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{(selectedFile.size / 1024).toFixed(1)} KB</span></div><button onClick={clearFile} className="ml-2 bg-rose-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><X size={12} /></button></div>}
        <div className="flex items-center gap-2"><input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.csv,.xlsx,.xls,.ofx,.txt" onChange={handleFileSelect} /><button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-2xl flex items-center justify-center transition-all shadow-sm shrink-0 border border-slate-100 dark:border-slate-700"><Paperclip size={20} /></button><div className="flex-1 relative group"><input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-24 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/20 transition-all font-medium text-xs md:text-sm text-slate-900 dark:text-white" value={input} onChange={(e) => setInput(e.target.value)} onPaste={handlePaste} placeholder="Digite..." onKeyDown={(e) => e.key === 'Enter' && handleSend()} /><div className="absolute right-2 top-2 flex gap-1"><button onClick={toggleListening} className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-rose-100 dark:bg-rose-900 text-rose-600 animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600'}`} title="Falar Comando">{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button><button onClick={handleSend} className="w-9 h-9 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-90"><Send size={16} /></button></div></div></div>
      </div>
    </div>
  );
};

export default ChatInterface;
