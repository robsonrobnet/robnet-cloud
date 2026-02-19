
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Desestruturação expandida para suportar emails genéricos no futuro
    const { email, name, accessKey, plan, type, subject, content } = await req.json();

    const isGeneric = type === 'GENERIC';
    const isDeletion = type === 'DELETION_REQUEST';

    if (!isGeneric && !isDeletion && (!email || !accessKey)) {
      throw new Error("Missing email or accessKey");
    }

    // SMTP Configuration Updated (ConDigital)
    const transporter = nodemailer.createTransport({
      host: "condigital.robnet.com.br",
      port: 465,
      secure: true, // SSL/TLS
      auth: {
        user: "adm@condigital.robnet.com.br",
        pass: "2298R@b161047#", // Mantida senha do ambiente anterior. Atualize se necessário.
      },
    });

    // Configuração Base do Email
    let mailOptions = {
        from: '"FinanAI Security" <adm@condigital.robnet.com.br>',
        to: email,
        bcc: "adm@condigital.robnet.com.br", // Notificação oculta para o Administrador
        subject: "",
        html: ""
    };

    if (isGeneric) {
        // Fluxo para "outros envios" (Notificações gerais, alertas, etc)
        mailOptions.subject = subject || "Notificação FinanAI";
        mailOptions.html = content || "<p>Nova mensagem do sistema.</p>";
    } else if (isDeletion) {
        // Fluxo de Solicitação de Exclusão
        mailOptions.subject = `⚠️ Aviso de Encerramento de Conta - FinanAI`;
        mailOptions.html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
            <div style="background-color: #ef4444; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px;">Encerramento de Conta</h1>
              <p style="margin: 5px 0 0 0; color: #fee2e2; font-size: 12px; letter-spacing: 2px;">ACCOUNT TERMINATION NOTICE</p>
            </div>
            <div style="padding: 40px;">
              <p style="font-size: 16px; color: #cbd5e1;">Olá, <strong>${name}</strong>,</p>
              <p style="font-size: 16px; color: #cbd5e1; line-height: 1.6;">
                Recebemos sua solicitação para exclusão da conta empresarial e de todos os dados vinculados.
              </p>
              
              <div style="background-color: #1f2937; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin: 0 0 10px 0; font-weight: bold;">Data Agendada para Exclusão Definitiva</p>
                <p style="font-size: 20px; color: #ffffff; font-weight: bold; margin: 0;">
                  ${content}
                </p>
                <p style="font-size: 12px; color: #ef4444; margin-top: 10px;">
                  * Seus dados serão mantidos em segurança por 30 dias antes da remoção permanente.
                </p>
              </div>

              <p style="font-size: 14px; color: #94a3b8;">
                Se você não solicitou esta ação ou deseja cancelar o agendamento, entre em contato com o suporte imediatamente respondendo a este e-mail.
              </p>
            </div>
            <div style="background-color: #0f172a; padding: 20px; text-align: center; font-size: 10px; color: #475569;">
              &copy; 2024 FinanAI OS. Security Operations.<br/>
              ID da Solicitação: ${Date.now()}
            </div>
          </div>
        `;
    } else {
        // Fluxo Padrão: Boas-vindas e Credencial
        mailOptions.subject = `🔑 Sua Credencial de Acesso - FinanAI OS`;
        mailOptions.html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; color: #ffffff; border-radius: 16px; overflow: hidden;">
            <div style="background-color: #4f46e5; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px;">FinanAI OS</h1>
              <p style="margin: 5px 0 0 0; color: #e0e7ff; font-size: 12px; letter-spacing: 2px;">SECURE ACCESS CREDENTIAL</p>
            </div>
            <div style="padding: 40px;">
              <p style="font-size: 16px; color: #94a3b8;">Olá, <strong>${name}</strong>,</p>
              <p style="font-size: 16px; color: #cbd5e1; line-height: 1.6;">
                Sua conta corporativa foi provisionada com sucesso no plano <strong>${plan}</strong> (Trial 15 Dias).
                Abaixo está sua chave de acesso única para conectar ao terminal.
              </p>
              
              <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; margin: 30px 0; text-align: center;">
                <p style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; font-weight: bold;">Sua Chave de Acesso</p>
                <p style="font-family: 'Courier New', monospace; font-size: 24px; color: #10b981; font-weight: bold; margin: 0; letter-spacing: 2px;">
                  ${accessKey}
                </p>
              </div>

              <p style="font-size: 14px; color: #64748b;">
                Por favor, mantenha esta chave segura. Ela é sua credencial principal para recuperação de conta e login rápido.
              </p>
              
              <div style="margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px; text-align: center;">
                 <a href="https://finanai.robnet.com.br" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Acessar Sistema</a>
              </div>
            </div>
            <div style="background-color: #0f172a; padding: 20px; text-align: center; font-size: 10px; color: #475569;">
              &copy; 2024 FinanAI OS. Todos os direitos reservados.<br/>
              Mensagem automática enviada via Secure SMTP Gateway (ConDigital).
            </div>
          </div>
        `;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent: %s", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
