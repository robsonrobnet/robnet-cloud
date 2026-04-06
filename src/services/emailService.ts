
import { supabase } from '../lib/supabase';

export const EmailService = {
  /**
   * Invoca a Edge Function 'send-email' para enviar a chave de acesso.
   */
  async sendWelcomeEmail(email: string, name: string, accessKey: string, plan: string) {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { 
          email, 
          name, 
          accessKey, 
          plan 
        }
      });

      if (error) {
        console.error("Supabase Function Error:", error);
        // Não lançamos erro aqui para não bloquear o fluxo de UI se o email falhar
        return { success: false, error };
      }

      return { success: true, data };
    } catch (e) {
      console.error("Email Service Exception:", e);
      return { success: false, error: e };
    }
  },

  /**
   * Envia notificação de recuperação de senha.
   */
  async sendPasswordRecoveryEmail(email: string, name: string, password: string) {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { 
          type: 'PASSWORD_RECOVERY',
          email, 
          name, 
          content: password // Passando a senha como content
        }
      });

      if (error) return { success: false, error };
      return { success: true, data };
    } catch (e) {
      console.error("Email Service Exception:", e);
      return { success: false, error: e };
    }
  }
};
