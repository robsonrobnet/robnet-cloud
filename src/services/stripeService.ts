
export const StripeService = {
  async getBalance() {
    const res = await fetch("/api/stripe/balance");
    if (!res.ok) throw new Error("Falha ao buscar saldo do Stripe");
    return res.json();
  },

  async createPaymentLink(name: string, amount: number) {
    const res = await fetch("/api/stripe/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount }),
    });
    if (!res.ok) throw new Error("Falha ao criar link de pagamento");
    return res.json();
  },

  async getPayments() {
    const res = await fetch("/api/stripe/payments");
    if (!res.ok) throw new Error("Falha ao buscar pagamentos");
    return res.json();
  }
};
