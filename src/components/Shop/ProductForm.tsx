import React, { useState, useEffect } from 'react';
import { 
  X, Save, Wand2, Plus, Trash2, Image as ImageIcon, Video, 
  ChevronDown, Barcode, Scale, Info, Instagram, Globe, Tag, 
  Settings, FileText, Package, DollarSign, Truck
} from 'lucide-react';
import { Product, ProductType, StockType, ProductVariation } from '../../types';
import { ShopService } from '../../services/shopService';
import * as GeminiService from '../../services/geminiService';

interface ProductFormProps {
  onClose: () => void;
  onSave: () => void;
  editingProduct?: Product;
  currentUser: any;
}

const ProductForm: React.FC<ProductFormProps> = ({ onClose, onSave, editingProduct, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'precos' | 'estoque' | 'dimensoes' | 'fiscal'>('geral');
  const [formData, setFormData] = useState<Partial<Product>>(
    editingProduct || {
      company_id: currentUser.company_id,
      name: '',
      description: '',
      price: 0,
      promotional_price: 0,
      cost: 0,
      show_price_in_store: true,
      type: 'PHYSICAL',
      stock_type: 'LIMITED',
      stock_quantity: 0,
      has_free_shipping: false,
      is_active: true,
      images: [],
      categories: [],
      tags: [],
      featured_sections: []
    }
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingProduct?.id) {
        await ShopService.updateProduct(editingProduct.id, formData);
      } else {
        await ShopService.addProduct(formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto. Verifique se as tabelas foram criadas no banco.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!formData.name) return alert('Dê um nome ao produto primeiro.');
    setIsGenerating(true);
    try {
      const prompt = `Crie uma descrição detalhada e atraente para o produto: ${formData.name}. Destaque benefícios como durabilidade, estilo e versatilidade de forma profissional para uma loja virtual em português. Foque em características técnicas e uso casual/formal se aplicável.`;
      const response = await GeminiService.generateChatResponse(prompt, []);
      setFormData(prev => ({ ...prev, description: response }));
    } catch (error) {
      console.error('AI Desc error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    const files = 'dataTransfer' in e ? e.dataTransfer.files : e.target.files;
    if (!files || files.length === 0) return;

    const newMedia = Array.from(files).map(file => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }));

    // In a real app, you would upload to Supabase Storage here.
    // For now, we'll store the object URLs and alert the user.
    setFormData(prev => ({
      ...prev,
      images: [...(prev.images || []), ...newMedia.filter(m => m.type === 'image').map(m => m.url)]
    }));
    
    if (newMedia.some(m => m.type === 'video')) {
       setFormData(prev => ({
         ...prev,
         video_url: newMedia.find(m => m.type === 'video')?.url || prev.video_url
       }));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handlePriceChange = (field: keyof Product, val: string) => {
    // Remove non-numeric characters and handle decimal shift for currency mask
    const digits = val.replace(/\D/g, '');
    const numericValue = digits ? parseFloat(digits) / 100 : 0;
    setFormData(prev => ({ ...prev, [field]: numericValue }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl border border-white/20 flex flex-col animate-in zoom-in-95 duration-300">
        <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preencha os detalhes do catálogo</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X size={20} /></button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 bg-slate-50 dark:bg-slate-950/50 p-6 border-r border-slate-100 dark:border-slate-800 hidden md:block overflow-y-auto">
            <nav className="space-y-1">
              {[
                { id: 'geral', label: 'Geral', icon: Package },
                { id: 'precos', label: 'Preços', icon: DollarSign },
                { id: 'estoque', label: 'Estoque & Códigos', icon: Barcode },
                { id: 'dimensoes', label: 'Frete & Dimensões', icon: Truck },
                { id: 'fiscal', label: 'Dados Fiscais', icon: FileText },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    activeTab === tab.id 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-700' 
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-950/20">
            {activeTab === 'geral' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Info size={12} /> Nome e Descrição
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nome do Produto</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Jaqueta de couro"
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                        value={formData.name || ''}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Descrição</label>
                        <button 
                          type="button"
                          onClick={handleGenerateDescription}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-full uppercase tracking-widest transition-all active:scale-95"
                        >
                          <Wand2 size={12} className={isGenerating ? "animate-spin" : ""} />
                          {isGenerating ? "Gerando..." : "Gerar com IA"}
                        </button>
                      </div>
                      <textarea 
                        rows={6}
                        placeholder="Descreva as características do produto..."
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                        value={formData.description || ''}
                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <ImageIcon size={12} /> Fotos e Vídeo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div 
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleFileChange}
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center group hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all cursor-pointer relative overflow-hidden"
                    >
                      <input 
                        id="file-upload"
                        type="file" 
                        multiple 
                        accept="image/*,video/*"
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 transition-all">
                        <Plus size={40} />
                      </div>
                      <p className="text-sm font-black text-slate-800 dark:text-white uppercase mb-1">Arraste arquivos ou clique</p>
                      <p className="text-[9px] font-bold text-slate-400 max-w-[200px]">Imagens e Vídeos suportados. Max 50MB.</p>
                      
                      {formData.images && formData.images.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                          {formData.images.slice(0, 3).map((img, i) => (
                            <img key={i} src={img} className="w-10 h-10 object-cover rounded-lg border-2 border-white shadow-sm" alt="Preview" />
                          ))}
                          {formData.images.length > 3 && <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-[8px] font-black">+{formData.images.length - 3}</div>}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Vídeo Promocional</label>
                        <div className="relative">
                          <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="url" 
                            placeholder="Link do vídeo (Youtube/Vimeo)"
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-inner"
                            value={formData.video_url || ''}
                            onChange={e => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                         <div className="flex gap-3">
                            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-amber-700 leading-relaxed uppercase">
                               Dica: Vídeos aumentam a conversão em até 80%. Você pode fazer upload de um arquivo ou colar um link externo.
                            </p>
                         </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Tipo de Produto</h3>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                      {(['PHYSICAL', 'DIGITAL'] as const).map(type => (
                        <button 
                          key={type}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type }))}
                          className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.type === type ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          {type === 'PHYSICAL' ? 'Físico' : 'Digital / Serviço'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Exibilidade</h3>
                    <div className="pt-2">
                       <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative">
                             <input 
                              type="checkbox" 
                              className="sr-only" 
                              checked={formData.is_active || false}
                              onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                             />
                             <div className={`w-12 h-6 rounded-full border-2 transition-all ${formData.is_active ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-200 border-slate-300 dark:bg-slate-800 dark:border-slate-700'}`}></div>
                             <div className={`absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm transition-all ${formData.is_active ? 'translate-x-6 bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'}`}></div>
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Produto Ativo</span>
                       </label>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'precos' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <DollarSign size={12} /> Definição de Preços
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Preço de Venda</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-indigo-500">R$</span>
                        <input 
                          type="text" 
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black shadow-inner"
                          value={(formData.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={e => handlePriceChange('price', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Preço Promocional</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-rose-500">R$</span>
                        <input 
                          type="text" 
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black shadow-inner"
                          value={(formData.promotional_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={e => handlePriceChange('promotional_price', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Custo Interno</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">R$</span>
                        <input 
                          type="text" 
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black shadow-inner"
                          value={(formData.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={e => handlePriceChange('cost', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded"
                        checked={formData.show_price_in_store || false}
                        onChange={e => setFormData(prev => ({ ...prev, show_price_in_store: e.target.checked }))}
                      />
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Exibir Preço na Loja</span>
                    </label>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'estoque' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Barcode size={12} /> Códigos e Rastreamento
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">SKU</label>
                      <input 
                        type="text" 
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black shadow-inner"
                        value={formData.sku || ''}
                        onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Código de Barras</label>
                      <input 
                        type="text" 
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black shadow-inner"
                        value={formData.barcode || ''}
                        onChange={e => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Gestão de Inventário</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Tipo de Controle</label>
                      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                        {(['INFINITE', 'LIMITED'] as const).map(s => (
                          <button 
                            key={s}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, stock_type: s }))}
                            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.stock_type === s ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                          >
                            {s === 'INFINITE' ? 'Infinito' : 'Limitado'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {formData.stock_type === 'LIMITED' && (
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Quantidade</label>
                        <input 
                          type="number" 
                          className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black shadow-inner"
                          value={formData.stock_quantity || 0}
                          onChange={e => setFormData(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'dimensoes' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Truck size={12} /> Logística & Frete
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><label className="text-[10px] font-black mb-2 block">Peso (kg)</label><input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black" value={formData.weight || 0} onChange={e => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))} /></div>
                    <div><label className="text-[10px] font-black mb-2 block">Comp. (cm)</label><input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black" value={formData.length || 0} onChange={e => setFormData(prev => ({ ...prev, length: parseInt(e.target.value) || 0 }))} /></div>
                    <div><label className="text-[10px] font-black mb-2 block">Largura (cm)</label><input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black" value={formData.width || 0} onChange={e => setFormData(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))} /></div>
                    <div><label className="text-[10px] font-black mb-2 block">Altura (cm)</label><input type="number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black" value={formData.height || 0} onChange={e => setFormData(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))} /></div>
                  </div>
                  <div className="mt-8 bg-emerald-50 dark:bg-emerald-950/30 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={formData.has_free_shipping || false} onChange={e => setFormData(prev => ({ ...prev, has_free_shipping: e.target.checked }))} />
                      <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Frete Grátis</span>
                    </label>
                  </div>
                </section>
                <section>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Instagram / Google</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div><label className="text-[10px] font-black mb-2 block">MPN</label><input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-sm" value={formData.mpn || ''} onChange={e => setFormData(prev => ({ ...prev, mpn: e.target.value }))} /></div>
                       <div><label className="text-[10px] font-black mb-2 block">Faixa Etária</label><input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-sm" value={formData.age_range || ''} onChange={e => setFormData(prev => ({ ...prev, age_range: e.target.value }))} /></div>
                    </div>
                </section>
              </div>
            )}

            {activeTab === 'fiscal' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <section>
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <FileText size={12} /> Dados para Nota Fiscal
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><label className="text-[10px] font-black mb-2 block">Origem</label><input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-sm" value={formData.fiscal_origin || ''} onChange={e => setFormData(prev => ({ ...prev, fiscal_origin: e.target.value }))} /></div>
                      <div><label className="text-[10px] font-black mb-2 block">NCM</label><input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-sm" value={formData.ncm || ''} onChange={e => setFormData(prev => ({ ...prev, ncm: e.target.value }))} /></div>
                      <div><label className="text-[10px] font-black mb-2 block">CEST</label><input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-sm" value={formData.cest || ''} onChange={e => setFormData(prev => ({ ...prev, cest: e.target.value }))} /></div>
                   </div>
                </section>
              </div>
            )}
          </form>
        </div>

        <footer className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-end shrink-0 gap-4">
          <button type="button" onClick={onClose} className="px-6 py-3.5 text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancelar</button>
          <button 
            type="submit" 
            disabled={isLoading}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
          >
            {isLoading ? 'Salvando...' : 'Salvar Produto'}
            <Save size={16} />
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ProductForm;
