
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
  webhook_url?: string;
  scheduled_deletion_date?: string;
  created_at: string;
  enabled_modules?: string[]; // List of enabled AppView keys
}

export interface UserPermissions {
  DASHBOARD?: boolean;
  TRANSACTIONS?: boolean;
  RECEIVABLES?: boolean;
  PAYABLES?: boolean;
  LOANS?: boolean;
  NFSE?: boolean;
  CRM?: boolean;
  CHAT?: boolean;
  SETTINGS?: boolean;
  STRIPE?: boolean;
  SHOP?: boolean;
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
  is_master?: boolean;
  webhook_url?: string;
  permissions?: UserPermissions;
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
  recurrence_period?: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  recurrence_limit?: number;
  installment_current?: number;
  installment_total?: number;
  contact_email?: string;
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
  CRM = 'CRM',
  CHAT = 'CHAT',
  ADMIN = 'ADMIN',
  SETTINGS = 'SETTINGS',
  STRIPE = 'STRIPE',
  TUTORIAL = 'TUTORIAL',
  MASTER_CONFIG = 'MASTER_CONFIG',
  SHOP = 'SHOP'
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
  suggested_nbs?: string;
  aliq_ibs?: number;
  aliq_cbs?: number;
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
  // Campos Reforma 2026
  nbs?: string;
  valor_inicial_cobrado?: number;
  valor_final_cobrado?: number;
  exigibilidade_suspensa?: boolean;
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

// CRM TYPES
export type CRMLeadStatus = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
export type CRMLeadPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CRMContact {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  organization?: string;
  avatar_url?: string;
  last_interaction?: string;
  created_at: string;
  tags?: string[];
}

export interface CRMLead {
  id: string;
  company_id: string;
  title: string;
  contact_id?: string;
  contact?: CRMContact;
  value: number;
  status: CRMLeadStatus;
  priority: CRMLeadPriority;
  assigned_to?: string;
  expected_close_date?: string;
  description?: string;
  score?: number; // AI Lead Scoring (0-100)
  ai_insight?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export interface CRMActivity {
  id: string;
  company_id: string;
  lead_id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK' | 'WHATSAPP';
  content: string;
  user_id: string;
  user_name?: string;
  due_date?: string;
  completed?: boolean;
  created_at: string;
}

export interface CRMAutomation {
  id: string;
  company_id: string;
  name: string;
  trigger: 'NEW_LEAD' | 'STATUS_CHANGE' | 'VALUE_THRESHOLD';
  action: 'EMAIL' | 'TASK' | 'WEBHOOK' | 'WHATSAPP';
  config: any;
  active: boolean;
}

// SHOP TYPES
export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
export type StockType = 'INFINITE' | 'LIMITED';
export type CustomerType = 'RETAIL' | 'WHOLESALE';

export interface Product {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  images?: string[];
  video_url?: string;
  price: number;
  promotional_price?: number;
  cost?: number;
  show_price_in_store: boolean;
  type: ProductType;
  stock_type: StockType;
  stock_quantity?: number;
  sku?: string;
  barcode?: string;
  weight?: number; // in kg
  length?: number; // in cm
  width?: number; // in cm
  height?: number; // in cm
  mpn?: string;
  age_range?: string;
  gender?: string;
  categories?: string[];
  tags?: string[];
  brand?: string;
  seo_title?: string;
  seo_description?: string;
  is_featured?: boolean;
  featured_sections?: string[];
  fiscal_origin?: string;
  fiscal_type?: 'OWN_PRODUCTION' | 'RESALE';
  ncm?: string;
  cest?: string;
  has_free_shipping: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariation {
  id: string;
  product_id: string;
  name: string; // e.g. "Color: Red, Size: XL"
  price_override?: number;
  stock_quantity?: number;
  sku?: string;
}

export interface ShopCustomer {
  id: string;
  company_id: string;
  name: string;
  email: string;
  phone?: string;
  document_number?: string; // CPF or CNPJ
  type: CustomerType;
  price_table_id?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  document_number?: string;
  address?: string;
  created_at: string;
}

export interface PriceTable {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  discount_percentage?: number;
  markup_percentage?: number;
  created_at: string;
}

export interface SalesOrder {
  id: string;
  company_id: string;
  customer_id: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  payment_status?: 'PENDING' | 'PAID' | 'REFUNDED';
  total_amount: number;
  shipping_amount: number;
  discount_amount: number;
  payment_method?: string;
  shipping_method?: string;
  tracking_code?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variation_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}
