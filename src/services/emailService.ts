

export const EmailService = {
  /**
   * Envia e-mail via API local (SMTP).
   */
  async sendEmail(email: string, subject: string, html: string) {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, html })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar e-mail');
      }

      return { success: true };
    } catch (e) {
      console.error("Email Service Exception:", e);
      return { success: false, error: e };
    }
  },

  /**
   * Envia e-mail de boas-vindas.
   */
  async sendWelcomeEmail(email: string, name: string, accessKey: string, plan: string) {
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Bem-vindo ao FinanAI OS!</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Sua conta foi criada com sucesso no plano <strong>${plan}</strong>.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Sua Chave de Acesso Única:</p>
          <p style="margin: 10px 0 0; font-size: 24px; font-weight: 900; color: #10b981; font-family: monospace;">${accessKey}</p>
        </div>
        <p style="font-size: 14px; color: #666;">Use esta chave para acessar o terminal de forma segura. Guarde-a com cuidado.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 11px; color: #999; text-align: center;">&copy; 2026 FinanAI OS - Gestão Inteligente</p>
      </div>
    `;
    return this.sendEmail(email, "Bem-vindo ao FinanAI OS", html);
  },

  /**
   * Envia e-mail de recuperação de senha.
   */
  async sendPasswordRecoveryEmail(email: string, name: string, password: string) {
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Recuperação de Acesso</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Você solicitou a recuperação de seus dados de acesso ao FinanAI OS.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Sua Senha Atual:</p>
          <p style="margin: 10px 0 0; font-size: 24px; font-weight: 900; color: #4f46e5; font-family: monospace;">${password}</p>
        </div>
        <p style="font-size: 14px; color: #666;">Recomendamos alterar sua senha após o login para garantir a segurança da sua conta.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 11px; color: #999; text-align: center;">&copy; 2026 FinanAI OS - Gestão Inteligente</p>
      </div>
    `;
    return this.sendEmail(email, "Recuperação de Senha - FinanAI OS", html);
  }
};
