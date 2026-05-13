import React, { useState } from 'react';
import { 
  ShoppingBag, Users, Package, Truck, Tag, ClipboardList, BarChart3, Settings, 
  ChevronRight, ArrowRight, UserPlus, Box, DollarSign, Factory, Wallet
} from 'lucide-react';
import ProductManager from './ProductManager';
import CustomerManager from './CustomerManager';
import SupplierManager from './SupplierManager';
import OrderManager from './OrderManager';

interface ShopManagerProps {
  currentUser: any;
  t: any;
}

const ShopManager: React.FC<ShopManagerProps> = ({ currentUser, t }) => {
  const [activeView, setActiveView] = useState<'overview' | 'products' | 'customers' | 'suppliers' | 'orders' | 'inventory' | 'shipping'>('overview');

  const stats = [
    { label: 'Produtos Ativos', value: '0', icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pedidos Pendentes', value: '0', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Clientes Cadastrados', value: '0', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total em Vendas', value: 'R$ 0,00', icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' }
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'products':
        return <ProductManager currentUser={currentUser} />;
      case 'customers':
        return <CustomerManager currentUser={currentUser} />;
      case 'suppliers':
        return <SupplierManager currentUser={currentUser} />;
      case 'orders':
        return <OrderManager currentUser={currentUser} />;
      default:
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className={`w-12 h-12 ${stat.bg} dark:bg-slate-800 rounded-2xl flex items-center justify-center ${stat.color} mb-4`}>
                    <stat.icon size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase flex items-center gap-2">
                  <ShoppingBag size={20} className="text-indigo-600" /> Atalhos Rápidos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Catálogo de Produtos', desc: 'Gerencie itens, preços e variações', icon: Package, view: 'products', color: 'bg-indigo-600' },
                    { title: 'Gestão de Clientes', desc: 'Base de dados e tabelas de preços', icon: Users, view: 'customers', color: 'bg-emerald-600' },
                    { title: 'Pedidos e Vendas', desc: 'Controle de ordens e faturamento', icon: ClipboardList, view: 'orders', color: 'bg-amber-600' },
                    { title: 'Fornecedores', desc: 'Gestão de parceiros e compras', icon: Factory, view: 'suppliers', color: 'bg-rose-600' }
                  ].map((item, i) => (
                    <button 
                      key={i}
                      onClick={() => setActiveView(item.view as any)}
                      className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group"
                    >
                      <div className={`w-12 h-12 ${item.color} rounded-2xl flex items-center justify-center text-white shrink-0`}>
                        <item.icon size={24} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase mb-0.5">{item.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{item.desc}</p>
                      </div>
                      <ArrowRight size={18} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase flex items-center gap-2">
                  <BarChart3 size={20} className="text-indigo-600" /> Vendas Recentes
                </h3>
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center py-10 opacity-50 grayscale">
                      <ShoppingBag size={40} className="text-slate-300 mb-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma venda registrada</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col pt-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 mb-8 text-[10px] font-black uppercase tracking-widest text-slate-400 overflow-x-auto whitespace-nowrap bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 w-fit shrink-0">
        <button onClick={() => setActiveView('overview')} className={`hover:text-indigo-600 transition-all ${activeView === 'overview' ? 'text-indigo-600 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg' : ''}`}>MODULO LOJA</button>
        {activeView !== 'overview' && (
          <>
            <ChevronRight size={12} />
            <span className="text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">{activeView}</span>
          </>
        )}
      </div>

      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
};

export default ShopManager;
