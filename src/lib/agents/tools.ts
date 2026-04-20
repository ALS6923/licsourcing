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

// Outil de recherche Tavily
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

// Outil de recherche Perplexity via OpenRouter
export const perplexity = {
  invoke: async (query: string) => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Clé API OpenRouter manquante.");
    }
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://aether-sourcing.io",
        "X-Title": "Aether Sourcing SaaS",
      },
      body: JSON.stringify({
        model: "perplexity/sonar", // Utilise Sonar via OpenRouter
        messages: [
          { role: "system", content: "Tu es un expert en sourcing industriel. Ta mission est d'identifier des fournisseurs réels et actifs. Pour chaque fournisseur, fournis : Nom, Site Web (essentiel), Pays, et une brève description de leur activité. Cite tes sources." },
          { role: "user", content: query }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erreur OpenRouter/Perplexity: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
};

/**
 * Wrapper unifié pour le moteur de recherche
 * Permet un basculement simple via variable d'environnement
 */
export const searchEngine = {
  invoke: async (query: string, options: { depth?: "basic" | "advanced" } = {}) => {
    const provider = process.env.SEARCH_PROVIDER || "tavily";
    const depth = options.depth || "advanced";
    
    console.log(`[SearchEngine] Utilisation du moteur: ${provider} (Mode: ${depth})`);
    
    if (provider === "perplexity") {
      return await perplexity.invoke(query);
    }
    
    // Cas Tavily avec gestion de la profondeur
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: depth,
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
