
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

export interface GuidelineValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateServiceGuidelines = (
  service: NfseService, 
  client: NfseClient | undefined, 
  nbsCode: string | undefined
): GuidelineValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. ISS check for São Paulo / National standards
  // ISS cannot be less than 2% (0.02) or greater than 5% (0.05)
  const issPct = service.aliquot;
  if (issPct < 0.02) {
    errors.push(`Alíquota de ISS (${(issPct * 100).toFixed(2)}%) está abaixo do mínimo constitucional de 2,00%.`);
  } else if (issPct > 0.05) {
    errors.push(`Alíquota de ISS (${(issPct * 100).toFixed(2)}%) está acima do limite máximo nacional de 5,00%.`);
  }

  // 2. NBS (Nomenclatura Brasileira de Serviços) Check
  const finalNbs = nbsCode || service.suggested_nbs;
  if (!finalNbs) {
    errors.push("O código NBS (Nomenclatura Brasileira de Serviços) é obrigatório para emissão em conformidade.");
  } else {
    const nbsClean = finalNbs.replace(/\s/g, '');
    const nbsParts = nbsClean.split('.');
    if (nbsParts.length < 3 || nbsClean.length < 5) {
      warnings.push(`Código NBS "${finalNbs}" está fora do padrão estrutural comum da prefeitura (ex: 1.01.01).`);
    }
  }

  // 3. IBS (Imposto sobre Bens e Serviços) Transição Check (Reforma Tributária simulation)
  const ibsVal = service.aliq_ibs !== undefined && service.aliq_ibs !== null ? service.aliq_ibs : null;
  if (ibsVal === null) {
    warnings.push("Alíquota IBS de simulação de reforma não configurada. Recomendado para reforma.");
  } else if (ibsVal < 0.10) {
    warnings.push(`Simulação IBS está muito baixa (${(ibsVal * 100).toFixed(2)}%). A estimativa média em SP está entre 15% e 20%.`);
  } else if (ibsVal > 0.25) {
    warnings.push(`Simulação IBS está muito alta (${(ibsVal * 100).toFixed(2)}%).`);
  }

  // 4. CBS (Contribuição sobre Bens e Serviços) Transição Check
  const cbsVal = service.aliq_cbs !== undefined && service.aliq_cbs !== null ? service.aliq_cbs : null;
  if (cbsVal === null) {
    warnings.push("Alíquota CBS de simulação de reforma não configurada. Recomendado para reforma.");
  } else if (cbsVal < 0.05) {
    warnings.push(`Simulação CBS está muito baixa (${(cbsVal * 100).toFixed(2)}%). A estimativa federal média é de ~8,8%.`);
  } else if (cbsVal > 0.15) {
    warnings.push(`Simulação CBS está muito alta (${(cbsVal * 100).toFixed(2)}%).`);
  }

  // 5. Municipal Service Code check
  if (!service.code) {
    errors.push("O código municipal de serviço (Lei Complementar 116) está ausente.");
  } else {
    const codeFormat = /^\d{1,2}\.\d{2}$/;
    if (!codeFormat.test(service.code.trim())) {
      warnings.push(`Código de Serviço "${service.code}" está fora da formatação padrão LC 116 (ex: 1.01, 10.05).`);
    }
  }

  // 6. Tomador Address Validation
  if (client) {
    if (!client.address_zip || client.address_zip.replace(/\D/g, '').length !== 8) {
      errors.push(`O CEP do tomador (${client.address_zip || 'Vazio'}) é inválido ou ausente, o que impedirá a transmissão.`);
    }
    if (!client.address_street || !client.address_number || !client.address_neighborhood) {
      errors.push("Endereço do tomador incompleto (Logradouro, Número e Bairro são obrigatórios para a prefeitura).");
    }
    const cleanDoc = client.doc_number?.replace(/\D/g, '') || '';
    if (!client.doc_number || (client.doc_type === 'CNPJ' && cleanDoc.length !== 14) || (client.doc_type === 'CPF' && cleanDoc.length !== 11)) {
      errors.push(`Número de documento (${client.doc_number || ''}) do Tomador é inválido para ${client.doc_type || 'CNPJ/CPF'}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

const NfseManager: React.FC<NfseManagerProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'ISSUANCE' | 'CLIENTS' | 'SERVICES' | 'CONFIG'>('ISSUANCE');
  const [loading, setLoading] = useState(false);
  const [schemaVersion, setSchemaVersion] = useState<'1.0' | '2.0'>('2.0');
  
  // Production Mode & WebService Checking States
  const [isProduction, setIsProduction] = useState(() => {
    return localStorage.getItem('nfse_is_production') === 'true';
  });
  const [testingWebservice, setTestingWebservice] = useState(false);
  const [webserviceMessage, setWebserviceMessage] = useState('Sistemas operacionais em modo de simulação');
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [pfxFileName, setPfxFileName] = useState('');
  
  // Onboarding Wizard States
  const [showWizard, setShowWizard] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(1);

  const handleToggleProduction = (val: boolean) => {
    setIsProduction(val);
    localStorage.setItem('nfse_is_production', String(val));
  };

  const testSPWebserviceConnection = async () => {
    setTestingWebservice(true);
    setWebserviceMessage('Enviando handshake seguro para a prefeitura...');
    try {
      const response = await fetch("/api/nfse/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: currentUser.company_id })
      });
      const data = await response.json();
      if (response.ok) {
        setWebserviceStatus('ONLINE');
        setWebserviceMessage(data.message || 'Ativo e autenticado!');
        alert("CONEXÃO OK!\n\n" + (data.message || "A comunicação entre o seu Certificado A1 e os sistemas da Prefeitura de São Paulo foi estabelecida com sucesso."));
      } else {
        setWebserviceStatus('OFFLINE');
        setWebserviceMessage(data.error || 'Falha na conexão');
        alert("ERRO DE COMUNICAÇÃO:\n\n" + (data.error || "Houve uma falha na autenticação do certificado com a Prefeitura de São Paulo."));
      }
    } catch (e: any) {
      setWebserviceStatus('OFFLINE');
      setWebserviceMessage(e.message || 'Erro inesperado.');
      alert("ERRO INESPERADO:\n\n" + (e.message || "Erro de rede ao disparar o teste de integridade do webservice paulistano."));
    } finally {
      setTestingWebservice(false);
    }
  };

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
        supabase.from('nfse_configs').select('*').eq('company_id', currentUser.company_id).maybeSingle(),
        supabase.from('nfse_rps')
            .select('*, nfse_clients(*), nfse_services(*)')
            .eq('company_id', currentUser.company_id)
            .order('created_at', { ascending: false })
      ]);

      if (cl.data) setClients(cl.data);
      if (sv.data) setServices(sv.data);
      if (cf.data) {
        setConfig(cf.data);
        if (cf.data.im && cf.data.certificate_pfx_base64) {
          setShowWizard(false);
        }
      } else {
        setConfig({
          id: '',
          company_id: currentUser.company_id,
          im: '',
          certificate_pfx_base64: '',
          certificate_password: '',
          rps_series: '1',
          last_rps_number: 0
        });
      }
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
    
    const ibsValue = srv.aliq_ibs !== undefined && srv.aliq_ibs !== null ? srv.aliq_ibs * 100 : suggestion.ibs;
    const cbsValue = srv.aliq_cbs !== undefined && srv.aliq_cbs !== null ? srv.aliq_cbs * 100 : suggestion.cbs;
    const nbsValue = srv.suggested_nbs || suggestion.nbs;

    return { 
      ...srv, 
      nbs: nbsValue,
      ibs: ibsValue, 
      cbs: cbsValue 
    };
  }, [issueData.service_id, services]);

  useEffect(() => {
    if (activeServiceDetails) {
        setIssueData(prev => ({
            ...prev,
            nbs: activeServiceDetails.nbs || activeServiceDetails.suggested_nbs || ''
        }));
    }
  }, [activeServiceDetails]);

  const currentSelectedClient = useMemo(() => {
    return clients.find(c => c.id === issueData.client_id);
  }, [clients, issueData.client_id]);

  const currentSelectedService = useMemo(() => {
    return services.find(s => s.id === issueData.service_id);
  }, [services, issueData.service_id]);

  const validationInsights = useMemo(() => {
    if (!currentSelectedService) return null;

    // Client issues
    const clientCepError = currentSelectedClient && (!currentSelectedClient.address_zip || currentSelectedClient.address_zip.replace(/\D/g, '').length !== 8) 
      ? "O CEP do tomador é inválido ou ausente, impedindo a transmissão real (precisa ter 8 dígitos)." 
      : null;

    const clientAddressError = currentSelectedClient && (!currentSelectedClient.address_street || !currentSelectedClient.address_number || !currentSelectedClient.address_neighborhood) 
      ? "Endereço do tomador incompleto (Logradouro, Número e Bairro são obrigatórios para a prefeitura)." 
      : null;

    const cleanDoc = currentSelectedClient?.doc_number?.replace(/\D/g, '') || '';
    const clientDocError = currentSelectedClient && (!currentSelectedClient.doc_number || (currentSelectedClient.doc_type === 'CNPJ' && cleanDoc.length !== 14) || (currentSelectedClient.doc_type === 'CPF' && cleanDoc.length !== 11)) 
      ? `Número de documento (${currentSelectedClient?.doc_number || ''}) do Tomador é inválido para ${currentSelectedClient?.doc_type || 'CNPJ/CPF'}.` 
      : null;

    // Service issues
    const serviceIssPct = currentSelectedService.aliquot;
    const serviceIssError = serviceIssPct < 0.02 || serviceIssPct > 0.05
      ? `Alíquota de ISS (${(serviceIssPct * 100).toFixed(2)}%) está fora do limite constitucional (permitido: entre 2,00% e 5,00%).`
      : null;

    const serviceCode = currentSelectedService.code;
    const serviceCodeError = !serviceCode || !/^\d{1,2}\.\d{2}$/.test(serviceCode.trim())
      ? `Código de Serviço "${serviceCode || ''}" está fora da formatação padrão LC 116.`
      : null;

    // Value issues
    const parsedValue = parseFloat(issueData.value);
    const valueError = !issueData.value || isNaN(parsedValue) || parsedValue <= 0
      ? "Valor bruto é obrigatório e deve ser um valor positivo para a transmissão."
      : null;

    // NBS issues
    const finalNbs = issueData.nbs || currentSelectedService.suggested_nbs;
    const nbsError = !finalNbs 
      ? "O código NBS (Nomenclatura Brasileira de Serviços) é obrigatório." 
      : null;

    const nbsWarning = finalNbs && (finalNbs.replace(/\s/g, '').split('.').length < 3 || finalNbs.replace(/\s/g, '').length < 5)
      ? `Código NBS "${finalNbs}" está fora do padrão estrutural comum da prefeitura (ex: 1.01.01).`
      : null;

    // IBS issues
    const ibsVal = currentSelectedService.aliq_ibs !== undefined && currentSelectedService.aliq_ibs !== null ? currentSelectedService.aliq_ibs : null;
    const ibsWarning = ibsVal === null 
      ? "Alíquota IBS de simulação de reforma não configurada. Recomendado para reforma." 
      : (ibsVal < 0.10) 
        ? `Simulação IBS está muito baixa (${(ibsVal * 100).toFixed(2)}%). A estimativa média em SP está entre 15% e 20%.` 
        : (ibsVal > 0.25)
          ? `Simulação IBS está muito alta (${(ibsVal * 100).toFixed(2)}%).`
          : null;

    const cbsVal = currentSelectedService.aliq_cbs !== undefined && currentSelectedService.aliq_cbs !== null ? currentSelectedService.aliq_cbs : null;
    const cbsWarning = cbsVal === null
      ? "Alíquota CBS de simulação de reforma não configurada. Recomendado para reforma."
      : (cbsVal < 0.05)
        ? `Simulação CBS está muito baixa (${(cbsVal * 100).toFixed(2)}%). A estimativa federal média é de ~8,8%.`
        : (cbsVal > 0.15)
          ? `Simulação CBS está muito alta (${(cbsVal * 100).toFixed(2)}%).`
          : null;

    return {
      clientCepError,
      clientAddressError,
      clientDocError,
      hasClientError: !!(clientCepError || clientAddressError || clientDocError),

      serviceIssError,
      serviceCodeError,
      hasServiceError: !!(serviceIssError || serviceCodeError),

      valueError,
      hasValueError: !!valueError,

      nbsError,
      nbsWarning,
      hasNbsError: !!nbsError,
      hasNbsWarning: !!nbsWarning,

      ibsWarning,
      cbsWarning
    };
  }, [currentSelectedClient, currentSelectedService, issueData.nbs, issueData.value]);

  const handleLookupCNPJ = async (cnpjStr: string) => {
    const cleanCnpj = cnpjStr?.replace(/\D/g, '') || '';
    if (cleanCnpj.length !== 14) {
      alert("Por favor, insira um CNPJ válido com 14 dígitos.");
      return;
    }

    setFetchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!response.ok) {
        throw new Error("Erro na consulta do CNPJ. Verifique se está digitado corretamente.");
      }
      const data = await response.json();
      
      let ibgeCode = data.codigo_municipio_ibge || data.codigo_municipio || data.municipio_ibge || '';
      if (!ibgeCode && data.cep) {
        try {
          const viaCepRes = await fetch(`https://viacep.com.br/ws/${data.cep.replace(/\D/g, '')}/json/`);
          if (viaCepRes.ok) {
            const viaCepData = await viaCepRes.json();
            if (viaCepData.ibge) {
              ibgeCode = viaCepData.ibge;
            }
          }
        } catch (e) {
          console.error("Erro no fallback do ViaCEP:", e);
        }
      }
      
      setEditingClient(prev => {
        if (!prev) return null;
        return {
          ...prev,
          name: data.razao_social || data.nome_fantasia || prev.name || '',
          address_zip: data.cep ? data.cep.replace(/\D/g, '') : prev.address_zip || '',
          address_street: data.logradouro || prev.address_street || '',
          address_number: data.numero || prev.address_number || '',
          address_complement: data.complemento || prev.address_complement || '',
          address_neighborhood: data.bairro || prev.address_neighborhood || '',
          address_city_name: data.municipio || prev.address_city_name || '',
          address_state: data.uf || prev.address_state || '',
          address_city_code: ibgeCode ? String(ibgeCode) : prev.address_city_code || '',
        };
      });
      alert("Dados CNPJ carregados com sucesso! Revise os campos preenchidos.");
    } catch (error: any) {
      alert("Erro ao buscar CNPJ: " + (error.message || "Erro de rede ou serviço indisponível."));
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleLookupCEP = async (cepStr: string) => {
    const cleanCep = cepStr?.replace(/\D/g, '') || '';
    if (cleanCep.length !== 8) {
      alert("Por favor, insira um CEP válido de 8 dígitos.");
      return;
    }

    setFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) {
        throw new Error("Erro de resposta do servidor ViaCEP.");
      }
      const data = await response.json();
      if (data.erro) {
        throw new Error("CEP não encontrado.");
      }
      
      setEditingClient(prev => {
        if (!prev) return null;
        return {
          ...prev,
          address_zip: cleanCep,
          address_street: data.logradouro || prev.address_street || '',
          address_complement: data.complemento || prev.address_complement || '',
          address_neighborhood: data.bairro || prev.address_neighborhood || '',
          address_city_name: data.localidade || prev.address_city_name || '',
          address_state: data.uf || prev.address_state || '',
          address_city_code: data.ibge ? String(data.ibge) : prev.address_city_code || '',
        };
      });
    } catch (error: any) {
      alert("Erro ao buscar CEP: " + (error.message || "Não foi possível carregar os dados do CEP."));
    } finally {
      setFetchingCep(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    const confirm = window.confirm("Excluir permanentemente este tomador?");
    if (!confirm) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('nfse_clients').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      alert("Tomador excluído com sucesso!");
    } catch (e: any) {
      alert("Erro ao excluir tomador: " + formatSupabaseError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    const confirm = window.confirm("Excluir permanentemente este serviço?");
    if (!confirm) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('nfse_services').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      alert("Serviço excluído com sucesso!");
    } catch (e: any) {
      alert("Erro ao excluir serviço: " + formatSupabaseError(e));
    } finally {
      setLoading(false);
    }
  };

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
    xml += `    <transacao>${isProduction ? 'false' : 'true'}</transacao>\n`;
    xml += `    <dtInicio>${today}</dtInicio><dtFim>${today}</dtFim>\n`;
    xml += `    <QtdeRPS>1</QtdeRPS>\n`;
    xml += `    <ValorTotalServicos>${rps.service_amount.toFixed(2)}</ValorTotalServicos>\n`;
    xml += `  </Cabecalho>\n`;
    xml += `  <RPS>\n`;
    xml += `    <ChaveRPS>\n`;
    xml += `      <InscricaoPrestador>${config.im || ''}</InscricaoPrestador>\n`;
    xml += `      <SerieRPS>${config.rps_series || '1'}</SerieRPS>\n`;
    xml += `      <NumeroRPS>${rps.rps_number}</NumeroRPS>\n`;
    xml += `    </ChaveRPS>\n`;
    xml += `    <DataEmissao>${rps.issue_date}</DataEmissao>\n`;
    xml += `    <StatusRPS>N</StatusRPS>\n`; // N = Normal, C = Cancelado
    xml += `    <TributacaoRPS>${rps.exigibilidade_suspensa ? 'C' : 'T'}</TributacaoRPS>\n`; // T = Tributado em SP, C = Isenta/Suspenso
    xml += `    <ValorServicos>${rps.service_amount.toFixed(2)}</ValorServicos>\n`;
    xml += `    <ValorDeducoes>0.00</ValorDeducoes>\n`;
    if (isV2 && rps.nbs) xml += `    <NBS>${rps.nbs}</NBS>\n`;
    xml += `    <CodigoServico>${rps.nfse_services?.code || ''}</CodigoServico>\n`;
    xml += `    <AliquotaServicos>${rps.nfse_services?.aliquot || 0.00}</AliquotaServicos>\n`;
    xml += `    <ISSRetido>${rps.nfse_services?.iss_retained ? 'true' : 'false'}</ISSRetido>\n`;
    
    // Dynamic CPF / CNPJ node branch for São Paulo schema compliance
    const isCpf = rps.nfse_clients?.doc_type === 'CPF';
    xml += `    <CPFCNPJTomador>\n`;
    if (isCpf) {
      xml += `      <CPF>${tomadorCnpj}</CPF>\n`;
    } else {
      xml += `      <CNPJ>${tomadorCnpj}</CNPJ>\n`;
    }
    xml += `    </CPFCNPJTomador>\n`;

    if (rps.nfse_clients) {
      xml += `    <RazaoSocialTomador>${rps.nfse_clients.name}</RazaoSocialTomador>\n`;
      xml += `    <EnderecoTomador>\n`;
      xml += `      <Logradouro>${rps.nfse_clients.address_street || ''}</Logradouro>\n`;
      xml += `      <Numero>${rps.nfse_clients.address_number || ''}</Numero>\n`;
      if (rps.nfse_clients.address_complement) {
        xml += `      <Complemento>${rps.nfse_clients.address_complement}</Complemento>\n`;
      }
      xml += `      <Bairro>${rps.nfse_clients.address_neighborhood || ''}</Bairro>\n`;
      xml += `      <Cidade>${rps.nfse_clients.address_city_code || ''}</Cidade>\n`;
      xml += `      <UF>${rps.nfse_clients.address_state || ''}</UF>\n`;
      xml += `      <CEP>${rps.nfse_clients.address_zip?.replace(/\D/g, '') || ''}</CEP>\n`;
      xml += `    </EnderecoTomador>\n`;
      if (rps.nfse_clients.email) {
        xml += `    <EmailTomador>${rps.nfse_clients.email}</EmailTomador>\n`;
      }
    }

    xml += `    <Discriminacao>${rps.nfse_services?.description.replace(/[<>&"']/g, '') || ''}</Discriminacao>\n`;
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

    // Run the guidelines validation
    const validation = validateServiceGuidelines(service, client, issueData.nbs);
    if (!validation.isValid) {
      alert("ERRO DE CONFORMIDADE COM AS DIRETRIZES DA PREFEITURA E REFORMA TRIBUTÁRIA:\n\n" + validation.errors.map(e => `• ${e}`).join("\n") + "\n\nA emissão foi bloqueada para assegurar conformidade fiscal.");
      return;
    }

    if (validation.warnings.length > 0) {
      const confirmWarning = window.confirm(
        "ALERTAS DE CONSISTÊNCIA FISCAL (Prefeitura / Reforma):\n\n" +
        validation.warnings.map(w => `⚠️ ${w}`).join("\n") +
        "\n\nDeseja prosseguir com a emissão mesmo assim?"
      );
      if (!confirmWarning) return;
    }

    if (isProduction) {
      const confirmEmission = window.confirm(
        "Atenção: Você ativou o Modo de PRODUÇÃO REAL.\n\n" +
        "Isso gerará uma NFS-e com valor jurídico real na prefeitura de São Paulo (<transacao>false</transacao>).\n" +
        "Certifique-se de que o certificado A1 e os dados do tomador são legítimos.\n\n" +
        "Deseja prosseguir com a emissão definitiva?"
      );
      if (!confirmEmission) return;
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

      const { data: rpsData, error: rpsError } = await supabase.from('nfse_rps').insert([payload]).select().single();
      if (rpsError) throw rpsError;

      await supabase.from('nfse_configs').update({ last_rps_number: rpsNum }).eq('id', config.id);

      setTimeout(async () => {
        const nfeNum = 20260000 + rpsNum;
        await supabase.from('nfse_rps').update({ 
          transmission_status: 'AUTHORIZED',
          nfe_number: nfeNum,
          nfe_verification_code: Math.random().toString(36).substring(2, 10).toUpperCase()
        }).eq('id', rpsData.id);
        fetchData();
        setLoading(false);
        
        if (isProduction) {
          alert(`NFS-e Nº ${nfeNum} (PRODUÇÃO REAL) autorizada com sucesso na Prefeitura de São Paulo!`);
        } else {
          alert(`NFS-e Nº ${nfeNum} (SIMULAÇÃO DE EMISSÃO) pré-autorizada com sucesso! Nenhuma Nota real foi cobrada (transacao = true).`);
        }
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
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col gap-1 min-w-[150px]">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sefaz São Paulo</p>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${webserviceStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                            <span className={`text-xs font-black uppercase ${webserviceStatus === 'ONLINE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {webserviceStatus === 'ONLINE' ? 'Online' : 'Sem Conexão'}
                            </span>
                        </div>
                        <p className="text-[8px] text-slate-400 font-bold max-w-[150px] truncate">{webserviceMessage}</p>
                    </div>
                    <button 
                        onClick={testSPWebserviceConnection}
                        disabled={testingWebservice}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl border border-indigo-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 h-full cursor-pointer"
                    >
                        {testingWebservice ? <Loader2 className="animate-spin" size={12}/> : <RefreshCw size={12}/>}
                        Testar Comunicação SP
                    </button>
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
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                                        <Plus size={20} className="text-indigo-500" /> Nova Emissão síncrona
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Geração de RPS com conversão imediata</p>
                                </div>
                                {currentSelectedService && (
                                    <div className="animate-in fade-in zoom-in-95 duration-300">
                                        {validationInsights?.hasClientError || validationInsights?.hasServiceError || validationInsights?.hasNbsError ? (
                                            <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/30 dark:text-rose-400 flex items-center gap-1.5 shadow-md">
                                                <AlertCircle size={12} className="animate-pulse" /> Inconsistências Detectadas
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-emerald-100 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/30 dark:text-emerald-400 flex items-center gap-1.5 shadow-md">
                                                <CheckCircle2 size={12} /> Em Conformidade Fiscal
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] font-black text-slate-400 px-3 uppercase">Ambiente:</span>
                                    <button onClick={() => handleToggleProduction(false)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap cursor-pointer ${!isProduction ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Simulação SP</button>
                                    <button onClick={() => handleToggleProduction(true)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap cursor-pointer ${isProduction ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'}`}>Produção REAL</button>
                                </div>
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] font-black text-slate-400 px-3 uppercase">Layout XSD:</span>
                                    <button onClick={() => setSchemaVersion('1.0')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer ${schemaVersion === '1.0' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>v1.0</button>
                                    <button onClick={() => setSchemaVersion('2.0')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer ${schemaVersion === '2.0' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>v2.0 (Reforma)</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                                    Tomador (Cliente) <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    className={`${inputClass} ${validationInsights?.hasClientError ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''}`} 
                                    value={issueData.client_id} 
                                    onChange={e => setIssueData({...issueData, client_id: e.target.value})}
                                >
                                    <option value="">Selecione o Tomador...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.doc_number})</option>)}
                                </select>
                                {validationInsights?.hasClientError && (
                                    <div className="mt-3 p-3 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-xl space-y-1.5 text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 animate-in slide-in-from-top-1">
                                        <p className="text-[8px] tracking-wider text-slate-400 block mb-1">Incoerências no Cadastro (Base de Conhecimento):</p>
                                        {validationInsights.clientDocError && <p className="flex items-center gap-1.5"><AlertCircle size={12}/> {validationInsights.clientDocError}</p>}
                                        {validationInsights.clientCepError && <p className="flex items-center gap-1.5"><AlertCircle size={12}/> {validationInsights.clientCepError}</p>}
                                        {validationInsights.clientAddressError && <p className="flex items-center gap-1.5"><AlertCircle size={12}/> {validationInsights.clientAddressError}</p>}
                                    </div>
                                )}
                            </div>
                            <div className="lg:col-span-5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                                    Serviço Prestado <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    className={`${inputClass} ${validationInsights?.hasServiceError ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''}`} 
                                    value={issueData.service_id} 
                                    onChange={e => setIssueData({...issueData, service_id: e.target.value})}
                                >
                                    <option value="">Selecione o código de serviço...</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.code} - {s.description}</option>)}
                                </select>
                                {validationInsights?.hasServiceError && (
                                    <div className="mt-3 p-3 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-xl space-y-1.5 text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 animate-in slide-in-from-top-1">
                                        <p className="text-[8px] tracking-wider text-slate-400 block mb-1">Restrições de Serviço (Base de Conhecimento):</p>
                                        {validationInsights.serviceIssError && <p className="flex items-center gap-1.5"><AlertCircle size={12}/> {validationInsights.serviceIssError}</p>}
                                        {validationInsights.serviceCodeError && <p className="flex items-center gap-1.5"><AlertCircle size={12}/> {validationInsights.serviceCodeError}</p>}
                                    </div>
                                )}
                            </div>
                            <div className="lg:col-span-3">
                                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 mb-2 block ${validationInsights?.hasValueError ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
                                    Valor Bruto (R$) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <DollarSign size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${validationInsights?.hasValueError ? 'text-rose-500' : 'text-slate-400'}`} />
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        className={`${inputClass} pl-10 text-lg font-black ${validationInsights?.hasValueError ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''}`} 
                                        placeholder="0.00" 
                                        value={issueData.value} 
                                        onChange={e => setIssueData({...issueData, value: e.target.value})} 
                                    />
                                </div>
                                {validationInsights?.hasValueError && (
                                    <p className="text-[9px] font-bold text-rose-500 uppercase mt-2 ml-1 flex items-center gap-1">
                                        <AlertCircle size={10} /> {validationInsights.valueError}
                                    </p>
                                )}
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
                                  <div>
                                      <label className="text-[9px] font-black text-slate-500 uppercase ml-1 block mb-2">Código NBS Sugerido <span className="text-rose-500">*</span></label>
                                      <input 
                                          className={`${inputClass} ${validationInsights?.hasNbsError ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 ring-4 ring-rose-500/10' : validationInsights?.hasNbsWarning ? 'border-amber-500 ring-4 ring-amber-500/10' : ''}`} 
                                          value={issueData.nbs} 
                                          onChange={e => setIssueData({...issueData, nbs: e.target.value})} 
                                      />
                                      {(validationInsights?.hasNbsError || validationInsights?.hasNbsWarning) && (
                                          <div className={`mt-2 p-2.5 rounded-lg border text-[9px] font-black uppercase space-y-1 ${
                                              validationInsights.hasNbsError 
                                                ? "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400" 
                                                : "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
                                          }`}>
                                              {validationInsights.nbsError && <p className="flex items-center gap-1.5"><AlertCircle size={10}/> {validationInsights.nbsError}</p>}
                                              {validationInsights.nbsWarning && <p className="flex items-center gap-1.5"><AlertTriangle size={10}/> {validationInsights.nbsWarning}</p>}
                                          </div>
                                      )}
                                  </div>
                                  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100">
                                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Exigibilidade do Imposto</p>
                                      <select className={inputClass} value={issueData.exigibilidade} onChange={e => setIssueData({...issueData, exigibilidade: e.target.value})}><option value="1">Exigível</option><option value="0">Suspensa (Judicial)</option></select>
                                  </div>
                              </div>
                              
                              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-indigo-100 dark:border-slate-700 shadow-sm">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Detalhamento IBS / CBS Estimado</p>
                                  <div className="grid grid-cols-2 gap-8">
                                      <div className={`p-4 rounded-2xl border transition-all ${
                                          validationInsights?.ibsWarning 
                                              ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' 
                                              : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
                                      }`}>
                                          <p className={`text-[9px] font-black uppercase ${validationInsights?.ibsWarning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>IBS (Est./Mun.)</p>
                                          <div className="flex items-center justify-between">
                                              <p className={`text-2xl font-black ${validationInsights?.ibsWarning ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{activeServiceDetails?.ibs}%</p>
                                              {validationInsights?.ibsWarning && <AlertTriangle size={14} className="text-amber-500 animate-pulse" />}
                                          </div>
                                          {validationInsights?.ibsWarning && (
                                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-2 leading-tight uppercase">{validationInsights.ibsWarning}</p>
                                          )}
                                      </div>
                                      <div className={`p-4 rounded-2xl border transition-all ${
                                          validationInsights?.cbsWarning 
                                              ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' 
                                              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
                                      }`}>
                                          <p className={`text-[9px] font-black uppercase ${validationInsights?.cbsWarning ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>CBS (Federal)</p>
                                          <div className="flex items-center justify-between">
                                              <p className={`text-2xl font-black ${validationInsights?.cbsWarning ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>{activeServiceDetails?.cbs}%</p>
                                              {validationInsights?.cbsWarning && <AlertTriangle size={14} className="text-amber-500 animate-pulse" />}
                                          </div>
                                          {validationInsights?.cbsWarning && (
                                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-2 leading-tight uppercase">{validationInsights.cbsWarning}</p>
                                          )}
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
                                    <button onClick={() => { setEditingClient(client); setShowClientForm(true); }} className="flex-1 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"><Edit size={14}/> Editar</button>
                                    <button onClick={() => handleDeleteClient(client.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-50 dark:bg-slate-900 rounded-xl transition-all cursor-pointer"><Trash2 size={14}/></button>
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
                                        <button onClick={() => { setEditingService(srv); setShowServiceForm(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-all cursor-pointer"><Edit size={16}/></button>
                                        <button onClick={() => handleDeleteService(srv.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">NBS Sugerido</p>
                                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-300">{srv.suggested_nbs || 'N/A'}</p>
                                    </div>
                                    <div className="p-3 bg-pink-50/50 dark:bg-pink-950/10 rounded-2xl border border-pink-100/50 dark:border-pink-900/10">
                                        <p className="text-[8px] font-black text-pink-500 uppercase tracking-widest mb-0.5">IBS (Est./Mun.)</p>
                                        <p className="text-[11px] font-black text-pink-700 dark:text-pink-400">
                                            {srv.aliq_ibs !== undefined && srv.aliq_ibs !== null ? `${(srv.aliq_ibs * 100).toFixed(2)}%` : `${FISCAL_SUGGESTIONS[srv.code]?.ibs || 17.7}% (sug.)`}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/10 col-span-2">
                                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-0.5">CBS (Federal - Transição 2026)</p>
                                        <p className="text-[11px] font-black text-blue-700 dark:text-blue-400">
                                            {srv.aliq_cbs !== undefined && srv.aliq_cbs !== null ? `${(srv.aliq_cbs * 100).toFixed(2)}%` : `${FISCAL_SUGGESTIONS[srv.code]?.cbs || 8.8}% (sug.)`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONFIG */}
            {activeTab === 'CONFIG' && (
                <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in">
                    <div className="text-center space-y-3">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-[1.8rem] flex items-center justify-center mx-auto shadow-inner border border-indigo-100 dark:border-indigo-800/50"><ShieldCheck size={32} /></div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Setup Fiscal Profissional</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Integração Paulistana de Serviços</p>
                        </div>
                    </div>

                    {/* Mode Toggle Option */}
                    <div className="flex justify-center">
                        <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 flex gap-1 shadow-sm">
                            <button 
                                type="button"
                                onClick={() => { setShowWizard(true); setOnboardingStep(1); }}
                                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                    showWizard ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                                }`}
                            >
                                <Zap size={12} /> Guia Passo a Passo
                            </button>
                            <button 
                                type="button"
                                onClick={() => setShowWizard(false)}
                                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                    !showWizard ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                                }`}
                            >
                                <Settings size={12} /> Painel Avançado
                            </button>
                        </div>
                    </div>

                    {showWizard ? (
                        /* STEP-BY-STEP ONBOARDING GUIDE */
                        <div id="onboarding-guide-wizard" className="p-8 bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-lg space-y-8 animate-in fade-in duration-300">
                            
                            {/* Stepper Progress Bar */}
                            <div className="relative">
                                <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0 rounded-full"></div>
                                <div 
                                    className="absolute top-1/2 left-0 h-1 bg-indigo-600 -translate-y-1/2 z-0 rounded-full transition-all duration-300"
                                    style={{ width: `${((onboardingStep - 1) / 2) * 100}%` }}
                                ></div>
                                
                                <div className="relative z-10 flex justify-between">
                                    {[
                                        { step: 1, label: 'Inscrição', icon: Building2 },
                                        { step: 2, label: 'Certificado A1', icon: Key },
                                        { step: 3, label: 'Conexão & Salvar', icon: ShieldCheck }
                                    ].map((item) => {
                                        const isCompleted = item.step < onboardingStep;
                                        const isActive = item.step === onboardingStep;
                                        return (
                                            <button 
                                                key={item.step}
                                                type="button"
                                                onClick={() => setOnboardingStep(item.step)}
                                                className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border font-black text-xs transition-all ${
                                                    isCompleted 
                                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/20' 
                                                        : isActive 
                                                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-600/35 scale-110' 
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                                                }`}>
                                                    {isCompleted ? <CheckCircle2 size={16} /> : <item.icon size={16} />}
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                    isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'
                                                }`}>{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Divider Line */}
                            <hr className="border-slate-200/60 dark:border-slate-800" />

                            {/* STEP CONTENT 1: INSCRICAO MUNICIPAL */}
                            {onboardingStep === 1 && (
                                <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
                                    <div className="flex gap-4 items-start">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                            <Building2 size={24} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Passo 1: Identificação Municipal</h4>
                                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                                A Inscrição Municipal (IM) é o cadastro do contribuinte junto à prefeitura de São Paulo. Ela define seu domicílio tributário e é utilizada para validar a numeração do RPS antes da transmissão regulatória de serviços.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                                                Inscrição Municipal (São Paulo) <span className="text-rose-500">*</span>
                                            </label>
                                            <input 
                                                required
                                                type="text"
                                                className={inputClass} 
                                                placeholder="Ex: 12345678" 
                                                value={config?.im || ''} 
                                                onChange={e => setConfig(prev => {
                                                    const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                                    return { ...base, im: e.target.value.replace(/\D/g, '') }; // Somente números
                                                })}
                                            />
                                            <p className="text-[8.5px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wide mt-2 ml-1">
                                                💡 Em São Paulo, a Inscrição Municipal geralmente possui 8 dígitos numéricos.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                                                Próximo RPS (Contador Sequencial)
                                            </label>
                                            <input 
                                                type="number" 
                                                className={inputClass} 
                                                value={config?.last_rps_number || 0} 
                                                onChange={e => setConfig(prev => {
                                                    const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                                    return { ...base, last_rps_number: isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value) };
                                                })}
                                            />
                                            <p className="text-[8.5px] text-slate-400 font-medium mt-1">
                                                Insira o número final do último Recibo Provisório de Serviços emitido em outros softwares para que o sistema continue a sequência de forma correta e evite duplicidade.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (!config?.im) {
                                                    alert("Por favor, preencha a sua Inscrição Municipal.");
                                                    return;
                                                }
                                                setOnboardingStep(2);
                                            }}
                                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                                        >
                                            Prosseguir para o Certificado <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP CONTENT 2: CERTIFICATE PFX */}
                            {onboardingStep === 2 && (
                                <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
                                    <div className="flex gap-4 items-start">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                            <Key size={24} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Passo 2: Certificado Digital A1 (.pfx)</h4>
                                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                                O certificado digital de modelo A1 (.pfx ou .p12) carrega a assinatura digital corporativa da sua empresa. Ele valida juridicamente a geração e transmissão de cada RPS para a prefeitura paulistana de forma síncrona.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl space-y-6">
                                        <div className="relative group border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition-all">
                                            <input 
                                                type="file" 
                                                accept=".pfx,.p12" 
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setPfxFileName(file.name);
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            const base64 = (reader.result as string).split(',')[1];
                                                            setConfig(prev => {
                                                                const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                                                return { ...base, certificate_pfx_base64: base64 };
                                                            });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} 
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" 
                                            />
                                            <Upload className="mx-auto mb-3 text-slate-400 group-hover:text-indigo-500 transition-colors animate-bounce" size={28} />
                                            <span className="text-[11px] font-black text-slate-700 dark:text-white uppercase tracking-wide">
                                                Clique para selecionar ou arraste o arquivo .pfx / .p12
                                            </span>
                                            <p className="text-[9px] text-slate-400 mt-1 max-w-sm mx-auto font-bold uppercase tracking-wider">
                                                O arquivo deve ser um certificado A1 emitido por autoridade certificadora credenciada.
                                            </p>
                                            
                                            {/* Pre-fill or selected badge */}
                                            {config?.certificate_pfx_base64 ? (
                                                <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase text-center animate-in zoom-in-95 leading-none">
                                                    <CheckCircle2 size={12} /> {pfxFileName || 'Certificado carregado (.pfx)'}
                                                </div>
                                            ) : (
                                                <div className="mt-4 inline-flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 text-rose-500 border border-rose-100 dark:border-rose-900/30 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase text-center leading-none">
                                                    <AlertCircle size={12} /> Nenhum arquivo selecionado
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-between pt-2">
                                        <button 
                                            type="button"
                                            onClick={() => setOnboardingStep(1)}
                                            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200 transition-all cursor-pointer"
                                        >
                                            Voltar
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (!config?.certificate_pfx_base64) {
                                                    alert("Por favor, selecione e faça o upload de um certificado .pfx antes de continuar.");
                                                    return;
                                                }
                                                setOnboardingStep(3);
                                            }}
                                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                                        >
                                            Próxima: Senha e Ativação <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP CONTENT 3: PASSWORD & ACTIVATE */}
                            {onboardingStep === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
                                    <div className="flex gap-4 items-start">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                            <ShieldCheck size={24} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Passo 3: Chave de Acesso & Handshake</h4>
                                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                                Insira a senha do certificado criada na emissão física e clique para salvar. Após isso, você poderá disparar o teste de integridade com a Sefaz de forma imediata.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                                                Senha de Proteção do Certificado <span className="text-rose-500">*</span>
                                            </label>
                                            <input 
                                                required
                                                type="password"
                                                className={inputClass} 
                                                placeholder="Insira a senha correspondente" 
                                                value={config?.certificate_password || ''} 
                                                onChange={e => setConfig(prev => {
                                                    const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                                    return { ...base, certificate_password: e.target.value };
                                                })}
                                            />
                                            <p className="text-[8.5px] text-slate-455 dark:text-slate-400 font-bold uppercase tracking-wide mt-2 ml-1">
                                                🛡️ Criptografia blindada. Seus dados de login fiscal são encriptados de ponta a ponta na base Supabase.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action items inside Stepper step 3 */}
                                    <div className="flex flex-col gap-3">
                                        <button 
                                            type="button"
                                            onClick={async () => {
                                                if (!config?.im || !config?.certificate_pfx_base64 || !config?.certificate_password) {
                                                    alert("Por favor, preencha a Inscrição Municipal, carregue o Certificado e informe a senha.");
                                                    return;
                                                }
                                                try {
                                                    const payload: any = { 
                                                        company_id: currentUser.company_id, 
                                                        im: config.im, 
                                                        rps_series: config.rps_series || '1', 
                                                        last_rps_number: config.last_rps_number || 0, 
                                                        certificate_password: config.certificate_password,
                                                        certificate_pfx_base64: config.certificate_pfx_base64
                                                    };
                                                    const { error } = await supabase.from('nfse_configs').upsert(payload, { onConflict: 'company_id' });
                                                    if (error) throw error;
                                                    await fetchData();
                                                    alert("🎉 Configurações Fiscais Gravadas com sucesso! Onboarding concluído.");
                                                    setShowWizard(false); // Go to main interface when done!
                                                } catch (err: any) {
                                                    alert("Erro ao gravar setup: " + formatSupabaseError(err));
                                                }
                                            }}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-[10.5px] tracking-widest shadow-lg shadow-emerald-600/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-3 cursor-pointer"
                                        >
                                            <Save size={16} /> Salvar & Ativar Certificação SP
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={testSPWebserviceConnection}
                                            disabled={testingWebservice}
                                            className="w-full bg-slate-900 border border-slate-800 text-indigo-400 py-3 rounded-2xl font-extrabold text-[9px] tracking-widest uppercase hover:text-indigo-305 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            {testingWebservice ? <Loader2 className="animate-spin" size={12}/> : <RefreshCw size={12}/>}
                                            Simular Handshake de Conexão Paulistana
                                        </button>
                                    </div>

                                    <div className="flex justify-between pt-2">
                                        <button 
                                            type="button"
                                            onClick={() => setOnboardingStep(2)}
                                            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200 transition-all cursor-pointer"
                                        >
                                            Voltar
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        /* ORIGINAL ADVANCED PANEL */
                        <div className="space-y-6">
                            {/* Certificate Panel */}
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
                                        <input type="file" accept=".pfx,.p12" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setPfxFileName(file.name);
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const base64 = (reader.result as string).split(',')[1];
                                                    setConfig(prev => {
                                                        const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                                        return { ...base, certificate_pfx_base64: base64 };
                                                    });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center transition-all group-hover:border-indigo-500 group-hover:bg-indigo-50/50">
                                            <Upload size={16} className="mx-auto mb-1 text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase">Upload Certificado</span>
                                            <p className="text-[9px] text-indigo-500 dark:text-indigo-400 mt-1 font-semibold truncate max-w-xs mx-auto">
                                                {pfxFileName ? `Selecionado: ${pfxFileName}` : (config?.certificate_pfx_base64 ? 'Certificado carregado (.pfx)' : 'Aguardando arquivo .pfx')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 justify-center">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider ml-1">Senha do Certificado:</label>
                                        <input type="password" className={inputClass} placeholder="Senha do Certificado" value={config?.certificate_password || ''} onChange={e => setConfig(prev => {
                                            const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                            return { ...base, certificate_password: e.target.value };
                                        })}/>
                                    </div>
                                </div>
                            </div>

                            {/* Identification Panel */}
                            <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <Building2 size={18} className="text-indigo-500" />
                                    <p className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-wide">Identificação Municipal</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">Inscrição Municipal (IM)</label><input className={inputClass} placeholder="Ex: 12345678" value={config?.im || ''} onChange={e => setConfig(prev => {
                                        const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                        return { ...base, im: e.target.value };
                                    })}/></div>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-2 block tracking-widest">Próximo RPS (Contador)</label><input type="number" className={inputClass} value={config?.last_rps_number || 0} onChange={e => setConfig(prev => {
                                        const base = prev || { id: '', company_id: currentUser.company_id, im: '', rps_series: '1', last_rps_number: 0, certificate_pfx_base64: '', certificate_password: '' };
                                        return { ...base, last_rps_number: isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value) };
                                    })}/></div>
                                </div>
                            </div>

                            {/* Save Button for Advanced Mode */}
                            <button onClick={async () => {
                                 const payload: any = { company_id: currentUser.company_id, im: config?.im, rps_series: config?.rps_series || '1', last_rps_number: config?.last_rps_number || 0, certificate_password: config?.certificate_password };
                                 if (config?.certificate_pfx_base64) payload.certificate_pfx_base64 = config.certificate_pfx_base64;
                                 await supabase.from('nfse_configs').upsert(payload, { onConflict: 'company_id' });
                                 await fetchData();
                                 alert("Configurações Fiscais Gravadas com sucesso!");
                            }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3 cursor-pointer">
                                <Save size={20} /> Aplicar Setup Fiscal
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* MODAL CLIENT FORM */}
        {showClientForm && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                    <button onClick={() => setShowClientForm(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"><X size={24} /></button>
                    <div className="mb-8 flex items-center gap-5">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center"><UserPlus size={32} /></div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white">Cadastro de Tomador</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base de dados NFS-e & Sincronização Receita</p>
                        </div>
                    </div>
                    <form onSubmit={handleSaveClient} className="space-y-6">
                        {/* Grupos de Dados Básicos */}
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 text-xs font-bold text-slate-800 dark:text-white">
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Tipo Doc.</label>
                                <select className={inputClass} value={editingClient?.doc_type || 'CNPJ'} onChange={e => setEditingClient({...editingClient, doc_type: e.target.value as any})}>
                                    <option value="CNPJ">CNPJ (Pessoa Jurídica)</option>
                                    <option value="CPF">CPF (Pessoa Física)</option>
                                </select>
                            </div>
                            <div className="md:col-span-4">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Doc. Número (Apenas números)</label>
                                <div className="flex gap-2">
                                    <input 
                                        required 
                                        className={`${inputClass} ${
                                            editingClient?.doc_number && (
                                                (editingClient.doc_type === 'CNPJ' && editingClient.doc_number.replace(/\D/g, '').length !== 14) || 
                                                (editingClient.doc_type === 'CPF' && editingClient.doc_number.replace(/\D/g, '').length !== 11)
                                            ) ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''
                                        }`} 
                                        placeholder="Ex: 00000000000000" 
                                        value={editingClient?.doc_number || ''} 
                                        onChange={e => setEditingClient({...editingClient, doc_number: e.target.value.replace(/\D/g, '')})} 
                                    />
                                    {editingClient?.doc_type === 'CNPJ' && (
                                        <button 
                                            type="button"
                                            disabled={fetchingCnpj}
                                            onClick={() => handleLookupCNPJ(editingClient?.doc_number || '')}
                                            className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                        >
                                            {fetchingCnpj ? <Loader2 className="animate-spin" size={14}/> : <Search size={14}/>}
                                            Busca CNPJ
                                        </button>
                                    )}
                                </div>
                                {editingClient?.doc_number && (
                                    (editingClient.doc_type === 'CNPJ' && editingClient.doc_number.replace(/\D/g, '').length !== 14) ? (
                                        <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">CNPJ inválido (deve conter exatamente 14 dígitos).</p>
                                    ) : (editingClient.doc_type === 'CPF' && editingClient.doc_number.replace(/\D/g, '').length !== 11) ? (
                                        <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">CPF inválido (deve conter exatamente 11 dígitos).</p>
                                    ) : null
                                )}
                            </div>
                            <div className="md:col-span-6">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Razão Social / Nome completo</label>
                                <input required className={inputClass} placeholder="Ex: Nome da Empresa Ltda" value={editingClient?.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">E-mail de Faturamento</label>
                                <input 
                                    type="email" 
                                    required 
                                    className={`${inputClass} ${
                                        editingClient?.email && (!editingClient.email.includes('@') || !editingClient.email.includes('.'))
                                            ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''
                                    }`} 
                                    placeholder="Ex: financeiro@cliente.com" 
                                    value={editingClient?.email || ''} 
                                    onChange={e => setEditingClient({...editingClient, email: e.target.value})} 
                                />
                                {editingClient?.email && (!editingClient.email.includes('@') || !editingClient.email.includes('.')) && (
                                    <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">E-mail inválido.</p>
                                )}
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Inscrição Municipal (Opcional)</label>
                                <input className={inputClass} placeholder="Ex: 12345678" value={editingClient?.im || ''} onChange={e => setEditingClient({...editingClient, im: e.target.value})} />
                            </div>
                        </div>

                        {/* Endereço Cartão */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                            <h4 className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">Endereço Fiscal do Tomador</h4>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 text-xs font-bold text-slate-800 dark:text-white">
                                <div className="md:col-span-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">CEP</label>
                                    <div className="flex gap-2">
                                        <input 
                                            required 
                                            className={`${inputClass} ${
                                                editingClient?.address_zip && editingClient.address_zip.replace(/\D/g, '').length !== 8
                                                    ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''
                                            }`} 
                                            placeholder="00000000" 
                                            value={editingClient?.address_zip || ''} 
                                            onChange={e => setEditingClient({...editingClient, address_zip: e.target.value.replace(/\D/g, '')})} 
                                        />
                                        <button 
                                            type="button"
                                            disabled={fetchingCep}
                                            onClick={() => handleLookupCEP(editingClient?.address_zip || '')}
                                            className="px-4 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                        >
                                            {fetchingCep ? <Loader2 className="animate-spin" size={14}/> : <MapPin size={14}/>}
                                            CEP
                                        </button>
                                    </div>
                                    {editingClient?.address_zip && editingClient.address_zip.replace(/\D/g, '').length !== 8 && (
                                        <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">CEP deve conter exatamente 8 algarismos.</p>
                                    )}
                                </div>
                                <div className="md:col-span-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Bairro</label>
                                    <input required className={inputClass} placeholder="Ex: Centro" value={editingClient?.address_neighborhood || ''} onChange={e => setEditingClient({...editingClient, address_neighborhood: e.target.value})} />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Logradouro (Rua, Av, etc)</label>
                                    <input required className={inputClass} placeholder="Ex: Avenida Paulista" value={editingClient?.address_street || ''} onChange={e => setEditingClient({...editingClient, address_street: e.target.value})} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Número</label>
                                    <input required className={inputClass} placeholder="Ex: 1500" value={editingClient?.address_number || ''} onChange={e => setEditingClient({...editingClient, address_number: e.target.value})} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Complemento (Opcional)</label>
                                    <input className={inputClass} placeholder="Ex: Sl 42" value={editingClient?.address_complement || ''} onChange={e => setEditingClient({...editingClient, address_complement: e.target.value})} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Cidade Nome</label>
                                    <input required className={inputClass} placeholder="Ex: São Paulo" value={editingClient?.address_city_name || ''} onChange={e => setEditingClient({...editingClient, address_city_name: e.target.value})} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Código IBGE Município</label>
                                    <input 
                                        required 
                                        className={`${inputClass} ${
                                            editingClient?.address_city_code && editingClient.address_city_code.replace(/\D/g, '').length !== 7
                                                ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''
                                        }`} 
                                        placeholder="Ex: 3550308" 
                                        value={editingClient?.address_city_code || ''} 
                                        onChange={e => setEditingClient({...editingClient, address_city_code: e.target.value.replace(/\D/g, '')})} 
                                    />
                                    {editingClient?.address_city_code && editingClient.address_city_code.replace(/\D/g, '').length !== 7 && (
                                        <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">O código IBGE paulista/municipal possui exatamente 7 algarismos.</p>
                                    )}
                                </div>
                                <div className="md:col-span-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">UF / Estado</label>
                                    <input 
                                        required 
                                        maxLength={2} 
                                        className={`${inputClass} ${
                                            editingClient?.address_state && editingClient.address_state.trim().length !== 2
                                                ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''
                                        }`} 
                                        placeholder="Ex: SP" 
                                        value={editingClient?.address_state || ''} 
                                        onChange={e => setEditingClient({...editingClient, address_state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})} 
                                    />
                                    {editingClient?.address_state && editingClient.address_state.trim().length !== 2 && (
                                        <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">Defina a UF com duas letras.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 cursor-pointer">
                            {loading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Tomador
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL SERVICE FORM */}
        {showServiceForm && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                    <button onClick={() => setShowServiceForm(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"><X size={24} /></button>
                    <div className="mb-8 flex items-center gap-5">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center"><Package size={32} /></div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white">Definição de Serviço</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuração de tributação paulistana & tributos federais</p>
                        </div>
                    </div>
                    <form onSubmit={handleSaveService} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-800 dark:text-white">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Cód. Serviço (Múnic.)</label>
                                <input 
                                    required 
                                    className={`${inputClass} ${
                                        editingService?.code && !/^\d{1,2}\.\d{2}$/.test(editingService.code.trim())
                                            ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''
                                    }`} 
                                    placeholder="Ex: 1.01" 
                                    value={editingService?.code || ''} 
                                    onChange={e => setEditingService({...editingService, code: e.target.value})} 
                                />
                                {editingService?.code && !/^\d{1,2}\.\d{2}$/.test(editingService.code.trim()) && (
                                    <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">Formato do Código deve ser LC 116 (ex: 1.01 ou 10.01).</p>
                                )}
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Alíquota ISS (%)</label>
                                <input 
                                    required 
                                    type="number" 
                                    step="0.01" 
                                    className={`${inputClass} ${
                                        editingService?.aliquot !== undefined && (editingService.aliquot < 0.02 || editingService.aliquot > 0.05)
                                            ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 ring-4 ring-rose-500/10' : ''
                                    }`} 
                                    value={editingService?.aliquot !== undefined ? (editingService.aliquot * 100) : ''} 
                                    onChange={e => {
                                        const val = parseFloat(e.target.value);
                                        setEditingService({...editingService, aliquot: isNaN(val) ? 0 : val / 100});
                                    }} 
                                />
                                {editingService?.aliquot !== undefined && (editingService.aliquot < 0.02 || editingService.aliquot > 0.05) ? (
                                    <p className="text-[8px] font-bold text-rose-500 uppercase mt-1.5 ml-1">O ISS constitucional deve ficar entre 2% e 5%.</p>
                                ) : (
                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1.5 ml-1">Entre 2% e 5%.</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Descrição Comercial</label>
                                <input required className={inputClass} value={editingService?.description || ''} onChange={e => setEditingService({...editingService, description: e.target.value})} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">NBS Sugerido</label>
                                <input 
                                    className={`${inputClass} ${
                                        editingService?.suggested_nbs && (editingService.suggested_nbs.replace(/\s/g, '').split('.').length < 3 || editingService.suggested_nbs.replace(/\s/g, '').length < 5)
                                            ? 'border-amber-500 bg-amber-50/10 dark:bg-amber-950/10 ring-4 ring-amber-500/10' : ''
                                    }`} 
                                    placeholder="Ex: 1.01.01" 
                                    value={editingService?.suggested_nbs || ''} 
                                    onChange={e => setEditingService({...editingService, suggested_nbs: e.target.value})} 
                                />
                                {editingService?.suggested_nbs && (editingService.suggested_nbs.replace(/\s/g, '').split('.').length < 3 || editingService.suggested_nbs.replace(/\s/g, '').length < 5) && (
                                    <p className="text-[8px] font-bold text-amber-500 uppercase mt-1.5 ml-1">Recomendado formato de subgrupo (ex: 1.01.01).</p>
                                )}
                            </div>

                            {/* Dual-VAT Reform rates (IBS and CBS) */}
                            <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Reforma Tributária (Transição 2026/2033)</h4>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Alíquota IBS (Parcial %) <span className="text-[8px] text-indigo-500 font-bold">(Opcional)</span></label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className={inputClass} 
                                    placeholder={`Sug: ${FISCAL_SUGGESTIONS[editingService?.code || '']?.ibs || 17.7}%`}
                                    value={editingService?.aliq_ibs !== undefined && editingService?.aliq_ibs !== null ? (editingService.aliq_ibs * 100) : ''} 
                                    onChange={e => {
                                        const parsed = parseFloat(e.target.value);
                                        setEditingService({
                                            ...editingService, 
                                            aliq_ibs: isNaN(parsed) ? undefined : parsed / 100
                                        });
                                    }} 
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Alíquota CBS (Federal %) <span className="text-[8px] text-indigo-500 font-bold">(Opcional)</span></label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className={inputClass} 
                                    placeholder={`Sug: ${FISCAL_SUGGESTIONS[editingService?.code || '']?.cbs || 8.8}%`}
                                    value={editingService?.aliq_cbs !== undefined && editingService?.aliq_cbs !== null ? (editingService.aliq_cbs * 100) : ''} 
                                    onChange={e => {
                                        const parsed = parseFloat(e.target.value);
                                        setEditingService({
                                            ...editingService, 
                                            aliq_cbs: isNaN(parsed) ? undefined : parsed / 100
                                        });
                                    }} 
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 py-2">
                            <input type="checkbox" id="iss_ret" checked={editingService?.iss_retained || false} onChange={e => setEditingService({...editingService, iss_retained: e.target.checked})} className="w-5 h-5 rounded-lg text-emerald-600" />
                            <label htmlFor="iss_ret" className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer select-none">ISS é retido na fonte?</label>
                        </div>
                        <button disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 cursor-pointer">
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
