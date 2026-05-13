import React, { useState, useEffect } from 'react';
import { Plus, Factory, Search, Mail, Phone, X } from 'lucide-react';
import { Supplier } from '../../types';
import { ShopService } from '../../services/shopService';

const SupplierManager: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    company_id: currentUser.company_id,
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await ShopService.getSuppliers(currentUser.company_id);
      setSuppliers(data);
    } catch (e) { 
      console.error(e); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await ShopService.addSupplier(formData);
      setIsFormOpen(false);
      setFormData({ company_id: currentUser.company_id, name: '', email: '', phone: '', address: '' });
      fetchSuppliers();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar fornecedor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase">FORNECEDORES</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gestão de compras e parceiros</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus size={18} /> Novo Fornecedor
        </button>
      </div>

      {isLoading && suppliers.length === 0 ? (
        <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-900 shadow-inner rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
               <Factory size={48} className="text-slate-300 dark:text-slate-700 mx-auto mb-4" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum fornecedor cadastrado</p>
            </div>
          ) : (
            suppliers.map(s => (
              <div key={s.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                  <Factory size={24} />
                </div>
                <h4 className="font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tight">{s.name}</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                    <div className="w-6 h-6 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center"><Mail size={12} /></div>
                    {s.email || 'N/A'}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                    <div className="w-6 h-6 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center"><Phone size={12} /></div>
                    {s.phone || 'N/A'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Novo Fornecedor</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preencha os dados do parceiro</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"
              >
                <X size={20} />
              </button>
            </header>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nome / Fantasia</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                  value={formData.name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">E-mail</label>
                  <input 
                    type="email" 
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                    value={formData.email || ''}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Telefone</label>
                  <input 
                    type="tel" 
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                    value={formData.phone || ''}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Endereço</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                  value={formData.address || ''}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
              >
                {isLoading ? 'Salvando...' : 'Salvar Fornecedor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManager;
