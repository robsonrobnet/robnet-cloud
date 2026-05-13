import React, { useState, useEffect } from 'react';
import { 
  X, Save, Plus, Trash2, Search, User, Package, 
  DollarSign, ShoppingCart, Info, Clock, CheckCircle
} from 'lucide-react';
import { Product, ShopCustomer, SalesOrder, OrderItem } from '../../types';
import { ShopService } from '../../services/shopService';

interface OrderFormProps {
  onClose: () => void;
  onSave: () => void;
  currentUser: any;
}

const OrderForm: React.FC<OrderFormProps> = ({ onClose, onSave, currentUser }) => {
  const [customers, setCustomers] = useState<ShopCustomer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<Partial<OrderItem>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [c, p] = await Promise.all([
          ShopService.getCustomers(currentUser.company_id),
          ShopService.getProducts(currentUser.company_id)
        ]);
        setCustomers(c);
        setProducts(p);
      } catch (e) {
        console.error(e);
      } finally {
        setIsFetching(false);
      }
    };
    fetchData();
  }, []);

  const addItem = (product: Product) => {
    const existing = orderItems.find(item => item.product_id === product.id);
    if (existing) {
      setOrderItems(orderItems.map(item => 
        item.product_id === product.id 
        ? { ...item, quantity: (item.quantity || 0) + 1, total_price: ((item.quantity || 0) + 1) * (product.price || 0) }
        : item
      ));
    } else {
      setOrderItems([...orderItems, {
        product_id: product.id,
        quantity: 1,
        unit_price: product.price,
        total_price: product.price,
        // Using any title for the item (optional based on your schema)
      }]);
    }
  };

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((acc, item) => acc + (item.total_price || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return alert('Selecione um cliente');
    if (orderItems.length === 0) return alert('Adicione pelo menos um item');

    setIsLoading(true);
    try {
      const orderData: Partial<SalesOrder> = {
        company_id: currentUser.company_id,
        customer_id: selectedCustomerId,
        total_amount: calculateTotal(),
        status: 'PENDING',
        payment_status: 'PENDING'
      };

      await ShopService.createOrder(orderData, orderItems);
      onSave();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar pedido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in-95">
        <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Nova Venda</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registro de saída de produtos</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-2xl"><X size={20} /></button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <User size={12} /> Cliente
              </h3>
              <select 
                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                required
              >
                <option value="">Selecione um cliente...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </section>

            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package size={12} /> Adicionar Produtos
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {products.map(p => (
                  <button 
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-2xl transition-all text-left group"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{p.name}</p>
                      <p className="text-[10px] font-bold text-slate-500">
                        {p.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div className="p-2 bg-indigo-600 text-white rounded-xl scale-0 group-hover:scale-100 transition-all">
                      <Plus size={16} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/30 rounded-[2rem] p-6 flex flex-col">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <ShoppingCart size={12} /> Resumo do Pedido
             </h3>
             <div className="flex-1 space-y-4">
                {orderItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                     <ShoppingCart size={48} className="mb-2 opacity-20" />
                     <p className="text-[10px] font-black uppercase tracking-widest">Carrinho Vazio</p>
                  </div>
                ) : (
                  orderItems.map((item, idx) => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <div>
                            <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase">{product?.name}</p>
                            <p className="text-[9px] font-bold text-slate-500">{item.quantity}x {item.unit_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                         <button 
                          type="button" 
                          onClick={() => removeItem(item.product_id!)}
                          className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                         >
                            <Trash2 size={16} />
                         </button>
                      </div>
                    );
                  })
                )}
             </div>

             <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Geral</p>
                   <p className="text-xl font-black text-indigo-600">
                      {calculateTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                   </p>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading || orderItems.length === 0}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isLoading ? 'Gerando Pedido...' : 'Finalizar Venda'}
                  <Save size={18} />
                </button>
             </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderForm;
