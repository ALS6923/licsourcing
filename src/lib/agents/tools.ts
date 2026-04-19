import { ChatOpenAI } from "@langchain/openai";
import { ApifyClient } from "apify-client";

/**
 * Initialisation OpenRouter
 * Modèle : openai/gpt-4o-mini
 */
export const llm = new ChatOpenAI({
  modelName: "openai/gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://aether-sourcing.io", // Facultatif, recommandé par OpenRouter
      "X-Title": "Aether Sourcing SaaS",
    },
  },
});

// Outil de recherche Tavily (Implémentation directe pour éviter les conflits de version)
export const tavily = {
  invoke: async (query: string) => {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: 15,
      }),
    });
    const data = await response.json();
    return JSON.stringify(data.results);
  }
};

// Client Apify pour le scraping profond (Optionnel pour ce run)
export const apify = process.env.APIFY_API_TOKEN 
  ? new ApifyClient({ token: process.env.APIFY_API_TOKEN })
  : null;

/**
 * Fonction utilitaire pour enregistrer un log d'agent dans Supabase
 */
export async function logAgentAction(supabase: any, requestId: string, agentName: string, message: string, level: string = "info") {
  try {
    const { error } = await supabase.from("agent_logs").insert([{
      request_id: requestId,
      agent_name: agentName,
      message,
      level
    }]);
    if (error) throw error;
  } catch (e) {
    console.error(`[Log Error] ${agentName}: ${message}`, e);
  }
}
