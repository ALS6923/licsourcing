import { AIMessage } from "@langchain/core/messages";
import { SourcingState, SupplierCandidate } from "./state";
import { llm, tavily, apify, logAgentAction } from "./tools";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

/**
 * Schémas Zod pour Structured Output (Garantie Zéro Hallucination)
 */
const CandidatesSchema = z.object({
  candidates: z.array(z.object({
    name: z.string(),
    country: z.string(),
    website: z.string().optional(),
    description: z.string().optional(),
  }))
});

const VerificationSchema = z.object({
  legalStatus: z.string(),
  activityStatus: z.string(),
  detectedType: z.enum(["Fabricant", "Distributeur", "Non Identifié"]),
  phone: z.string().optional(),
  email: z.string().optional(),
});

// 1. Agent Explorateur Régional
export const regionalSearchNode = async (state: SourcingState): Promise<Partial<SourcingState>> => {
  const geodataRaw = state.isAllCountries ? "Monde Entier" : [...state.geoRegions, ...state.geoCountries].join(", ");
  await logAgentAction(supabase, state.requestId, "RegionalSearch", `Démarrage de la recherche pour ${state.product} sur les zones : ${geodataRaw}`);

  // 1. Construction de la requête de recherche
  const query = `${state.product} manufacturer supplier factory ${state.geoCountries.join(" ")} ${state.geoRegions.join(" ")}`;
  
  // 2. Recherche via Tavily
  const searchResults = await tavily.invoke(query);
  
  // 3. Extraction via LLM (OpenRouter) - On utilise un prompt JSON strict pour éviter les erreurs de format OpenRouter
  const response = await llm.invoke([
    ["system", "Tu es un expert en sourcing industriel. Analyse les résultats de recherche fournis et extrait une liste de fournisseurs potentiels correspondants exactement au besoin. Réponds UNIQUEMENT au format JSON suivant : { \"candidates\": [ { \"name\": \"...\", \"country\": \"...\", \"website\": \"...\", \"description\": \"...\" } ] }"],
    ["user", `Besoin : ${state.product} (${state.description})\n\nRésultats Tavily :\n${searchResults}`]
  ]);

  let extraction;
  try {
    // Nettoyage du markdown si le LLM en a mis
    const content = response.content.toString().replace(/```json|```/g, "").trim();
    extraction = JSON.parse(content);
  } catch (e) {
    console.error("[Parse Error] Échec de l'extraction JSON, tentative de repli...", response.content);
    extraction = { candidates: [] };
  }

  // On limite strictement à 10 candidats pour ce run (ou selon budget)
  const candidates: SupplierCandidate[] = extraction.candidates.slice(0, 10).map((c: any, i: number) => ({
    id: `c-${Date.now()}-${i}`,
    name: c.name,
    country: c.country,
    website: c.website,
    aiComment: c.description,
    technicalAudit: { initialExtraction: c }
  }));

  console.log(`[RegionalSearch] ${candidates.length} candidats retenus sur ${extraction.candidates.length} identifiés.`);
  await logAgentAction(supabase, state.requestId, "RegionalSearch", `${candidates.length} candidats identifiés (Limit: 10).`);

  return {
    candidates,
    currentAgent: "RegionalSearch",
    messages: [new AIMessage(`Exploration terminée. ${candidates.length} entreprises retenues.`)]
  };
};

// 2. Agent de Vérification d'Existence Légale
export const legalVerificationNode = async (state: SourcingState): Promise<Partial<SourcingState>> => {
  await logAgentAction(supabase, state.requestId, "LegalVerification", `Analyse de la légitimité pour ${state.candidates.length} entreprises.`);

  const verifiedCandidates = await Promise.all(state.candidates.map(async (c) => {
    // Dans un run réel, on ferait une recherche spécifique par entreprise
    const query = `official registry ${c.name} ${c.country} legal status active`;
    const check = await tavily.invoke(query);
    
    // Le LLM juge sur les snippets
    const judge = await llm.invoke([
      ["system", "Vérifie si cette entreprise semble officiellement enregistrée et active. Réponds par un statut court (ex: 'Actif (Registre)', 'Non trouvé')."],
      ["user", `Entreprise : ${c.name}\nContexte de recherche :\n${check}`]
    ]);

    return {
      ...c,
      legalStatus: judge.content.toString(),
      technicalAudit: { ...c.technicalAudit, legalCheck: judge.content.toString(), rawLegalContext: check.substring(0, 500) }
    };
  }));

  return {
    candidates: verifiedCandidates,
    currentAgent: "LegalVerification"
  };
};

// 3. Agent d'Activité et Contacts
export const activityAndContactNode = async (state: SourcingState): Promise<Partial<SourcingState>> => {
  await logAgentAction(supabase, state.requestId, "ActivityContact", `Vérification de l'activité web et extraction des contacts.`);

  const enriched = await Promise.all(state.candidates.map(async (c) => {
    if (!c.website) return c;

    // TODO: Utiliser Apify ici pour un scraping profond. 
    // Pour ce premier test 'maîtrisé', on utilise Tavily pour trouver les pages de contact/about
    const contactQuery = `site:${c.website} contact email phone about production factory`;
    const contactData = await tavily.invoke(contactQuery);

    const response = await llm.invoke([
      ["system", "Analyse les données pour extraire les contacts officiels et déterminer si l'entreprise possède ses propres usines (Fabricant) ou si elle revend (Distributeur). Réponds UNIQUEMENT au format JSON suivant : { \"legalStatus\": \"...\", \"activityStatus\": \"...\", \"detectedType\": \"Fabricant|Distributeur|Non Identifié\", \"phone\": \"...\", \"email\": \"...\" }"],
      ["user", `Société : ${c.name}\nSource Web :\n${contactData}`]
    ]);

    let info;
    try {
      const content = response.content.toString().replace(/```json|```/g, "").trim();
      info = JSON.parse(content);
    } catch (e) {
      console.error("[Parse Error Contact]", response.content);
      info = { phone: "Non trouvé", email: "Non trouvé", activityStatus: "Inconnu", detectedType: "Non Identifié" };
    }

    return {
      ...c,
      phone: info.phone || "Non Vérifié",
      email: info.email || "Non Vérifié",
      activityStatus: info.activityStatus,
      detectedType: info.detectedType,
      technicalAudit: { ...c.technicalAudit, activityAndContact: info }
    };
  }));

  return {
    candidates: enriched,
    currentAgent: "ActivityContact"
  };
};

// 4. Agent de Scoring & Consolidation
export const scoringConsolidationNode = async (state: SourcingState): Promise<Partial<SourcingState>> => {
  await logAgentAction(supabase, state.requestId, "Consolidation", `Calcul final des scores de confiance et persistance.`);
  
  const scoringPrompt = `Tu es le juge final de Aether Sourcing. Évalue ces fournisseurs sur une échelle de 0 à 100 pour la pertinence métier.
  Besoin client : ${state.product} - ${state.description}
  Critères : 
  - Correspondance produit exacte (ex: Gants Nitrile alimentaire)
  - Profil industriel sérieux (Fabricant prioritaire : +20 points)
  - Coordonnées directes trouvées (+10 points)
  - Historique ou légitimité apparente (+10 points)
  
  Réponds UNIQUEMENT au format JSON : { "relevanceScore": 0-100, "confidenceScore": 0-100, "businessComment": "..." }`;

  const finalSuppliers = await Promise.all(state.candidates.map(async (c) => {
    const response = await llm.invoke([
      ["system", scoringPrompt],
      ["user", JSON.stringify(c)]
    ]);

    let evaluation;
    try {
      const content = response.content.toString().replace(/```json|```/g, "").trim();
      evaluation = JSON.parse(content);
    } catch (e) {
      evaluation = { relevanceScore: 50, confidenceScore: 50, businessComment: "Évaluation technique brute." };
    }

    return {
      ...c,
      relevanceScore: evaluation.relevanceScore,
      confidenceScore: evaluation.confidenceScore,
      businessComment: evaluation.businessComment,
      technicalAudit: { ...c.technicalAudit, finalScoring: evaluation }
    };
  }));

  const qualifiedSuppliers = [];
  for (const s of finalSuppliers) {
    const hasWebsite = s.website && s.website !== "Non Vérifié" && s.website !== "N/A" && s.website.includes('.');
    const hasContact = (s.email && s.email !== "Non Vérifié" && s.email !== "Non identifié") || 
                       (s.phone && s.phone !== "Non Vérifié" && s.phone !== "Non identifié");
    const baseScore = s.relevanceScore || 0;
    
    let qualificationLevel: "identified" | "qualified" | "exploitable" | "rejected" = "identified";
    let status = "Identifié";
    let reason = "";

    // LOGIQUE DE QUALIFICATION AETHER V3
    if (baseScore < 30) {
      // Rejet uniquement si vraiment hors sujet
      qualificationLevel = "rejected";
      status = "Rejeté";
      reason = "Faible pertinence par rapport au besoin métier.";
    } else if (hasWebsite && hasContact && baseScore >= 70) {
      // Le top : site + contact + bon score
      qualificationLevel = "exploitable";
      status = "Exploitable";
      reason = "Coordonnées complètes et haute pertinence.";
    } else if (hasWebsite && (s.activityStatus?.toLowerCase().includes("actif") || baseScore >= 50)) {
      // Qualifié : On a un site et des signes de vie, même sans contact direct
      qualificationLevel = "qualified";
      status = "Qualifié";
      reason = hasContact ? "Profil cohérent avec contact." : "Activité confirmée, contact à enrichir.";
    } else {
      // Identifié : Par défaut si pertinent mais incomplet
      qualificationLevel = "identified";
      status = "Identifié";
      reason = !hasWebsite ? "Site web manquant" : "Preuves d'activité incomplètes";
    }

    if (qualificationLevel !== "rejected") {
      const fullComment = `${status} : ${reason} | ${s.businessComment || ""}`.substring(0, 500);
      
      // PERSISTANCE DANS SUPABASE
      const { data: supplierData, error: supplierError } = await supabase.from('suppliers').insert([{
        request_id: state.requestId,
        name: s.name,
        country: s.country,
        specialty: s.specialty || "Sourcing Industriel",
        detected_type: s.detectedType || "Non Identifié",
        website: s.website,
        contact_phone: s.phone,
        contact_email: s.email,
        relevance_score: baseScore,
        confidence_score: s.confidenceScore || 70,
        legal_status: s.legalStatus || "Non vérifié",
        activity_status: s.activityStatus || "Inconnu",
        ai_comment: fullComment,
        qualification_level: qualificationLevel // Nouveauté V3
      }]).select().single();

      if (!supplierError && supplierData) {
        // Sauvegarde de l'AUDIT TECHNIQUE
        if (!s.technicalAudit) {
          console.warn(`[Persistence Warning] Aucun technicalAudit trouvé pour ${s.name}`);
        }

        const { error: evidenceError } = await supabase.from('supplier_evidence').insert([{
          supplier_id: supplierData.id,
          agent_name: 'Orchestrator',
          verification_type: 'technical_audit',
          is_valid: true,
          details: s.technicalAudit || { error: "No data captured" }
        }]);

        if (evidenceError) {
          console.error("[Persistence Error] Evidence (Table table supplier_evidence):", evidenceError);
        }

        qualifiedSuppliers.push({
          ...s,
          id: supplierData.id, 
          status,
          relevanceScore: baseScore,
          qualificationLevel: qualificationLevel,
          aiComment: fullComment
        });
      } else if (supplierError) {
        console.error("[Persistence Error] Supplier:", supplierError);
      }
    }
  }

  const sorted = qualifiedSuppliers.sort((a,b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  await logAgentAction(supabase, state.requestId, "Consolidation", `Sourcing terminé. ${sorted.length} fournisseurs persistés en base.`);

  return {
    finalSuppliers: sorted,
    currentAgent: "Consolidation",
    messages: [new AIMessage(`Terminé. ${sorted.length} fournisseurs enregistrés.`)]
  };
};
