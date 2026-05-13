import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, Plus, Filter, Clock, CheckCircle, Truck, XCircle, CreditCard } from 'lucide-react';
import { SalesOrder, ShopCustomer } from '../../types';
import { ShopService } from '../../services/shopService';

import OrderForm from './OrderForm';

const OrderManager: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [orders, setOrders] = useState<(SalesOrder & { shop_customers: ShopCustomer })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const data = await ShopService.getOrders(currentUser.company_id);
      setOrders(data);
    } catch (e) { 
      console.error(e); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20';
      case 'SHIPPED': return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20';
      case 'DELIVERED': return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20';
      case 'CANCELLED': return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20';
      case 'PENDING': return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20';
      default: return 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircle size={12} className="text-emerald-500" />;
      case 'SHIPPED': return <Truck size={12} className="text-blue-500" />;
      case 'DELIVERED': return <ShoppingBag size={12} className="text-indigo-500" />;
      case 'CANCELLED': return <XCircle size={12} className="text-rose-500" />;
      case 'PENDING': return <Clock size={12} className="text-amber-500" />;
      default: return <Clock size={12} className="text-slate-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID': return 'Pago';
      case 'SHIPPED': return 'Enviado';
      case 'DELIVERED': return 'Entregue';
      case 'CANCELLED': return 'Cancelado';
      case 'PENDING': return 'Pendente';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase">PEDIDOS</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Controle de vendas e envios</p>
        </div>
        <button 
          onClick={() => setIsOrderFormOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus size={18} /> Nova Venda
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
          <ShoppingBag size={64} className="text-slate-200 dark:text-slate-800 mx-auto mb-6" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum pedido realizado</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ID/Data</th>
                <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cliente</th>
                <th className="text-right py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</th>
                <th className="text-center py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer">
                  <td className="py-6 px-8">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <ShoppingBag size={18} />
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase">#{order.id.slice(0, 8)}</p>
                          <p className="text-[10px] font-bold text-slate-400">{new Date(order.created_at || '').toLocaleDateString('pt-BR')}</p>
                       </div>
                    </div>
                  </td>
                  <td className="py-6 px-8">
                     <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{order.shop_customers?.name || 'Venda Direta'}</p>
                  </td>
                  <td className="py-6 px-8 text-right">
                     <p className="text-sm font-black text-slate-800 dark:text-white">
                        {order.total_amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </p>
                  </td>
                  <td className="py-6 px-8 text-center text-current">
                     <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm ${getStatusStyle(order.status || '')}`}>
                        {getStatusIcon(order.status || '')}
                        {getStatusLabel(order.status || '')}
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isOrderFormOpen && (
        <OrderForm 
          onClose={() => setIsOrderFormOpen(false)}
          onSave={() => { setIsOrderFormOpen(false); fetchOrders(); }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default OrderManager;
