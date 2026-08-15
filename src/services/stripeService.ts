
import { loadSecureSetting } from "../lib/crypto";

const getStripeHeaders = () => {
  const stripeKey = loadSecureSetting('stripe_key') || localStorage.getItem('stripe_secret_key') || '';
  return {
    "Content-Type": "application/json",
    ...(stripeKey ? { "x-stripe-key": stripeKey } : {})
  };
};

export const StripeService = {
  async getBalance() {
    const res = await fetch("/api/stripe/balance", {
      headers: getStripeHeaders()
    });
    if (!res.ok) throw new Error("Falha ao buscar saldo do Stripe");
    try {
      return await res.json();
    } catch (e) {
      console.error("Erro ao parsear resposta do Stripe:", e);
      return { available: [], pending: [] }; // Fallback
    }
  },

  async createPaymentLink(name: string, amount: number) {
    const res = await fetch("/api/stripe/payment-links", {
      method: "POST",
      headers: getStripeHeaders(),
      body: JSON.stringify({ name, amount }),
    });
    if (!res.ok) throw new Error("Falha ao criar link de pagamento");
    try {
      return await res.json();
    } catch (e) {
      console.error("Erro ao parsear resposta do Stripe:", e);
      throw e;
    }
  },

  async getPayments() {
    const res = await fetch("/api/stripe/payments", {
      headers: getStripeHeaders()
    });
    if (!res.ok) throw new Error("Falha ao buscar pagamentos");
    try {
      return await res.json();
    } catch (e) {
      console.error("Erro ao parsear resposta do Stripe:", e);
      return []; // Fallback
    }
  }
};
