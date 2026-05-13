import { GoogleGenerativeAI } from "@google/generative-ai";
import { CRMLead, CRMActivity, CRMContact } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const aiCRMService = {
  /**
   * Generates a lead score and strategic insights using Gemini
   */
  async analyzeLead(lead: CRMLead, activities: CRMActivity[], contact?: CRMContact) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
        Analise o seguinte Lead de CRM e forneça um Score (0-100) e um Insight estratégico curto.
        
        NEGÓCIO: ${lead.title}
        VALOR: R$ ${lead.value}
        ESTÁGIO ATUAL: ${lead.status}
        CONTATO: ${contact?.name || 'N/A'} - ${contact?.position || 'N/A'}
        
        ÚLTIMAS ATIVIDADES:
        ${activities.map(a => `- [${a.type}] ${a.content}`).join('\n')}
        
        Responda APENAS em formato JSON:
        {
          "score": number, 
          "insight": "string (máx 150 caracteres)",
          "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
          "next_best_action": "string"
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      if (!text || text === "undefined") {
        throw new Error("AI returned empty or invalid response");
      }
      
      // Cleanup cleanup (sometimes AI adds markdown blocks)
      const cleanJson = text.replace(/```json|```/g, "").trim();
      
      if (!cleanJson || cleanJson === "undefined") {
        throw new Error("AI returned invalid JSON content");
      }

      try {
        const parsed = JSON.parse(cleanJson);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error("Parsed AI JSON is null or not an object");
        }
        return parsed;
      } catch (parseError) {
        console.error("Failed to parse AI JSON:", cleanJson);
        throw parseError;
      }
    } catch (error) {
      console.error("AI Analysis Error:", error);
      return {
        score: lead.score || 50,
        insight: "Análise indisponível no momento. Continue o follow-up padrão.",
        sentiment: "NEUTRAL",
        next_best_action: "Realizar uma chamada de acompanhamento."
      };
    }
  }
};
