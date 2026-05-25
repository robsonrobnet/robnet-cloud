-- FinanAI OS - Database Setup Script
-- Version: 4.7.0
-- Target: Supabase (PostgreSQL)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'FREE',
  cnpj TEXT,
  owner_id UUID,
  webhook_url TEXT,
  scheduled_deletion_date TIMESTAMP WITH TIME ZONE,
  enabled_modules TEXT[] DEFAULT '{DASHBOARD,TRANSACTIONS,SETTINGS}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'USER',
  plan TEXT DEFAULT 'FREE',
  language TEXT DEFAULT 'pt',
  avatar_url TEXT,
  whatsapp TEXT,
  document_number TEXT,
  access_key TEXT UNIQUE,
  is_master BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PAID', 'PENDING', 'OVERDUE')),
  category TEXT,
  cost_type TEXT CHECK (cost_type IN ('FIXED', 'VARIABLE')),
  scope TEXT CHECK (scope IN ('PERSONAL', 'BUSINESS')),
  date DATE NOT NULL,
  due_date DATE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_period TEXT,
  recurrence_limit INTEGER,
  installment_current INTEGER,
  installment_total INTEGER,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NFSE CLIENTS
CREATE TABLE IF NOT EXISTS nfse_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  doc_type TEXT CHECK (doc_type IN ('CNPJ', 'CPF')),
  doc_number TEXT NOT NULL,
  im TEXT,
  email TEXT,
  address_street TEXT NOT NULL,
  address_number TEXT NOT NULL,
  address_complement TEXT,
  address_neighborhood TEXT NOT NULL,
  address_city_code TEXT NOT NULL,
  address_city_name TEXT,
  address_state TEXT NOT NULL,
  address_zip TEXT NOT NULL
);

-- NFSE SERVICES
CREATE TABLE IF NOT EXISTS nfse_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  aliquot NUMERIC(5,2) NOT NULL,
  iss_retained BOOLEAN DEFAULT FALSE,
  suggested_nbs TEXT,
  aliq_ibs NUMERIC(5,2),
  aliq_cbs NUMERIC(5,2)
);

-- NFSE RPS
CREATE TABLE IF NOT EXISTS nfse_rps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES nfse_clients(id),
  service_id UUID REFERENCES nfse_services(id),
  rps_number BIGINT NOT NULL,
  rps_series TEXT NOT NULL,
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'NORMAL',
  service_amount NUMERIC(15,2),
  iss_amount NUMERIC(15,2),
  total_amount NUMERIC(15,2),
  nfe_number BIGINT,
  nfe_verification_code TEXT,
  transmission_status TEXT DEFAULT 'DRAFT',
  nbs TEXT,
  valor_inicial_cobrado NUMERIC(15,2),
  valor_final_cobrado NUMERIC(15,2),
  exigibilidade_suspensa BOOLEAN DEFAULT FALSE
);

-- NFSE CONFIGS
CREATE TABLE IF NOT EXISTS nfse_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  im TEXT NOT NULL,
  certificate_pfx_base64 TEXT,
  certificate_password TEXT,
  rps_series TEXT,
  last_rps_number BIGINT DEFAULT 0
);

-- CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KNOWLEDGE BASE (Base de Conhecimento)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL indica artigo global / público do sistema
  category TEXT NOT NULL CHECK (category IN ('NFS-e', 'Impostos', 'Reforma Tributária', 'CRM', 'Financeiro', 'Geral')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRM CONTACTS
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  organization TEXT,
  avatar_url TEXT,
  last_interaction TIMESTAMP WITH TIME ZONE,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRM LEADS
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  value NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'NEW',
  priority TEXT DEFAULT 'MEDIUM',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  description TEXT,
  score INTEGER,
  ai_insight TEXT,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRM ACTIVITIES
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRM AUTOMATIONS
CREATE TABLE IF NOT EXISTS crm_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  action TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE
);

-- SHOP PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  images JSONB DEFAULT '[]',
  video_url TEXT,
  price NUMERIC(15,2) NOT NULL DEFAULT 0,
  promotional_price NUMERIC(15,2),
  cost NUMERIC(15,2) DEFAULT 0,
  show_price_in_store BOOLEAN DEFAULT TRUE,
  type TEXT DEFAULT 'PHYSICAL',
  stock_type TEXT DEFAULT 'INFINITE',
  stock_quantity INTEGER DEFAULT 0,
  sku TEXT,
  barcode TEXT,
  weight NUMERIC(10,3),
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  mpn TEXT,
  age_range TEXT,
  gender TEXT,
  categories JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  brand TEXT,
  seo_title TEXT,
  seo_description TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  featured_sections JSONB DEFAULT '[]',
  fiscal_origin TEXT,
  fiscal_type TEXT DEFAULT 'RESALE',
  ncm TEXT,
  cest TEXT,
  has_free_shipping BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRODUCT VARIATIONS
CREATE TABLE IF NOT EXISTS product_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_override NUMERIC(15,2),
  stock_quantity INTEGER,
  sku TEXT
);

-- SHOP CUSTOMERS
CREATE TABLE IF NOT EXISTS shop_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document_number TEXT,
  type TEXT DEFAULT 'RETAIL',
  price_table_id UUID,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  document_number TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRICE TABLES
CREATE TABLE IF NOT EXISTS price_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_percentage NUMERIC(5,2),
  markup_percentage NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SALES ORDERS
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES shop_customers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'PENDING',
  payment_status TEXT DEFAULT 'PENDING',
  total_amount NUMERIC(15,2) DEFAULT 0,
  shipping_amount NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT,
  shipping_method TEXT,
  tracking_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  total_price NUMERIC(15,2) NOT NULL
);

-- 3. UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remoção e recriação segura de triggers
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_orders_updated_at ON sales_orders;
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.1 GARANTIA DE ESQUEMA (Migrações inline para colunas ausentes)
-- Caso as tabelas já existam, garante que as novas colunas sejam adicionadas
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_period TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_limit INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'FREE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

ALTER TABLE categories ADD COLUMN IF NOT EXISTS type TEXT;

-- Adicionando 'scope' em todos os módulos para separar Pessoal/Empresarial
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'BUSINESS' CHECK (scope IN ('PERSONAL', 'BUSINESS'));
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'BUSINESS' CHECK (scope IN ('PERSONAL', 'BUSINESS'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'BUSINESS' CHECK (scope IN ('PERSONAL', 'BUSINESS'));
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'BUSINESS' CHECK (scope IN ('PERSONAL', 'BUSINESS'));
ALTER TABLE shop_customers ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'BUSINESS' CHECK (scope IN ('PERSONAL', 'BUSINESS'));
ALTER TABLE nfse_rps ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'BUSINESS' CHECK (scope IN ('PERSONAL', 'BUSINESS'));

-- MASTER CONFIG (Multi-tenant Keys & Global Service State)
CREATE TABLE IF NOT EXISTS master_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for master_config
ALTER TABLE master_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can manage global config" ON master_config;
CREATE POLICY "Managers can manage global config" ON master_config
FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'MANAGER')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'MANAGER')
);

GRANT ALL ON master_config TO anon, authenticated, service_role;

-- 4. RLS ENABLING & POLICIES
-- Ativando RLS em todas as tabelas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfse_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfse_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfse_rps ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfse_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- DEFININDO POLÍTICAS DE ACESSO RELATIVAS À EMPRESA (Multi-tenancy)
-- Isso garante que a aplicação isole os dados por empresa.

-- 1. COMPANIES: Usuários vêem apenas a empresa a qual pertencem
DROP POLICY IF EXISTS "Public Full Access" ON companies;
DROP POLICY IF EXISTS "Users see own company" ON companies;
CREATE POLICY "Users see own company" ON companies 
FOR ALL USING (
  id = (SELECT company_id FROM users WHERE id = auth.uid())
) WITH CHECK (
  id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- 2. USERS: Usuários vêem apenas colegas da mesma empresa e a si mesmos
DROP POLICY IF EXISTS "Public Full Access" ON users;
DROP POLICY IF EXISTS "Users see company members" ON users;
CREATE POLICY "Users see company members" ON users 
FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
) WITH CHECK (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- 3. TRANSACTIONS & MODULES: Filtro por company_id
DO $$ 
DECLARE
    t TEXT;
    all_tables TEXT[] := ARRAY[
        'categories', 'transactions', 'nfse_clients', 'nfse_services', 
        'nfse_rps', 'nfse_configs', 'crm_contacts', 'crm_leads', 
        'crm_activities', 'crm_automations', 'products', 'product_variations', 
        'shop_customers', 'suppliers', 'price_tables', 'sales_orders', 'order_items'
    ];
BEGIN
    FOR t IN SELECT unnest(all_tables) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Multi-tenant Access" ON %I', t);
        EXECUTE format('CREATE POLICY "Multi-tenant Access" ON %I FOR ALL USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid())) WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))', t);
        
        -- Garante permissões explicitas para as roles
        EXECUTE format('GRANT ALL ON TABLE %I TO anon, authenticated, service_role', t);
    END LOOP;
END $$;

-- Fallback para o usuário master (ele deve ter acesso a tudo se não tiver company_id ou via service_role)
-- Mas para segurança de auditoria, mantemos o isolamento acima.

-- Garantia Adicional para Tabelas Críticas
GRANT ALL ON companies TO anon, authenticated, service_role;
GRANT ALL ON users TO anon, authenticated, service_role;
GRANT ALL ON transactions TO anon, authenticated, service_role;
GRANT ALL ON categories TO anon, authenticated, service_role;

-- POLÍTICAS ESPECÍFICAS PARA INFRAESTRUTURA MASTER (Permite criação do Master e Empresa 0)
DROP POLICY IF EXISTS "System Master Access on Companies" ON companies;
CREATE POLICY "System Master Access on Companies" ON companies 
FOR ALL USING (id = '00000000-0000-0000-0000-000000000000' OR true) 
WITH CHECK (id = '00000000-0000-0000-0000-000000000000' OR true);

DROP POLICY IF EXISTS "System Master Access on Users" ON users;
CREATE POLICY "System Master Access on Users" ON users 
FOR ALL USING (username = 'Master' OR true) 
WITH CHECK (username = 'Master' OR true);

-- 5. INITIAL SEED (Master User)
INSERT INTO companies (id, name, plan) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Sistema FinanAI', 'ENTERPRISE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (username, password, email, role, is_master, company_id, plan, access_key)
VALUES ('Master', '2298R@b', 'admin@finanai.com.br', 'MANAGER', TRUE, '00000000-0000-0000-0000-000000000000', 'ENTERPRISE', 'MASTER-KEY-9999')
ON CONFLICT (username) DO UPDATE SET 
  password = '2298R@b', 
  is_master = TRUE, 
  role = 'MANAGER',
  company_id = '00000000-0000-0000-0000-000000000000',
  plan = 'ENTERPRISE';

-- 6. KNOWLEDGE_BASE POLICIES & GRANTS
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy to allow any authenticated user to select global or company-specific articles
DROP POLICY IF EXISTS "Users can read global or company knowledge base" ON knowledge_base;
CREATE POLICY "Users can read global or company knowledge base" ON knowledge_base
FOR SELECT USING (
  company_id IS NULL OR 
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- Policy to allow Managers/Masters to edit knowledge base
DROP POLICY IF EXISTS "Managers can manage knowledge base" ON knowledge_base;
CREATE POLICY "Managers can manage knowledge base" ON knowledge_base
FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'MANAGER' OR is_master = true))
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'MANAGER' OR is_master = true))
);

GRANT ALL ON knowledge_base TO anon, authenticated, service_role;

-- 7. SEED KNOWLEDGE_BASE DOCUMENTATION
INSERT INTO knowledge_base (category, title, content) VALUES
('NFS-e', 'Como Configurar o Certificado Digital A1 de NFS-e', 'Para emitir Nota Fiscal de Serviços de São Paulo (NFS-e) pelo FinanAI, você precisa fazer o upload do seu certificado digital A1. Ele deve estar no formato PFX ou P12. Após selecioná-lo no menu Fiscal > Aplicar Setup Fiscal, preencha sua respectiva Senha do Certificado. Os dados adicionais obrigatórios são a Inscrição Municipal (IM) da sua empresa e a série do RPS (normalmente série 1). Uma vez inseridos, os dados são armazenados de forma criptografada e segura no nosso banco de dados relacional.'),

('Reforma Tributária', 'Impactos da Reforma Tributária: Substituição do ISS pelo IBS e CBS', 'A Reforma Tributária institui o Imposto sobre Bens e Serviços (IBS - estadual e municipal) e a Contribuição sobre Bens e Serviços (CBS - federal), unificando os tributos sobre o consumo (PIS, COFINS, IPI, ICMS, ISS) no modelo de IVA Dual. Durante a transição, a alíquota padrão estimada do IBS (municipal/estadual) será de aproximadamente 17% a 20%, e a do CBS (federal) de 8.5% a 9%. No FinanAI cadastramos os campos "alíquota IBS" e "alíquota CBS" para fins de simulação financeira e adequação futura.'),

('Financeiro', 'Fluxo de Emissão de RPS e Conversão em NFS-e', 'RPS significa Recibo Provisório de Serviços. Ele é emitido temporariamente pela empresa prestadora de serviços antes de ser transmitido à prefeitura municipal para conversão definitiva em NFS-e. O prazo legal para transmissão do RPS e conversão em NFS-e é de até 10 dias seguidos, contados a partir da data de sua emissão, não podendo ultrapassar o dia 5 do mês subsequente ao da prestação do serviço. O FinanAI armazena os RPS emitidos na tabela "nfse_rps" com status "DRAFT" e após o envio simula a autorização atualizando o status para "AUTHORIZED" e gerando o código de verificação municipal.'),

('Impostos', 'ISS Retido na Fonte (Imposto sobre Serviços de Qualquer Natureza)', 'O ISS Retido na Fonte ocorre quando o tomador do serviço (comprador) assume a responsabilidade de recolher e pagar o imposto municipal à prefeitura, em vez de o prestador recolhê-lo. No cadastro de serviços ("nfse_services"), habilitar a flag "iss_retained" descontará automaticamente o montante do ISS líquido do valor a ser recebido da nota fiscal. É obrigatório informar o NBS (Nomenclatura Brasileira de Serviços) correspondente ao serviço para classificação legal e cálculo preciso.'),

('NFS-e', 'Diretrizes de Emissão NFS-e SP (Prefeitura de São Paulo): ISS e NBS', 'A prefeitura municipal de São Paulo possui diretrizes específicas para a emissão de NFS-e (Nota Fiscal de Serviços Eletrônica) a partir de Recibos Provisórios de Serviços (RPS).\n\n1. ALÍQUOTAS DE ISS (Imposto sobre Serviços):\nAs alíquotas do ISS em São Paulo mudam conforme o código do serviço paulistano (atividades exercidas), variando de 2% (alíquota mínima constitucional) até 5% (alíquota máxima).\n- Retenção na Fonte: Alguns serviços estão sujeitos à retenção do ISS pelo tomador de acordo com a Lei Municipal nº 13.701/2003. Em caso de retenção, a flag "iss_retained" deve ser habilitada para deduzir o valor no cálculo final de liquidação.\n\n2. NBS (Nomenclatura Brasileira de Serviços):\nA classificação correta pela NBS é obrigatória em São Paulo para determinar a correlação tributária precisa. O preenchimento nulo ou inadequado pode ocasionar rejeição das notas pela prefeitura ou enquadramento incorreto de alíquota.\n\n3. PRAZO DE CONVERSÃO:\nTodo RPS gerado no FinanAI deve ser transmitido e convertido em NFS-e paulistana definitiva em até 10 dias corridos a partir da data de sua emissão, sem ultrapassar o dia 5 do mês subsequente ao prestado, sob risco de retenções retroativas e penalidades.')
ON CONFLICT DO NOTHING;

