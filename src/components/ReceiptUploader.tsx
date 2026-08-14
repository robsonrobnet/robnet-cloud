import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Camera, 
  FileText, 
  Sparkles, 
  Check, 
  X, 
  Calendar, 
  DollarSign, 
  Tag, 
  Building2, 
  User, 
  CreditCard, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  ListOrdered, 
  Eye, 
  Maximize2 
} from 'lucide-react';
import { Category, Company, Transaction, TransactionScope, User as UserType } from '../types';
import { scanReceiptWithGemini, ReceiptOcrResult } from '../services/geminiService';

interface ReceiptUploaderProps {
  onAddTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  categories: Category[];
  companies: Company[];
  currentUser: UserType;
  onClose?: () => void;
  onSuccess?: (extracted: ReceiptOcrResult, transaction: any) => void;
  initialImage?: string | null;
  isOpen?: boolean;
}

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({
  onAddTransaction,
  categories,
  companies,
  currentUser,
  onClose,
  onSuccess,
  initialImage = null,
  isOpen = true
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImage);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showItems, setShowItems] = useState(false);

  // Form Fields extracted via Gemini OCR
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [categoryId, setCategoryId] = useState<string>('');
  const [scope, setScope] = useState<TransactionScope>('BUSINESS');
  const [companyId, setCompanyId] = useState<string>(currentUser.company_id || (companies[0]?.id || ''));
  const [paymentMethod, setPaymentMethod] = useState('Cartão de Crédito');
  const [bankName, setBankName] = useState('');
  const [entityName, setEntityName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Auto-scan if initial image provided
  useEffect(() => {
    if (initialImage && !description) {
      processBase64Image(initialImage, 'image/jpeg');
    }
  }, [initialImage]);

  // Global Paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              handleFileSelected(blob);
              break;
            }
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleFileSelected = (selected: File) => {
    setErrorMsg(null);
    setIsSuccess(false);
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPreviewUrl(base64);
      processBase64Image(base64, selected.type || 'image/jpeg');
    };
    reader.onerror = () => {
      setErrorMsg("Falha ao ler o arquivo selecionado.");
    };
    reader.readAsDataURL(selected);
  };

  const processBase64Image = async (base64String: string, mime: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    setScanStep('Enviando documento para o Gemini Vision...');

    try {
      setTimeout(() => setScanStep('Lendo OCR e localizando valores...'), 800);
      setTimeout(() => setScanStep('Extraindo Data, Valor, Estabelecimento e Categoria...'), 1800);

      const categoryNames = categories.map(c => c.name);
      const result = await scanReceiptWithGemini(base64String, categoryNames, mime);

      // Pre-fill extracted fields
      if (result.description) {
        setDescription(result.description);
      } else if (result.entity_name) {
        setDescription(result.entity_name);
      } else {
        setDescription('Recibo / Despesa');
      }

      if (result.amount !== undefined && result.amount !== null) {
        setAmount(result.amount);
      }

      if (result.date && !isNaN(Date.parse(result.date))) {
        setDate(result.date);
      }

      if (result.type) {
        setType(result.type);
      }

      if (result.entity_name) {
        setEntityName(result.entity_name);
      }

      if (result.document_number) {
        setDocumentNumber(result.document_number);
      }

      if (result.payment_method) {
        setPaymentMethod(result.payment_method);
      }

      if (result.bank_name) {
        setBankName(result.bank_name);
      }

      if (result.confidence_score) {
        setConfidenceScore(result.confidence_score);
      }

      if (result.items && Array.isArray(result.items)) {
        setExtractedItems(result.items);
      }

      // Smart category matching
      if (result.category) {
        const found = categories.find(c => c.name.toLowerCase() === result.category?.toLowerCase())
          || categories.find(c => c.name.toLowerCase().includes(result.category?.toLowerCase() || ''))
          || categories.find(c => result.category?.toLowerCase().includes(c.name.toLowerCase()));
        if (found) {
          setCategoryId(found.id);
        } else if (categories.length > 0) {
          setCategoryId(categories[0].id);
        }
      } else if (categories.length > 0 && !categoryId) {
        setCategoryId(categories[0].id);
      }

    } catch (err: any) {
      console.error("OCR Exception:", err);
      setErrorMsg(err.message || "Não foi possível extrair dados automaticamente do recibo. Você pode preencher manualmente abaixo.");
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!description.trim()) {
      setErrorMsg("Por favor, preencha a descrição do recibo.");
      return;
    }

    const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Por favor, informe um valor válido para o lançamento.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const selectedCategory = categories.find(c => c.id === categoryId);
      const effectiveCompanyId = (scope === 'BUSINESS' ? companyId : undefined) 
        || currentUser.company_id 
        || (companies[0]?.id || 'default');
      
      const payload: Omit<Transaction, 'id' | 'createdAt'> = {
        description: description.trim(),
        amount: Math.abs(numAmount),
        date: date || new Date().toISOString().split('T')[0],
        due_date: date || new Date().toISOString().split('T')[0],
        type: type,
        status: 'PAID', // Recibos físicos/comprovantes já são despesas quitadas
        category: selectedCategory?.name || 'Outros',
        category_id: categoryId || undefined,
        scope: scope,
        company_id: effectiveCompanyId,
        cost_type: 'VARIABLE',
        user_id: currentUser.id
      };

      // Call handleAddTransaction directly
      await onAddTransaction(payload);

      setIsSuccess(true);

      if (onSuccess) {
        onSuccess(
          {
            date,
            amount: numAmount,
            description,
            type,
            category: selectedCategory?.name,
            entity_name: entityName,
            document_number: documentNumber,
            payment_method: paymentMethod,
            bank_name: bankName,
            items: extractedItems,
            confidence_score: confidenceScore || 95
          },
          payload
        );
      }

      // Close modal or reset after brief success moment
      setTimeout(() => {
        if (onClose) onClose();
      }, 1400);

    } catch (err: any) {
      console.error("Erro ao salvar transação do recibo:", err);
      setErrorMsg(err.message || "Erro ao registrar o lançamento no fluxo financeiro.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('EXPENSE');
    setCategoryId(categories[0]?.id || '');
    setEntityName('');
    setDocumentNumber('');
    setPaymentMethod('Cartão de Crédito');
    setExtractedItems([]);
    setConfidenceScore(null);
    setErrorMsg(null);
    setIsSuccess(false);
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
      
      {/* HEADER */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              Leitor de Recibos OCR (Gemini Vision)
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Extração Automática de Data, Valor & Descrição
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {previewUrl && !isScanning && (
            <button 
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"
              title="Escanear Novo Recibo"
            >
              <RefreshCw size={16} />
            </button>
          )}
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
        
        {/* SUCCESS NOTIFICATION */}
        {isSuccess && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                Lançamento Registrado com Sucesso!
              </p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                O recibo foi processado e adicionado ao seu fluxo financeiro.
              </p>
            </div>
          </div>
        )}

        {/* ERROR NOTIFICATION */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-3 animate-in fade-in">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          </div>
        )}

        {/* UPLOAD / DROPZONE (When no image or changing image) */}
        {!previewUrl && (
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 rounded-3xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center gap-4"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              className="hidden" 
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
            />

            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
              <UploadCloud size={32} />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-black text-slate-800 dark:text-white">
                Arraste seu recibo ou cupom fiscal aqui
              </p>
              <p className="text-xs text-slate-400 font-semibold">
                Suporta fotos (JPG, PNG, WEBP), PDFs e comprovantes de pagamento
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest pt-1">
                Ou pressione Ctrl+V para colar um print
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2"
              >
                <FileText size={14} /> Selecionar Arquivo
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-2"
              >
                <Camera size={14} /> Tirar Foto / Câmera
              </button>
            </div>
          </div>
        )}

        {/* IMAGE PREVIEW & SCANNING STATUS */}
        {previewUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Document View */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 group">
                <img 
                  src={previewUrl} 
                  alt="Recibo Escaneado" 
                  className="w-full h-56 md:h-72 object-contain bg-slate-900"
                  referrerPolicy="no-referrer"
                />

                {/* Laser Scanning Animation Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-pulse"></div>
                    <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3 text-center max-w-[90%]">
                      <Loader2 className="animate-spin text-emerald-400" size={28} />
                      <div className="space-y-1">
                        <p className="text-xs font-black text-white uppercase tracking-wider">
                          OCR com Gemini Vision
                        </p>
                        <p className="text-[11px] text-emerald-400 font-semibold animate-pulse">
                          {scanStep || 'Processando documento...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top overlay badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                    <FileText size={10} className="text-emerald-400" />
                    Recibo
                  </span>
                  {confidenceScore !== null && (
                    <span className="bg-emerald-950/80 backdrop-blur-md text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border border-emerald-500/30">
                      {confidenceScore}% Precisão
                    </span>
                  )}
                </div>

                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowFullImage(true)}
                    className="p-1.5 bg-slate-900/80 backdrop-blur-md text-white hover:text-emerald-400 rounded-lg transition-colors"
                    title="Ver Imagem Completa"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-1.5 bg-slate-900/80 backdrop-blur-md text-white hover:text-rose-400 rounded-lg transition-colors"
                    title="Trocar Recibo"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Quick Summary of Extracted OCR */}
              {entityName && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 text-xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Estabelecimento Identificado:
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {entityName} {documentNumber ? `(${documentNumber})` : ''}
                  </span>
                </div>
              )}

              {/* Itemized list toggle */}
              {extractedItems.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-3">
                  <button
                    type="button"
                    onClick={() => setShowItems(!showItems)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <ListOrdered size={14} className="text-emerald-500" />
                      {extractedItems.length} Itens do Cupom
                    </span>
                    <span className="text-[10px] uppercase text-emerald-600 font-black">
                      {showItems ? 'Ocultar' : 'Ver Detalhes'}
                    </span>
                  </button>

                  {showItems && (
                    <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {extractedItems.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                          <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                            {it.quantity ? `${it.quantity}x ` : ''}{it.description || 'Item'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            R$ {(it.total || it.unit_price || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Extracted Fields Edit & Confirm Form */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} /> Dados Extraídos do Recibo
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Revise e confirme antes de lançar
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Descrição */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                    Descrição / Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Supermercado Pão de Açúcar - Compras"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs md:text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Valor & Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                      Valor Total (R$) *
                    </label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-8 text-xs md:text-sm font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                      Data da Despesa / Emissão *
                    </label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-8 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Tipo & Categoria */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                      Tipo de Lançamento
                    </label>
                    <div className="flex gap-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setType('EXPENSE')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                          type === 'EXPENSE' 
                            ? 'bg-rose-500 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        Saída / Despesa
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('INCOME')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                          type === 'INCOME' 
                            ? 'bg-emerald-500 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        Entrada / Receita
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 flex items-center gap-1">
                      <Tag size={10} /> Categoria
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Selecione uma Categoria...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Escopo & Empresa (PJ / PF) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                      Entidade
                    </label>
                    <div className="flex gap-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setScope('BUSINESS')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          scope === 'BUSINESS' 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Building2 size={12} /> PJ (Empresa)
                      </button>
                      <button
                        type="button"
                        onClick={() => setScope('PERSONAL')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          scope === 'PERSONAL' 
                            ? 'bg-teal-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <User size={12} /> PF (Pessoal)
                      </button>
                    </div>
                  </div>

                  {scope === 'BUSINESS' ? (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                        Empresa Vinculada
                      </label>
                      <select
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        {companies.map((comp) => (
                          <option key={comp.id} value={comp.id}>{comp.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                        Forma de Pagamento
                      </label>
                      <input
                        type="text"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        placeholder="Ex: Pix, Cartão Nubank"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
                  >
                    Descartar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || isScanning}
                    className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Salvando Lançamento...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Lançar no Fluxo Financeiro
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

      </div>

      {/* FULL IMAGE MODAL */}
      {showFullImage && previewUrl && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl p-2 border border-white/10">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute -top-3 -right-3 p-2 bg-rose-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <X size={16} />
            </button>
            <img 
              src={previewUrl} 
              alt="Recibo Full" 
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default ReceiptUploader;
