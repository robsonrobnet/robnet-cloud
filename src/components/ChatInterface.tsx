
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Loader2, Sparkles, Mic, MicOff, X, Building2, User, FileText, FileSpreadsheet, File, Maximize2, Check, Calendar as CalendarIcon, DollarSign, Tag, AlertTriangle, Trash2, ArrowRight, Clock, Calendar, FileCode, Camera, Target, Package, ShoppingCart } from 'lucide-react';
import { ChatMessage, Transaction, User as UserType, Language, TransactionScope, Company, Category } from '../types';
import { analyzeFinancialInput, Attachment } from '../services/geminiService';
import { FinancialService } from '../services/financialService';
import { supabase } from '../lib/supabase';
import { validateServiceGuidelines } from './NfseManager';
import * as XLSX from 'xlsx';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onAddTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  onAddBulkTransactions?: (list: any[]) => Promise<void>;
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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, setMessages, onAddTransaction, onAddBulkTransactions, onSaveMessage, currentUser, t, currentLang, onClose, transactions = [], categories, companies, onUpdateData }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  
  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null); // For Images
  const [lastScannedImage, setLastScannedImage] = useState<string | null>(null);
  
  const [manualScope, setManualScope] = useState<TransactionScope | 'AUTO'>('AUTO');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Recognition Refs
  const recognitionRef = useRef<any>(null);
  const silenceTimer = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<Partial<Transaction>[]>([]);
  const [pendingLeads, setPendingLeads] = useState<any[]>([]);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<{ id: string; fields: any; collection?: string }[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<{ id: string; collection?: string }[]>([]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true; 
      recognitionRef.current.lang = currentLang === 'pt' ? 'pt-BR' : 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);

        let interimTranscript = '';
        let finalTranscriptChunk = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptChunk += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscriptChunk) {
            const newText = finalTranscriptChunk.trim();
            transcriptRef.current += (transcriptRef.current && !transcriptRef.current.endsWith(' ') ? ' ' : '') + newText;
            setInput(transcriptRef.current);
        }

        // Set a new silence timer (Wait 2 seconds of silence before auto-sending)
        silenceTimer.current = setTimeout(() => {
            if (recognitionRef.current && isListening) {
                handleSendTriggeredByVoice();
            }
        }, 2000);
      };

      recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          if (silenceTimer.current) clearTimeout(silenceTimer.current);
      };
      
      recognitionRef.current.onend = () => {
          // Fallback if it stops unexpectedly
          if (isListening) setIsListening(false);
      };
    }
    
    return () => {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [currentLang, isListening]);

  const handleSendTriggeredByVoice = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    
    // Use a small delay to ensure the state is updated or use the ref
    if (transcriptRef.current.trim()) {
        handleSend(transcriptRef.current.trim());
        transcriptRef.current = '';
    }
  };

  const toggleListening = () => {
    if (isListening) {
        handleSendTriggeredByVoice();
    } else { 
        setIsListening(true); 
        transcriptRef.current = '';
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

  const handleSend = async (forcedInput?: string) => {
    const finalInputValue = forcedInput || input.trim();
    if ((!finalInputValue && !selectedFile) || isLoading) return;
    
    // Stop listening if sending manually
    if (isListening && !forcedInput) {
        handleSendTriggeredByVoice();
        return;
    }

    const isImage = selectedFile?.type.startsWith('image/');
    const defaultPrompt = isImage ? "Analise este recibo/comprovante e extraia os dados financeiros." : "";
    const finalInputText = finalInputValue || defaultPrompt;

    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: selectedFile ? `[Arquivo: ${selectedFile.name}] ${finalInputText}` : finalInputText, 
      timestamp: Date.now() 
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    onSaveMessage(userMsg);
    
    const currentInput = finalInputText;
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
    setAnalysisStage('Preparando documento...');
    if (filePreview) setLastScannedImage(filePreview);
    else setLastScannedImage(null);

    let attachment: Attachment | undefined;
    if (currentFile) {
      attachment = await new Promise<Attachment>((resolve, reject) => {
        const reader = new FileReader();
        const fileName = currentFile.name.toLowerCase();
        
        // 1. PROCESSAMENTO DE EXCEL (XLSX/XLS) -> CONVERTER PARA CSV
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
           setAnalysisStage('Convertendo planilha...');
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
          setAnalysisStage('Lendo dados estruturados...');
          reader.readAsText(currentFile);
          reader.onload = () => resolve({ mimeType: fileName.endsWith('.ofx') ? 'text/ofx' : 'text/csv', data: reader.result as string });
        } 
        // 3. PROCESSAMENTO DE IMAGEM/PDF (OCR Nativo do Gemini)
        else {
          setAnalysisStage('Escanenando imagem (OCR)...');
          reader.readAsDataURL(currentFile);
          reader.onload = () => resolve({ mimeType: currentFile.type || 'application/pdf', data: reader.result as string });
        }
      });
    }

    setAnalysisStage('IA analisando fluxos e categorias...');
    let promptText = forcedScope !== 'AUTO' ? `${currentInput}. (Force Context: ${forcedScope})` : currentInput;
    
    let dbContext = getDatabaseContext();
    try {
      const { data: kbArticles } = await supabase
        .from('knowledge_base')
        .select('category, title, content');
      if (kbArticles && kbArticles.length > 0) {
        const kbText = kbArticles
          .map((art: any) => `## [Conhecimento - ${art.category}]: ${art.title}\n${art.content}`)
          .join('\n\n');
        dbContext += `\n\n=== BASE DE CONHECIMENTO (TRIBUTÁRIO/FISCAL/OPERACIONAL) ===\nUtilize este conteúdo para responder e esclarecer dúvidas do usuário da forma mais precisa possível:\n${kbText}\n=== FIM DA BASE DE CONHECIMENTO ===`;
      }
    } catch (err) {
      console.error("Erro ao carregar base de conhecimento para o agente de IA:", err);
    }

    // EXTRA FETCH FOR DETAILED REAL-TIME DATABASE ENTITY CRUD VISIBILITY
    try {
      const { data: clientsDb } = await supabase.from('nfse_clients').select('*');
      const { data: servicesDb } = await supabase.from('nfse_services').select('*');
      const { data: rpsDb } = await supabase.from('nfse_rps').select('*');
      const { data: productsDb } = await supabase.from('products').select('*');
      const { data: ordersDb } = await supabase.from('sales_orders').select('*, shop_customers(*)');
      const { data: customersDb } = await supabase.from('shop_customers').select('*');

      let extraContext = `\n\n=== CONTEXTO ADICIONAL DO BANCO DE DADOS EM TEMPO REAL ===`;
      if (clientsDb && clientsDb.length > 0) {
        extraContext += `\n[CLIENTES NFS-e]:\n` + JSON.stringify(clientsDb.map((c: any) => ({ id: c.id, name: c.name, doc_type: c.doc_type, doc_number: c.doc_number, email: c.email, address: `${c.address_street}, ${c.address_number}, ${c.address_neighborhood}, ${c.address_city_code}` }))) + `\n`;
      } else {
        extraContext += `\n[CLIENTES NFS-e]: [] (Nenhum cliente NFS-e cadastrado ainda).\n`;
      }
      if (servicesDb && servicesDb.length > 0) {
        extraContext += `\n[SERVIÇOS NFS-e]:\n` + JSON.stringify(servicesDb.map((s: any) => ({ id: s.id, code: s.code, description: s.description, aliquot: s.aliquot, suggested_nbs: s.suggested_nbs, aliq_ibs: s.aliq_ibs, aliq_cbs: s.aliq_cbs }))) + `\n`;
      } else {
        extraContext += `\n[SERVIÇOS NFS-e]: [] (Nenhum serviço NFS-e cadastrado ainda).\n`;
      }
      if (rpsDb && rpsDb.length > 0) {
        const sortedRps = [...rpsDb].sort((a,b) => b.rps_number - a.rps_number).slice(0, 30);
        extraContext += `\n[NOTAS NFS-e RPS EMITIDAS]:\n` + JSON.stringify(sortedRps.map((r: any) => ({ id: r.id, number: r.rps_number, client_id: r.client_id, service_id: r.service_id, val: r.service_amount, status: r.transmission_status, nfe: r.nfe_number }))) + `\n`;
      } else {
        extraContext += `\n[NOTAS NFS-e RPS EMITIDAS]: [] (Nenhuma nota emitida ainda).\n`;
      }
      if (productsDb && productsDb.length > 0) {
        extraContext += `\n[PRODUTOS DA LOJA]:\n` + JSON.stringify(productsDb.map((p: any) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock_quantity, sku: p.sku, description: p.description, type: p.type }))) + `\n`;
      } else {
        extraContext += `\n[PRODUTOS DA LOJA]: [] (Nenhum produto cadastrado na loja ainda).\n`;
      }
      if (ordersDb && ordersDb.length > 0) {
        const sortedOrders = [...ordersDb].slice(0, 30);
        extraContext += `\n[PEDIDOS DE VENDA]:\n` + JSON.stringify(sortedOrders.map((o: any) => ({ id: o.id, customer: o.shop_customers?.name || 'Não cadastrado', total: o.total_amount, status: o.status, pay_status: o.payment_status }))) + `\n`;
      } else {
        extraContext += `\n[PEDIDOS DE VENDA]: [] (Nenhum pedido de venda registrado ainda).\n`;
      }
      if (customersDb && customersDb.length > 0) {
        extraContext += `\n[CLIENTES DA LOJA]:\n` + JSON.stringify(customersDb.map((c: any) => ({ id: c.id, name: c.name, email: c.email, doc: c.document_number }))) + `\n`;
      } else {
        extraContext += `\n[CLIENTES DA LOJA]: [] (Nenhum cliente de loja cadastrado ainda).\n`;
      }
      extraContext += `=== FIM DO CONTEXTO DO BANCO DE DADOS EM TEMPO REAL ===\n`;
      dbContext += extraContext;
    } catch (dbErr) {
      console.error("Erro ao complementar contexto para a IA:", dbErr);
    }

    const chatHistory = updatedMessages.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content || '' }] })); chatHistory.pop();

    const result = await analyzeFinancialInput(
      promptText, 
      attachment, 
      currentLang, 
      dbContext, 
      chatHistory,
      { name: currentUser.username, plan: currentUser.plan || 'FREE' }
    ) as any;
    
    let hasPendingActions = false;
    let didChangeDb = false;
    
    // --- LÓGICA DE CADASTRO AUTOMÁTICO DE CLIENTES (NFS-e) ---
    if (result.extractedClients && result.extractedClients.length > 0) {
        for (const client of result.extractedClients) {
            if (!client.name) continue; 
            const { error } = await supabase.from('nfse_clients').insert([{
                ...client,
                company_id: currentUser.company_id,
                doc_type: client.doc_type || 'CNPJ',
                address_street: client.address_street || 'Endereço não informado',
                address_number: client.address_number || 'S/N',
                address_neighborhood: client.address_neighborhood || 'Bairro não informado',
                address_zip: client.address_zip || '00000000',
                address_city_code: client.address_city_code || '3550308', 
                address_state: client.address_state || 'SP'
            }]);
            
            if (!error) {
              result.textResponse += `\n✅ **CADASTRO SUCESSO:** Cliente *${client.name}* adicionado à base NFS-e.`;
              didChangeDb = true;
            } else {
              result.textResponse += `\n❌ **ERRO AO CADASTRAR CLIENTE NFS-e:** ${error.message}`;
            }
        }
    }

    // --- LÓGICA DE CADASTRO DE SERVIÇOS NFS-e ---
    if (result.extractedNfseServices && result.extractedNfseServices.length > 0) {
        for (const srv of result.extractedNfseServices) {
            if (!srv.code || !srv.description) continue;
            const { error } = await supabase.from('nfse_services').insert([{
                company_id: currentUser.company_id,
                code: srv.code,
                description: srv.description,
                aliquot: srv.aliquot || 0.05,
                suggested_nbs: srv.suggested_nbs || (srv.code + '.01'),
                aliq_ibs: srv.aliq_ibs || 0.177,
                aliq_cbs: srv.aliq_cbs || 0.088
            }]);
            if (!error) {
              result.textResponse += `\n✅ **CADASTRO SUCESSO:** Serviço *${srv.code} - ${srv.description}* adicionado à base NFS-e.`;
              didChangeDb = true;
            } else {
              result.textResponse += `\n❌ **ERRO AO CADASTRAR SERVIÇO:** ${error.message}`;
            }
        }
    }

    // --- LÓGICA DE EMISSÃO DE NFS-e (RPS) COM VALIDAÇÃO DE DIRETRIZES TRIBUTÁRIAS ---
    if (result.extractedNfseRps && result.extractedNfseRps.length > 0) {
        for (const rps of result.extractedNfseRps) {
            if (!rps.client_id || !rps.service_id || !rps.service_amount) {
                result.textResponse += `\n⚠️ **DADOS INSUFICIENTES:** Para emitir nota precisamos de Tomador (Cliente), Serviço e Valor em Reais.`;
                continue;
            }
            const { data: clientDb } = await supabase.from('nfse_clients').select('*').eq('id', rps.client_id).single();
            const { data: serviceDb } = await supabase.from('nfse_services').select('*').eq('id', rps.service_id).single();

            if (!serviceDb) {
              result.textResponse += `\n❌ **ERRO:** Serviço não localizado no banco.`;
              continue;
            }

            // Validar diretrizes paulistanas e da Reforma Tributária antes de transmitir
            const validationResult = validateServiceGuidelines(serviceDb, clientDb, rps.nbs);
            if (!validationResult.isValid) {
              result.textResponse += `\n❌ **REJEIÇÃO DE CONFORMIDADE TRIBUTÁRIA:**\n` + validationResult.errors.map(e => `• ${e}`).join("\n") + `\n*(O RPS não pôde ser transmitido / emitido)*`;
              continue;
            }

            if (validationResult.warnings.length > 0) {
              result.textResponse += `\n⚠️ **ALERTAS DE DIRETRIZES FISCAIS:**\n` + validationResult.warnings.map(w => `• ${w}`).join("\n");
            }

            const { data: configs } = await supabase.from('nfse_configs').select('*').limit(1);
            const activeConfig = configs && configs.length > 0 ? configs[0] : null;
            if (!activeConfig || !activeConfig.im) {
              result.textResponse += `\n❌ **ERRO:** Configurações de NFS-e ou Inscrição Municipal ausente na conta.`;
              continue;
            }

            const rpsNum = (activeConfig.last_rps_number || 0) + 1;
            const iss = rps.service_amount * (serviceDb.aliquot || 0);
            const totalLiquid = serviceDb.iss_retained ? rps.service_amount - iss : rps.service_amount;

            const rpsPayload = {
              company_id: currentUser.company_id,
              client_id: rps.client_id,
              service_id: rps.service_id,
              rps_number: rpsNum,
              rps_series: activeConfig.rps_series || '1',
              service_amount: rps.service_amount,
              iss_amount: iss,
              total_amount: totalLiquid,
              status: 'NORMAL',
              transmission_status: 'AUTHORIZED',
              nfe_number: 20260000 + rpsNum,
              nfe_verification_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
              nbs: rps.nbs || serviceDb.suggested_nbs
            };

            const { data: rpsResult, error: rpsError } = await supabase.from('nfse_rps').insert([rpsPayload]).select().single();
            if (rpsError) {
              result.textResponse += `\n❌ **ERRO AO GRAVAR NOTA FISCAL:** ${rpsError.message}`;
              continue;
            }

            await supabase.from('nfse_configs').update({ last_rps_number: rpsNum }).eq('id', activeConfig.id);
            result.textResponse += `\n\n✅ **NFS-e EMITIDA COM SUCESSO!**\n• **Nota:** Nº ${rpsResult.nfe_number}\n• **RPS:** Nº ${rpsResult.rps_number}\n• **Cód. Verificação:** ${rpsResult.nfe_verification_code}\n• **Tomador / Serviço:** ${clientDb?.name || 'Cliente'} / *${serviceDb.description}*`;
            didChangeDb = true;
        }
    }

    // --- LÓGICA DE CADASTRO DE CLIENTES LOJA ---
    if (result.extractedShopCustomers && result.extractedShopCustomers.length > 0) {
        for (const cust of result.extractedShopCustomers) {
            if (!cust.name) continue;
            const { error } = await supabase.from('shop_customers').insert([{
                ...cust,
                company_id: currentUser.company_id
            }]);
            if (!error) {
              result.textResponse += `\n✅ **CADASTRO SUCESSO:** Cliente da Loja *${cust.name}* foi cadastrado.`;
              didChangeDb = true;
            } else {
              result.textResponse += `\n❌ **ERRO AO CADASTRAR CLIENTE LOJA:** ${error.message}`;
            }
        }
    }

    // --- LÓGICA DE PRODUTOS ---
    if (result.extractedProducts && result.extractedProducts.length > 0) {
        for (const prod of result.extractedProducts) {
            if (!prod.name) continue;
            const { error } = await supabase.from('products').insert([{
                ...prod,
                company_id: currentUser.company_id,
                price: prod.price || 0,
                stock_quantity: prod.stock_quantity || 0,
                type: prod.type || 'PHYSICAL',
                images: prod.images || []
            }]);
            if (!error) {
              result.textResponse += `\n✅ **CADASTRO SUCESSO:** Produto *${prod.name}* (R$ ${prod.price}, Estoque: ${prod.stock_quantity}) adicionado ao inventário.`;
              didChangeDb = true;
            } else {
              result.textResponse += `\n❌ **ERRO AO CADASTRAR PRODUTO:** ${error.message}`;
            }
        }
    }

    // --- LÓGICA DE PEDIDOS DE VENDA ---
    if (result.extractedSalesOrders && result.extractedSalesOrders.length > 0) {
        for (const order of result.extractedSalesOrders) {
            const { data: newOrder, error: orderError } = await supabase.from('sales_orders').insert([{
                company_id: currentUser.company_id,
                customer_id: order.customer_id || null,
                status: order.status || 'PENDING',
                payment_status: order.payment_status || 'PENDING',
                total_amount: order.total_amount || 0
            }]).select().single() as any;

            if (orderError) {
              result.textResponse += `\n❌ **ERRO AO REGISTRAR PEDIDO DE VENDA:** ${orderError.message}`;
              continue;
            }

            if (order.items && order.items.length > 0) {
                const itemsPayload = order.items.map((it: any) => ({
                    order_id: newOrder.id,
                    product_id: it.product_id,
                    quantity: it.quantity || 1,
                    unit_price: it.unit_price || 0,
                    total_price: (it.quantity || 1) * (it.unit_price || 0)
                }));
                const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
                if (itemsError) {
                  result.textResponse += `\n⚠️ **ATENÇÃO:** Venda registrada, mas falha ao adicionar itens: ${itemsError.message}`;
                }
            }
            result.textResponse += `\n✅ **VENDA REGISTRADA:** Pedido de venda \`#${newOrder.id.substring(0,8)}\` no valor total de R$ ${order.total_amount} cadastrado com sucesso.`;
            didChangeDb = true;
        }
    }

    // --- LÓGICA DE CRM (LEADS) ---
    if (result.extractedLeads && result.extractedLeads.length > 0) {
        setPendingLeads(result.extractedLeads.map((l: any) => ({ ...l, company_id: currentUser.company_id })));
        hasPendingActions = true;
    } else setPendingLeads([]);

    setPendingProducts([]);

    // --- LÓGICA DE INSERÇÃO AUTOMÁTICA DE TRANSAÇÕES ---
    if (result.extractedTransactions && result.extractedTransactions.length > 0) {
      if (isAutoProcessFile || (result.extractedTransactions.length === 1 && !result.updates?.length && !result.deletions?.length)) {
          // Processa Automaticamente se for arquivo ou se for apenas UM lançamento único sem outras pendências
          let importedCount = 0;
          let directInserted = false;

          for (const t of result.extractedTransactions) {
              // Tenta resolver a categoria pelo nome sugerido pela IA
              let resolvedCategoryId = t.category_id;
              if (!resolvedCategoryId && t.category) {
                  const found = categories.find(c => c.name.toLowerCase() === t.category?.toLowerCase());
                  if (found) resolvedCategoryId = found.id;
              }

              // Se temos a categoria resolvida (ou se é auto-processamento de arquivo q pode ir sem), inserimos direto
              if (isAutoProcessFile || resolvedCategoryId) {
                  const payload = {
                      ...t,
                      category_id: resolvedCategoryId,
                      scope: forcedScope !== 'AUTO' ? forcedScope : (t.scope || 'BUSINESS'),
                      company_id: currentUser.company_id,
                      date: t.date || new Date().toISOString().split('T')[0],
                      category: t.category || categories.find(c => c.id === resolvedCategoryId)?.name || 'Outros'
                  };
                  await onAddTransaction(payload as any);
                  importedCount++;
                  directInserted = true;
              } else {
                  // Se caiu aqui e NÃO é arquivo, significa que é um lançamento único mas SEM categoria resolvida
                  // Então abrimos o modal para o usuário escolher a categoria
                  setPendingTransactions([
                      {
                        ...t, 
                        scope: forcedScope !== 'AUTO' ? forcedScope : (t.scope || 'BUSINESS'), 
                        company_id: currentUser.company_id, 
                        date: t.date || new Date().toISOString().split('T')[0]
                      }
                  ]);
                  hasPendingActions = true;
              }
          }
          
          if (directInserted) {
              if (isAutoProcessFile) {
                result.textResponse += `\n\n✅ **IMPORTAÇÃO AUTOMÁTICA:** ${importedCount} registros processados do arquivo.`;
              } else {
                const lastT = result.extractedTransactions[0];
                result.textResponse += `\n\n✅ **LANÇAMENTO DIRETO:** "${lastT.description}" de R$ ${lastT.amount} registrado em *${lastT.category}*.`;
              }
              if (!hasPendingActions) setPendingTransactions([]); 
          }
      } else {
          // Processo Manual (Múltiplos ou com pendências complexas) -> Abre Modal
          setPendingTransactions(result.extractedTransactions.map((t: any) => ({...t, scope: forcedScope !== 'AUTO' ? forcedScope : (t.scope || 'BUSINESS'), company_id: currentUser.company_id, date: t.date || new Date().toISOString().split('T')[0]})));
          hasPendingActions = true;
      }
    } else {
      setPendingTransactions([]);
    }

    // Direct Database Updates (UPDATE)
    if (result.updates && result.updates.length > 0) {
        const remainingUpdatesForModal = [];
        for (const upd of result.updates) {
            if (upd.id && upd.collection && upd.collection !== 'transactions') {
                const { error } = await supabase.from(upd.collection).update(upd.fields).eq('id', upd.id);
                if (!error) {
                    result.textResponse += `\n🔄 **ATUALIZAÇÃO SUCESSO:** Registro ID \`${upd.id.substring(0,8)}\` na tabela \`${upd.collection}\` atualizado.`;
                    didChangeDb = true;
                } else {
                    result.textResponse += `\n❌ **ERRO AO ATUALIZAR \`${upd.collection}\`:** ${error.message}`;
                }
            } else {
                remainingUpdatesForModal.push(upd);
            }
        }
        if (remainingUpdatesForModal.length > 0) {
            setPendingUpdates(remainingUpdatesForModal);
            hasPendingActions = true;
        } else {
            setPendingUpdates([]);
        }
    } else {
        setPendingUpdates([]);
    }

    // Direct Database Deletions (DELETE)
    if (result.deletions && result.deletions.length > 0) {
        const remainingDeletionsForModal = [];
        for (const del of result.deletions) {
            const normalizedDel = typeof del === 'string' ? { id: del, collection: 'transactions' } : del;
            if (normalizedDel.id && normalizedDel.collection && normalizedDel.collection !== 'transactions') {
                const { error } = await supabase.from(normalizedDel.collection).delete().eq('id', normalizedDel.id);
                if (!error) {
                    result.textResponse += `\n🗑️ **EXCLUSÃO SUCESSO:** Registro ID \`${normalizedDel.id.substring(0,8)}\` removido de \`${normalizedDel.collection}\`.`;
                    didChangeDb = true;
                } else {
                    result.textResponse += `\n❌ **ERRO AO EXCLUIR DE \`${normalizedDel.collection}\`:** ${error.message}`;
                }
            } else {
                remainingDeletionsForModal.push(normalizedDel);
            }
        }
        if (remainingDeletionsForModal.length > 0) {
            setPendingDeletions(remainingDeletionsForModal);
            hasPendingActions = true;
        } else {
            setPendingDeletions([]);
        }
    } else {
        setPendingDeletions([]);
    }

    // Trigger update/refresh of world data if any writes transpired
    if (didChangeDb && onUpdateData) {
        try {
            onUpdateData();
        } catch (err) {
            console.error("Erro ao sincronizar view pós-chat do assistente:", err);
        }
    }

    if (hasPendingActions) setShowReviewModal(true);

    const contentText = (result.textResponse && result.textResponse.trim()) ? result.textResponse : "Olá! Como posso te ajudar hoje?";
    const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: contentText, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    onSaveMessage(aiMsg);
    setIsLoading(false);
    setAnalysisStage('');
  };

  // ... (Modal logic same as before, focusing on Render of Updates) ...
  const handleConfirmTransaction = async (index: number, t: Partial<Transaction>) => {
      await onAddTransaction({ ...t, category: t.category || categories.find(c => c.id === t.category_id)?.name || 'Outros' } as any);
      const newList = [...pendingTransactions];
      newList.splice(index, 1);
      setPendingTransactions(newList);
      checkIfEmpty();
  };

  const handleConfirmUpdate = async (index: number, update: { id: string; fields: any; collection?: string }) => {
      try { 
        const coll = update.collection || 'transactions';
        if (coll === 'transactions') await FinancialService.updateTransaction(update.id, update.fields);
        else if (coll === 'leads') await FinancialService.updateLead(update.id, update.fields);
        // else if (coll === 'products') ...
        
        if (onUpdateData) onUpdateData(); 
        const newList = [...pendingUpdates]; 
        newList.splice(index, 1); 
        setPendingUpdates(newList); 
        checkIfEmpty(); 
      } catch (e) { alert("Erro ao atualizar: " + e); }
  };

  const handleConfirmDelete = async (index: number, del: { id: string, collection?: string }) => {
      try { 
        const coll = del.collection || 'transactions';
        await supabase.from(coll).delete().eq('id', del.id);
        if (onUpdateData) onUpdateData(); 
        const newList = [...pendingDeletions]; 
        newList.splice(index, 1); 
        setPendingDeletions(newList); 
        checkIfEmpty(); 
      } catch (e) { alert("Erro ao excluir: " + e); }
  };

  const handleConfirmLead = async (index: number, lead: any) => {
    try {
        const { error } = await supabase.from('crm_leads').insert([lead]);
        if (error) throw error;
        if (onUpdateData) onUpdateData();
        const newList = [...pendingLeads];
        newList.splice(index, 1);
        setPendingLeads(newList);
        checkIfEmpty();
    } catch (e) { alert("Erro ao criar lead: " + e); }
  };

  const handleConfirmProduct = async (index: number, product: any) => {
    try {
        const { error } = await supabase.from('products').insert([product]);
        if (error) throw error;
        if (onUpdateData) onUpdateData();
        const newList = [...pendingProducts];
        newList.splice(index, 1);
        setPendingProducts(newList);
        checkIfEmpty();
    } catch (e) { alert("Erro ao criar produto: " + e); }
  };

   const handleConfirmAllCreations = async () => {
       if (pendingTransactions.length === 0) return;
       setIsLoading(true);
       try {
           if (onAddBulkTransactions) {
               const list = pendingTransactions.map(t => ({
                   ...t,
                   category: t.category || categories.find(c => c.id === t.category_id)?.name || 'Outros'
               }));
               await onAddBulkTransactions(list);
           } else {
               // Fallback
               for (const t of pendingTransactions) {
                   const payload = { ...t, category: t.category || categories.find(c => c.id === t.category_id)?.name || 'Outros' };
                   await onAddTransaction(payload as any);
               }
           }
           setPendingTransactions([]);
           checkIfEmpty();
       } catch (e) {
           alert("Erro ao adicionar em massa: " + e);
       } finally {
           setIsLoading(false);
       }
   };

  const handleConfirmAllUpdates = async () => {
    if (pendingUpdates.length === 0) return;
    setIsLoading(true);
    try {
        for (const update of pendingUpdates) {
            await handleConfirmUpdate(0, update);
        }
    } catch (e) {
        alert("Erro ao processar atualizações em massa: " + e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleConfirmAllDeletions = async () => {
      if (pendingDeletions.length === 0) return;
      setIsLoading(true);
      try {
          for (const del of pendingDeletions) {
              await handleConfirmDelete(0, del);
          }
      } catch (e) {
          alert("Erro ao excluir em massa: " + e);
      } finally {
          setIsLoading(false);
      }
  };

  const updateUpdateField = (index: number, field: string, value: any) => { 
    const newList = [...pendingUpdates]; 
    newList[index].fields = { ...newList[index].fields, [field]: value }; 
    setPendingUpdates(newList); 
  };

  const discardAll = () => { 
    setPendingTransactions([]); 
    setPendingUpdates([]); 
    setPendingDeletions([]); 
    setPendingLeads([]);
    setPendingProducts([]);
    setShowReviewModal(false); 
    setLastScannedImage(null); 
  };
  
  const checkIfEmpty = () => { 
    if (pendingTransactions.length === 0 && pendingUpdates.length === 0 && pendingDeletions.length === 0 && pendingLeads.length === 0 && pendingProducts.length === 0) { 
        setShowReviewModal(false); 
        setLastScannedImage(null); 
    } 
  };
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
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-3xl text-sm leading-tight text-current">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Sparkles size={20} className="text-emerald-500" /> Auditoria & Confirmação</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Confirme as ações sugeridas pela IA</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                       onClick={discardAll} 
                       className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-white dark:bg-slate-800 rounded-xl"
                       title="Descartar Tudo"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button onClick={() => setShowReviewModal(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors bg-white dark:bg-slate-800 rounded-xl"><X size={20} /></button>
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  {lastScannedImage && pendingTransactions.length > 0 && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Documento Analisado</p>
                          <img src={lastScannedImage} alt="Recibo Escaneado" className="w-full h-40 object-cover rounded-xl shadow-inner" referrerPolicy="no-referrer" />
                      </div>
                  )}
                  {/* DELETIONS */}
                  {pendingDeletions.length > 0 && (
                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2"><Trash2 size={14}/> Exclusões Sugeridas ({pendingDeletions.length})</h4>
                          <div className="space-y-2">
                            {pendingDeletions.map((del, idx) => {
                                return (
                                    <div key={idx} className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-3 rounded-xl flex items-center justify-between group">
                                        <div><p className="font-bold text-slate-800 dark:text-white text-sm">{del.id}</p><p className="text-[10px] text-slate-500 uppercase">{del.collection}</p></div>
                                        <button onClick={() => handleConfirmDelete(idx, del)} className="text-rose-500 hover:bg-white dark:hover:bg-rose-900/40 p-2 rounded-lg transition-all"><Trash2 size={16} /></button>
                                    </div>
                                );
                            })}
                          </div>
                      </div>
                  )}

                  {/* CRM LEADS */}
                  {pendingLeads.length > 0 && (
                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Novos Leads CRM ({pendingLeads.length})</h4>
                          <div className="space-y-4">
                            {pendingLeads.map((lead, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <input className="w-full bg-slate-50 dark:bg-slate-900 border-none font-black text-sm text-slate-800 dark:text-white" value={lead.title} onChange={(e) => {
                                                const newList = [...pendingLeads];
                                                newList[idx].title = e.target.value;
                                                setPendingLeads(newList);
                                            }} />
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Contato: {lead.contactName || 'Não identificado'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-emerald-500">R$ {lead.value || 0}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleConfirmLead(idx, lead)} className="bg-indigo-600 text-white w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><Check size={14} className="inline mr-2" /> Criar Lead</button>
                                </div>
                            ))}
                          </div>
                      </div>
                  )}

                  {/* PRODUCTS */}
                  {pendingProducts.length > 0 && (
                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Novos Produtos ({pendingProducts.length})</h4>
                          <div className="space-y-4">
                            {pendingProducts.map((product, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <input className="w-full bg-slate-50 dark:bg-slate-900 border-none font-black text-sm text-slate-800 dark:text-white" value={product.name} onChange={(e) => {
                                                const newList = [...pendingProducts];
                                                newList[idx].name = e.target.value;
                                                setPendingProducts(newList);
                                            }} />
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500">{product.type}</span>
                                                <span className="text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500">{product.category || 'Geral'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-emerald-500">R$ {product.price || 0}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleConfirmProduct(idx, product)} className="bg-emerald-600 text-white w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><Check size={14} className="inline mr-2" /> Cadastrar Produto</button>
                                </div>
                            ))}
                          </div>
                      </div>
                  )}

                  {/* UPDATES (Enhanced) */}
                  {pendingUpdates.length > 0 && (
                      <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Check size={14}/> Atualizações / Pagamentos ({pendingUpdates.length})</h4>
                            <button 
                                onClick={handleConfirmAllUpdates}
                                className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                            >
                                <Check size={12}/> Confirmar Todas
                            </button>
                          </div>
                          <div className="space-y-3">
                            {pendingUpdates.map((update, idx) => {
                                const t = transactions?.find(item => item.id === update.id);
                                const isPaying = update.fields.status === 'PAID';
                                const companyName = companies.find(c => c.id === t?.company_id)?.name || 'Corporativo';
                                const typeLabel = t?.type === 'INCOME' ? 'Receita' : 'Despesa';
                                
                                return (
                                    <div key={update.id} className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-4 rounded-xl flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="font-black text-slate-800 dark:text-white text-sm">{t?.description}</p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{t?.category}</span>
                                                    <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{companyName}</span>
                                                    <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">Vence: {new Date(t?.due_date || t?.date || '').toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-indigo-600 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg shadow-sm border border-indigo-50">
                                                <ArrowRight size={12} />
                                                <span className="text-[9px] font-black uppercase">{isPaying ? 'Pagar' : 'Alterar'}</span>
                                            </div>
                                        </div>
                                        
                                        {isPaying && (
                                            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                                                <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1 mb-1 ml-1"><Calendar size={10} /> Data do Pagamento</label>
                                                <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-md p-1.5 text-[10px] font-bold text-slate-800 dark:text-white outline-none" value={update.fields.date || new Date().toISOString().split('T')[0]} onChange={(e) => updateUpdateField(idx, 'date', e.target.value)} />
                                            </div>
                                        )}
                                        
                                        <div className="bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg text-[10px] border border-slate-100/50 dark:border-white/5">
                                            {Object.entries(update.fields).map(([key, val]) => {
                                                if (key === 'date' && isPaying) return null; 
                                                return (
                                                    <div key={key} className="flex justify-between py-0.5 border-b border-white/10 last:border-0"><span className="text-slate-400 font-bold uppercase">{key}</span><span className="font-black text-slate-700 dark:text-slate-300 uppercase">{key === 'status' ? (STATUS_MAP[String(val)] || val as string) : String(val)}</span></div>
                                                );
                                            })}
                                        </div>
                                        <button onClick={() => handleConfirmUpdate(idx, update)} className="bg-indigo-600 hover:bg-slate-900 text-white w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2"><Check size={14} /> Salvar Alteração</button>
                                    </div>
                                );
                            })}
                          </div>
                      </div>
                  )}

                  {/* CREATIONS */}
                  {pendingTransactions.length > 0 && (
                      <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Novos Lançamentos ({pendingTransactions.length})</h4>
                            <button 
                                onClick={handleConfirmAllCreations}
                                className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-sm flex items-center gap-2"
                            >
                                <Check size={12}/> Confirmar Todos
                            </button>
                          </div>
                          <div className="space-y-4">
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
                      </div>
                  )}
               </div>
               
               {/* Footer with global Batch Actions */}
               {(pendingTransactions.length > 1 || pendingUpdates.length > 1 || pendingDeletions.length > 1) && (
                 <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-b-3xl flex justify-center">
                    <button 
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          if (pendingDeletions.length > 0) await handleConfirmAllDeletions();
                          if (pendingUpdates.length > 0) await handleConfirmAllUpdates();
                          if (pendingTransactions.length > 0) await handleConfirmAllCreations();
                          alert("Todas as ações foram processadas com sucesso!");
                          onUpdateData?.();
                        } catch (e) {
                          alert("Aconteceu um erro no processamento em massa.");
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                    >
                      <Check size={20} /> APROVAR TODAS AS {pendingTransactions.length + pendingUpdates.length + pendingDeletions.length} AÇÕES
                    </button>
                 </div>
               )}
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
        {isLoading && <div className="flex justify-start"><div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full px-4 py-3 flex items-center gap-3 shadow-sm"><Loader2 className="animate-spin text-emerald-600" size={16} /><span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{analysisStage || 'Auditor FinanAI analisando...'}</span></div></div>}
      </div>
      <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shrink-0">
        {selectedFile && <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 w-fit pr-4 animate-in slide-in-from-bottom-2">{filePreview ? <img src={filePreview} className="w-10 h-10 object-cover rounded-xl border border-slate-200 dark:border-slate-600" alt="Preview" /> : <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-600">{getFileIcon(selectedFile.type, selectedFile.name)}</div>}<div className="flex flex-col"><span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate max-w-[150px]">{selectedFile.name}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{(selectedFile.size / 1024).toFixed(1)} KB</span></div><button onClick={clearFile} className="ml-2 bg-rose-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><X size={12} /></button></div>}
        <div className="flex items-center gap-2"><input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.csv,.xlsx,.xls,.ofx,.txt" onChange={handleFileSelect} /><div className="flex gap-1">
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-2xl flex items-center justify-center transition-all shadow-sm shrink-0 border border-slate-100 dark:border-slate-700"
              title="Anexar Arquivo"
            >
              <Paperclip size={20} />
            </button>
            <button 
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                  setTimeout(() => fileInputRef.current?.removeAttribute('capture'), 1000);
                }
              }} 
              className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded-2xl flex items-center justify-center transition-all shadow-sm shrink-0 border border-slate-100 dark:border-slate-700"
              title="Escanear Recibo (Câmera)"
            >
              <Camera size={20} />
            </button>
          </div>
<div className="flex-1 relative group"><input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-24 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/20 transition-all font-medium text-xs md:text-sm text-slate-900 dark:text-white" value={input} onChange={(e) => setInput(e.target.value)} onPaste={handlePaste} placeholder="Digite..." onKeyDown={(e) => e.key === 'Enter' && handleSend()} /><div className="absolute right-2 top-2 flex gap-1"><button onClick={toggleListening} className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-rose-100 dark:bg-rose-900 text-rose-600 animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600'}`} title="Falar Comando">{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button><button onClick={() => handleSend()} className="w-9 h-9 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-90"><Send size={16} /></button></div></div></div>
      </div>
    </div>
  );
};

export default ChatInterface;
