
import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy Stripe Initialization
let stripeClient: Stripe | null = null;
const getStripe = () => {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
};

// --- STRIPE API ROUTES ---

// 1. Get Balance
app.get("/api/stripe/balance", async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    const balance = await stripe.balance.retrieve();
    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create Payment Link (Quick)
app.post("/api/stripe/payment-links", async (req: Request, res: Response) => {
  try {
    const { name, amount, currency = "brl" } = req.body;
    const stripe = getStripe();

    // Create Product
    const product = await stripe.products.create({
      name: name || "Produto Avulso",
    });

    // Create Price
    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100), // convert to cents
      currency,
      product: product.id,
    });

    // Create Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
    });

    res.json(paymentLink);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. List Recent Payments
app.get("/api/stripe/payments", async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    const payments = await stripe.paymentIntents.list({ limit: 10 });
    res.json(payments.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- VITE MIDDLEWARE ---
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
