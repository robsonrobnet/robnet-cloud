
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'PAID' | 'PENDING' | 'OVERDUE';
export type CostType = 'FIXED' | 'VARIABLE';
export type TransactionScope = 'PERSONAL' | 'BUSINESS'; // New Type
export type UserPlan = 'FREE' | 'START' | 'PRO' | 'ENTERPRISE';
export type UserRole = 'USER' | 'ADMIN' | 'MANAGER';
export type Language = 'pt' | 'en' | 'es';

export interface Company {
  id: string;
  name: string;
  plan: UserPlan;
  cnpj?: string;
  owner_id?: string; // ID do usuário dono desta empresa
  scheduled_deletion_date?: string; // Data agendada para exclusão definitiva
  created_at: string;
}

export interface User {
  id: string;
  company_id: string; // Campo obrigatório para vínculo empresarial
  username: string;
  email?: string; // Novo campo para envio de credenciais
  role: UserRole;
  plan: UserPlan; 
  language?: Language;
  avatar_url?: string;
  createdAt: string;
  // Novos campos de cadastro
  whatsapp?: string;
  document_number?: string; // CPF ou CNPJ do usuário
  access_key?: string; // Chave única de acesso
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  company_id: string;
  category_id?: string;
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  category: string;
  costType?: CostType;
  cost_type?: CostType;
  scope?: TransactionScope;
  date: string; 
  due_date?: string;
  is_recurring?: boolean;
  installment_current?: number; // Nova: Parcela Atual (ex: 1)
  installment_total?: number;   // Nova: Total Parcelas (ex: 12)
  created_at?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  fixedExpenses: number;
  variableExpenses: number;
  pendingReceivables: number;
  overdueReceivables: number;
  // New Breakdown Fields
  businessIncome: number;
  businessExpenses: number;
  personalIncome: number;
  personalExpenses: number;
}

export interface ChatMessage {
  id: string;
  user_id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TRANSACTIONS = 'TRANSACTIONS',
  RECEIVABLES = 'RECEIVABLES',
  PAYABLES = 'PAYABLES',
  LOANS = 'LOANS', 
  NFSE = 'NFSE', // Novo Módulo NFS-e
  CHAT = 'CHAT',
  ADMIN = 'ADMIN',
  SETTINGS = 'SETTINGS'
}

// --- NFS-e SP Types ---

export interface NfseClient {
  id: string;
  company_id: string;
  name: string; // Razão Social
  doc_type: 'CNPJ' | 'CPF';
  doc_number: string;
  im?: string; // Inscrição Municipal (Opcional para fora de SP)
  email?: string;
  address_street: string; // Logradouro
  address_number: string;
  address_complement?: string;
  address_neighborhood: string; // Bairro
  address_city_code: string; // Código IBGE (7 dígitos)
  address_city_name?: string;
  address_state: string; // UF
  address_zip: string; // CEP
}

export interface NfseService {
  id: string;
  company_id: string;
  code: string; // Código do Serviço (Item 10 PDF)
  description: string; // Discriminação padrão
  aliquot: number; // Alíquota (ex: 0.05 para 5%)
  iss_retained: boolean; // ISS Retido pelo Tomador?
}

export interface NfseRps {
  id: string;
  company_id: string;
  client_id: string;
  service_id: string;
  rps_number: number;
  rps_series: string; // ex: "RPS", "A", "1"
  issue_date: string; // Data Emissão (AAAA-MM-DD)
  status: 'NORMAL' | 'CANCELADO';
  
  // Valores
  service_amount: number; // Valor Serviços
  deductions_amount: number; // Valor Deduções
  pis_amount: number;
  cofins_amount: number;
  inss_amount: number;
  ir_amount: number;
  csll_amount: number;
  iss_amount: number; // Valor ISS
  total_amount: number; // Valor Líquido

  // Controle
  batch_number?: number; // Número do Lote enviado
  protocol?: string; // Protocolo de Envio
  nfe_number?: number; // Número da Nota gerada
  nfe_verification_code?: string; // Código de Verificação
  transmission_status: 'DRAFT' | 'TRANSMITTING' | 'AUTHORIZED' | 'REJECTED';
  xml_return_message?: string;
}

export interface NfseConfig {
  id: string;
  company_id: string;
  im: string; // Inscrição Municipal do Prestador
  certificate_pfx_base64?: string; // Certificado A1 (Base64) - Armazenar com cuidado
  certificate_password?: string;
  rps_series: string; // Série Atual
  last_rps_number: number; // Último número utilizado
}

// Paleta de Cores para Dashboard e Categorias
export const COLOR_PALETTE = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  lime: '#84cc16',
  indigo: '#6366f1',
  teal: '#14b8a6',
  orange: '#f97316',
  purple: '#a855f7',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  slate: '#64748b',
  yellow: '#eab308',
  fuchsia: '#d946ef',
  green: '#22c55e'
};
