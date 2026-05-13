import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, Mail, Phone, MapPin, Tag } from 'lucide-react';
import { ShopCustomer } from '../../types';
import { ShopService } from '../../services/shopService';

const CustomerManager: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [customers, setCustomers] = useState<ShopCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<ShopCustomer>>({
    company_id: currentUser.company_id,
    name: '',
    email: '',
    phone: '',
    document_number: '',
    type: 'RETAIL'
  });

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await ShopService.getCustomers(currentUser.company_id);
      setCustomers(data);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleCreate = async () => {
    if (!newCustomer.name || !newCustomer.email) return alert('Nome e Email são obrigatórios');
    try {
      await ShopService.addCustomer(newCustomer);
      setIsFormOpen(false);
      fetchCustomers();
    } catch (e) { alert('Erro ao cadastrar cliente'); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase">CLIENTES</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Varejo e Atacado</p>
        </div>
        <button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
          <Plus size={18} /> Add Cliente
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 animate-in zoom-in-95 duration-200">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Novo Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome e Sobrenome</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-sm border-none shadow-inner"
                value={newCustomer.name}
                onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-sm border-none shadow-inner"
                value={newCustomer.email}
                onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-sm border-none shadow-inner"
                value={newCustomer.phone}
                onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CPF ou CNPJ</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-sm border-none shadow-inner"
                value={newCustomer.document_number}
                onChange={e => setNewCustomer({...newCustomer, document_number: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Perfil</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-sm border-none shadow-inner"
                value={newCustomer.type}
                onChange={e => setNewCustomer({...newCustomer, type: e.target.value as any})}
              >
                <option value="RETAIL">Varejo</option>
                <option value="WHOLESALE">Atacado</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-slate-400 font-black text-xs uppercase">Cancelar</button>
            <button onClick={handleCreate} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Salvar Cliente</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map(customer => (
          <div key={customer.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 group-hover:scale-150 transition-all duration-500 ${customer.type === 'WHOLESALE' ? 'bg-indigo-600' : 'bg-emerald-600'}`}></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                <Users size={24} />
              </div>
              <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest ${customer.type === 'WHOLESALE' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {customer.type === 'WHOLESALE' ? 'Atacado' : 'Varejo'}
              </span>
            </div>
            <h4 className="font-black text-slate-800 dark:text-white mb-2 uppercase">{customer.name}</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <Mail size={12} /> {customer.email}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <Phone size={12} /> {customer.phone || 'N/A'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerManager;
