
import React, { useState, useEffect } from 'react';
import { StripeService } from '../services/stripeService';
import { 
  CreditCard, 
  DollarSign, 
  Link as LinkIcon, 
  Plus, 
  Loader2, 
  ExternalLink, 
  TrendingUp, 
  History,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

export default function StripeManager() {
  const [balance, setBalance] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<{ name: string; amount: string }>({ name: '', amount: '' });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bal, pay] = await Promise.all([
        StripeService.getBalance(),
        StripeService.getPayments()
      ]);
      setBalance(bal);
      setPayments(pay);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.name || !newLink.amount) return;

    try {
      setCreating(true);
      const result = await StripeService.createPaymentLink(newLink.name, parseFloat(newLink.amount));
      setGeneratedLink(result.url);
      setNewLink({ name: '', amount: '' });
      fetchData(); // Refresh data
    } catch (err) {
      console.error(err);
      alert("Erro ao criar link de pagamento");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-slate-500 font-medium animate-pulse">Carregando dados do Stripe...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 opacity-80 mb-1">
              <DollarSign size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Saldo Disponível (Stripe)</span>
            </div>
            <div className="text-4xl font-black tracking-tight mb-4">
              {balance?.available?.[0]?.currency?.toUpperCase()} {(balance?.available?.[0]?.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex-1">
                <span className="block text-[10px] font-bold uppercase opacity-60 mb-1">Pendente</span>
                <span className="text-lg font-bold">
                  {balance?.pending?.[0]?.currency?.toUpperCase()} {(balance?.pending?.[0]?.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex-1">
                <span className="block text-[10px] font-bold uppercase opacity-60 mb-1">Status</span>
                <span className="flex items-center gap-1 text-sm font-bold">
                  <CheckCircle2 size={14} className="text-emerald-400" /> Conectado
                </span>
              </div>
            </div>
          </div>
          <CreditCard className="absolute -right-8 -bottom-8 text-white/10 rotate-12" size={200} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
            <LinkIcon size={18} className="text-indigo-600" /> Gerar Link de Pagamento
          </h3>
          <form onSubmit={handleCreateLink} className="space-y-3">
            <input 
              type="text" 
              placeholder="Nome do Produto/Serviço" 
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={newLink.name}
              onChange={e => setNewLink({...newLink, name: e.target.value})}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
              <input 
                type="number" 
                step="0.01"
                placeholder="0,00" 
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={newLink.amount}
                onChange={e => setNewLink({...newLink, amount: e.target.value})}
              />
            </div>
            <button 
              disabled={creating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Criar Link
            </button>
          </form>
        </div>
      </div>

      {/* Generated Link Alert */}
      {generatedLink && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4 animate-in slide-in-from-top-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="font-black text-emerald-900 dark:text-emerald-100 uppercase text-xs tracking-wider mb-1">Link Gerado com Sucesso!</h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium truncate max-w-md">{generatedLink}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => copyToClipboard(generatedLink)}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 hover:bg-emerald-100 transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </button>
            <a 
              href={generatedLink} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <ExternalLink size={14} /> Abrir
            </a>
          </div>
        </div>
      )}

      {/* Recent Payments */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <History size={18} className="text-indigo-600" /> Pagamentos Recentes
          </h3>
          <button onClick={fetchData} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Atualizar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4 text-xs font-medium text-slate-500">
                    {new Date(p.created * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-800 dark:text-white">{p.description || 'Pagamento Stripe'}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{p.id}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 dark:text-white">
                    {p.currency.toUpperCase()} {(p.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      p.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <a 
                      href={`https://dashboard.stripe.com/payments/${p.id}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">Nenhum pagamento encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
