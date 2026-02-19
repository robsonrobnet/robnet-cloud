
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'PAID' | 'PENDING' | 'OVERDUE';
export type CostType = 'FIXED' | 'VARIABLE';
export type TransactionScope = 'PERSONAL' | 'BUSINESS';
export type UserPlan = 'FREE' | 'START' | 'PRO' | 'ENTERPRISE';
export type UserRole = 'USER' | 'ADMIN' | 'MANAGER';
export type Language = 'pt' | 'en' | 'es';

export interface Company {
  id: string;
  name: string;
  plan: UserPlan;
  cnpj?: string;
  owner_id?: string;
  scheduled_deletion_date?: string;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string;
  username: string;
  password?: string;
  email?: string;
  role: UserRole;
  plan: UserPlan; 
  language?: Language;
  avatar_url?: string;
  created_at: string;
  whatsapp?: string;
  document_number?: string;
  access_key?: string;
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
  cost_type?: CostType;
  scope?: TransactionScope;
  date: string; 
  due_date?: string;
  is_recurring?: boolean;
  installment_current?: number;
  installment_total?: number;
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
  NFSE = 'NFSE',
  CHAT = 'CHAT',
  ADMIN = 'ADMIN',
  SETTINGS = 'SETTINGS'
}

export interface NfseClient {
  id: string;
  company_id: string;
  name: string;
  doc_type: 'CNPJ' | 'CPF';
  doc_number: string;
  im?: string;
  email?: string;
  address_street: string;
  address_number: string;
  address_complement?: string;
  address_neighborhood: string;
  address_city_code: string;
  address_city_name?: string;
  address_state: string;
  address_zip: string;
}

export interface NfseService {
  id: string;
  company_id: string;
  code: string;
  description: string;
  aliquot: number;
  iss_retained: boolean;
}

export interface NfseRps {
  id: string;
  company_id: string;
  client_id: string;
  service_id: string;
  rps_number: number;
  rps_series: string;
  issue_date: string;
  status: 'NORMAL' | 'CANCELADO';
  service_amount: number;
  iss_amount: number;
  total_amount: number;
  nfe_number?: number;
  nfe_verification_code?: string;
  transmission_status: 'DRAFT' | 'TRANSMITTING' | 'AUTHORIZED' | 'REJECTED';
}

export interface NfseConfig {
  id: string;
  company_id: string;
  im: string;
  certificate_pfx_base64?: string;
  certificate_password?: string;
  rps_series: string;
  last_rps_number: number;
}
