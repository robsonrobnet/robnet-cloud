
import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' })); // Increase limit for XML/PDF attachments

// --- REQUEST LOGGER ---
app.use((req, res, next) => {
  console.log(`[Server] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).send();
  }
  next();
});

// --- HEALTH CHECK ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- SUPABASE CLIENT (Backend) ---
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- SMTP CONFIGURATION ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.robnet.com.br",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: (process.env.SMTP_PORT || "465") === "465", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "finaai@robnet.com.br",
    pass: process.env.SMTP_PASS || "2298R@b161047#",
  },
  tls: {
    rejectUnauthorized: false // Often needed for custom mail servers
  }
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Transporter Error:", error);
  } else {
    console.log("SMTP Transporter is ready to send emails");
  }
});

// --- EMAIL API ROUTE ---
app.post("/api/send-email", async (req: Request, res: Response) => {
  const { email, name, subject, html, attachments } = req.body;

  if (!email || !html) {
    return res.status(400).json({ error: "Email and content are required" });
  }

  try {
    const mailOptions: any = {
      from: `"FinanAI OS" <${process.env.SMTP_USER || "finaai@robnet.com.br"}>`,
      to: email,
      subject: subject || "Notificação FinanAI OS",
      html: html,
    };

    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("SMTP Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- TEST EMAIL ENDPOINT ---
app.all("/api/test-email", async (req: Request, res: Response) => {
  console.log(`[SMTP] Received ${req.method} request to /api/test-email`);
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  const { email } = req.body;
  
  if (!email) return res.status(400).json({ error: "Target email is required" });

  console.log(`[SMTP] Attempting test email to: ${email}`);

  try {
    // Verify connection first
    await new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          console.error("[SMTP] Verification failed:", error);
          reject(error);
        } else {
          resolve(success);
        }
      });
    });

    const info = await transporter.sendMail({
      from: `"FinanAI Test" <${process.env.SMTP_USER || "finaai@robnet.com.br"}>`,
      to: email,
      subject: "Teste de Conexão SMTP - FinanAI OS",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1;">Conexão SMTP Bem-sucedida!</h2>
          <p>Este é um e-mail de teste enviado pelo sistema <strong>FinanAI OS</strong>.</p>
          <p>Se você recebeu este e-mail, as configurações de SMTP estão corretas.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">Enviado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      `,
    });

    console.log("[SMTP] Test email sent successfully:", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("[SMTP] Test Error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Unknown SMTP Error",
      code: error.code,
      command: error.command
    });
  }
});

// --- DAILY ALERTS CRON JOB ---
// Runs every day at 08:00 AM
cron.schedule("0 8 * * *", async () => {
  console.log("[Cron] Starting daily financial alerts...");
  
  try {
    // 1. Get all users with email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, company_id, email, username')
      .not('email', 'is', null);

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      // 2. Get pending/overdue transactions for this user's company
      const { data: transactions, error: tError } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('status', 'PENDING');

      if (tError) continue;
      if (!transactions || transactions.length === 0) continue;

      const overdue = transactions.filter(t => t.due_date && t.due_date < today);
      const dueToday = transactions.filter(t => t.due_date === today);

      if (overdue.length === 0 && dueToday.length === 0) continue;

      // 3. Prepare Email Content
      let html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.025em;">Alerta Financeiro Diário</h1>
            <p style="margin: 10px 0 0; color: #94a3b8; font-size: 14px;">Olá, ${user.username}!</p>
          </div>
          <div style="padding: 30px;">
      `;

      if (overdue.length > 0) {
        html += `
          <h2 style="color: #ef4444; font-size: 18px; margin-top: 0;">⚠️ Contas Atrasadas (${overdue.length})</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="text-align: left; border-bottom: 2px solid #f1f5f9;">
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Descrição</th>
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
        `;
        overdue.forEach(t => {
          html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-size: 14px;">${t.description} <br><small style="color: #94a3b8;">Venceu em: ${t.due_date}</small></td>
              <td style="padding: 10px 0; font-size: 14px; font-weight: bold; text-align: right; color: #ef4444;">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }

      if (dueToday.length > 0) {
        html += `
          <h2 style="color: #f59e0b; font-size: 18px;">📅 Vencendo Hoje (${dueToday.length})</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="text-align: left; border-bottom: 2px solid #f1f5f9;">
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Descrição</th>
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
        `;
        dueToday.forEach(t => {
          html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-size: 14px;">${t.description}</td>
              <td style="padding: 10px 0; font-size: 14px; font-weight: bold; text-align: right; color: #f59e0b;">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }

      html += `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
              <a href="${process.env.APP_URL || '#'}" style="background-color: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Acessar Painel Financeiro</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            Este é um alerta automático do FinanAI OS. Não responda a este e-mail.
          </div>
        </div>
      `;

      // 4. Send Email
      await transporter.sendMail({
        from: `"FinanAI Alertas" <${process.env.SMTP_USER || "finaai@robnet.com.br"}>`,
        to: user.email,
        subject: `Alerta Financeiro: ${overdue.length + dueToday.length} itens pendentes`,
        html: html,
      });
      
      console.log(`[Cron] Alert sent to ${user.email}`);
    }
  } catch (error) {
    console.error("[Cron] Error sending alerts:", error);
  }
});

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
