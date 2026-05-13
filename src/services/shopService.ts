import { supabase, formatSupabaseError } from '../lib/supabase';
import { 
  Product, 
  ProductVariation, 
  ShopCustomer, 
  Supplier, 
  PriceTable, 
  SalesOrder, 
  OrderItem 
} from '../types';

export const ShopService = {
  // PRODUCTS
  async getProducts(companyId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Product[];
  },

  async addProduct(product: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  async updateProduct(id: string, product: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // VARIATIONS
  async getVariations(productId: string) {
    const { data, error } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', productId);
    if (error) throw error;
    return data as ProductVariation[];
  },

  // CUSTOMERS
  async getCustomers(companyId: string) {
    const { data, error } = await supabase
      .from('shop_customers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data as ShopCustomer[];
  },

  async addCustomer(customer: Partial<ShopCustomer>) {
    const { data, error } = await supabase
      .from('shop_customers')
      .insert([customer])
      .select()
      .single();
    if (error) throw error;
    return data as ShopCustomer;
  },

  // SUPPLIERS
  async getSuppliers(companyId: string) {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data as Supplier[];
  },

  async addSupplier(supplier: Partial<Supplier>) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();
    if (error) throw error;
    return data as Supplier;
  },

  // PRICE TABLES
  async getPriceTables(companyId: string) {
    const { data, error } = await supabase
      .from('price_tables')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data as PriceTable[];
  },

  async addPriceTable(table: Partial<PriceTable>) {
    const { data, error } = await supabase
      .from('price_tables')
      .insert([table])
      .select()
      .single();
    if (error) throw error;
    return data as PriceTable;
  },

  // ORDERS
  async getOrders(companyId: string) {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('*, shop_customers(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as (SalesOrder & { shop_customers: ShopCustomer })[];
  },

  async createOrder(order: Partial<SalesOrder>, items: Partial<OrderItem>[]) {
    const { data: orderData, error: orderError } = await supabase
      .from('sales_orders')
      .insert([order])
      .select()
      .single();
    
    if (orderError) throw orderError;

    const orderId = orderData.id;
    const itemsWithOrderId = items.map(item => ({ ...item, order_id: orderId }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) throw itemsError;

    return orderData as SalesOrder;
  }
};
