import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, MoreHorizontal, Edit, Trash2, 
  Package, DollarSign, Barcode, Scale, Tag, Image as ImageIcon, Video, 
  Boxes, LayoutGrid, List, Layers, Bookmark, Cpu, Truck, ShoppingCart, Users, Factory
} from 'lucide-react';
import { Product, ProductType, StockType } from '../../types';
import { ShopService } from '../../services/shopService';
import ProductForm from './ProductForm';

interface ProductManagerProps {
  currentUser: any;
}

const ProductManager: React.FC<ProductManagerProps> = ({ currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const data = await ShopService.getProducts(currentUser.company_id);
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentUser.company_id]);

  const handleAdd = () => {
    setEditingProduct(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este produto?')) {
      try {
        await ShopService.deleteProduct(id);
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">PRODUTOS</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gestão de estoque e catálogo</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <button 
            onClick={handleAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou SKU..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 transition-all">
          <Filter size={18} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Package size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum produto encontrado</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={20} className="text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white capitalize">{product.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">SKU: {product.sku || 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-emerald-600">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    {product.promotional_price && (
                      <p className="text-[10px] font-bold text-slate-400 line-through">R$ {product.promotional_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {product.stock_type === 'INFINITE' ? (
                      <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg uppercase tracking-widest italic">∞ Infinito</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className={`text-sm font-black ${(product.stock_quantity || 0) <= 5 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`}>
                          {product.stock_quantity || 0} un
                        </p>
                        <div className="w-20 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${(product.stock_quantity || 0) <= 5 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min(((product.stock_quantity || 0) / 100) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${product.is_active ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                      {product.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(product)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all group">
              <div className="aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={40} className="text-slate-300" />
                  </div>
                )}
                <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                  <button onClick={() => handleEdit(product)} className="p-2 bg-white dark:bg-slate-800 text-indigo-600 rounded-xl shadow-lg hover:scale-110 transition-all"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(product.id)} className="p-2 bg-white dark:bg-slate-800 text-rose-500 rounded-xl shadow-lg hover:scale-110 transition-all"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{product.sku || 'S/ SKU'}</p>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${product.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {product.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <h3 className="font-black text-slate-800 dark:text-white capitalize mb-4 line-clamp-2">{product.name}</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-black text-indigo-600">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Estoque</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">{product.stock_type === 'INFINITE' ? '∞' : `${product.stock_quantity ?? 0} un`}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <ProductForm 
          onClose={() => setIsFormOpen(false)} 
          onSave={() => { setIsFormOpen(false); fetchProducts(); }} 
          editingProduct={editingProduct}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default ProductManager;
