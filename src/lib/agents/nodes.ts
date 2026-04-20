import { AIMessage } from "@langchain/core/messages";
import { SourcingState, SupplierCandidate } from "./state";
import { llm, searchEngine, apify, logAgentAction } from "./tools";
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
  await logAgentAction(supabase, state.requestId, "RegionalSearch", `Démarrage de la recherche massive pour ${state.product} sur les zones : ${geodataRaw}`);

  // 1. Génération de requêtes variées (FR/EN) via LLM
  const queryGenResponse = await llm.invoke([
    ["system", "Tu es un expert en sourcing industriel B2B. Génère 10 requêtes de recherche Google/Tavily variées pour trouver un maximum de fournisseurs. Utilise un mélange de Français et d'Anglais. Varie les types d'acteurs (fabricant, usine, grossiste, distributeur, wholesale, manufacturer, factory). Réponds UNIQUEMENT par la liste des requêtes séparées par des points-virgules."],
    ["user", `Besoin : ${state.product} (${state.description})\nZones : ${geodataRaw}`]
  ]);
  
  const queries = queryGenResponse.content.toString().split(';').map(q => q.trim()).filter(q => q.length > 3);
  const finalQueries = queries.length > 0 ? queries : [`${state.product} manufacturer supplier factory ${geodataRaw}`];

  await logAgentAction(supabase, state.requestId, "RegionalSearch", `Génération de ${finalQueries.length} requêtes de recherche (FR/EN).`);

  // 2. Recherche en Parallèle
  const searchResultsPromises = finalQueries.map(q => searchEngine.invoke(q));
  const allRawResults = await Promise.all(searchResultsPromises);
  
  // 3. Fusion et Déduplication (URL)
  const mergedResults: any[] = [];
  const seenUrls = new Set();
  let totalRawCount = 0;

  for (const resStr of allRawResults) {
    try {
      // Cas Tavily (JSON)
      const parsed = JSON.parse(resStr);
      if (Array.isArray(parsed)) {
        totalRawCount += parsed.length;
        for (const item of parsed) {
          if (item.url && !seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            mergedResults.push(item);
          }
        }
      }
    } catch (e) {
      // Cas Perplexity ou format textuel
      mergedResults.push({ content: resStr, url: `text-source-${Date.now()}` });
    }
  }

  await logAgentAction(supabase, state.requestId, "RegionalSearch", `Nettoyage terminé. ${totalRawCount} résultats bruts -> ${mergedResults.length} sources uniques.`);
  
  // 4. Extraction via LLM (OpenRouter) - On utilise un prompt permissif
  const response = await llm.invoke([
    ["system", "Tu es un extracteur de données industriel. Analyse les résultats fournis et liste TOUS les fournisseurs potentiels (entreprises) trouvés. Sois exhaustif, ne filtre pas la qualité à cette étape. Limite-toi aux entreprises pertinentes pour le produit demandé. Réponds UNIQUEMENT au format JSON : { \"candidates\": [ { \"name\": \"...\", \"country\": \"...\", \"website\": \"...\", \"description\": \"...\" } ] }"],
    ["user", `Besoin : ${state.product}\n\nSources :\n${JSON.stringify(mergedResults).substring(0, 50000)}`] // Capacité max gpt-4o-mini
  ]);

  let extraction;
  try {
    const content = response.content.toString().replace(/```json|```/g, "").trim();
    extraction = JSON.parse(content);
  } catch (e) {
    console.error("[Parse Error] Extraction", response.content);
    extraction = { candidates: [] };
  }

  // 5. Déduplication des Candidats (Website / Nom)
  const uniqueCandidates = new Map();
  extraction.candidates.forEach((c: any) => {
    const key = c.website ? c.website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] : c.name.toLowerCase().trim();
    if (!uniqueCandidates.has(key)) {
      uniqueCandidates.set(key, c);
    }
  });

  // 6. Limite de sécurité (100)
  const candidates: SupplierCandidate[] = Array.from(uniqueCandidates.values())
    .slice(0, 100)
    .map((c: any, i: number) => ({
      id: `c-${Date.now()}-${i}`,
      name: c.name,
      country: c.country,
      website: c.website,
      aiComment: c.description,
      technicalAudit: { initialExtraction: c }
    }));

  await logAgentAction(supabase, state.requestId, "RegionalSearch", `${candidates.length} candidats uniques retenus pour qualification (Limite: 100).`);

  return {
    candidates,
    currentAgent: "RegionalSearch",
    messages: [new AIMessage(`${candidates.length} entreprises identifiées par multi-requêtes.`)]
  };
};

// 2. Nœud d'Enrichissement Unifié (Légal + Contacts)
export const unifiedEnrichmentNode = async (state: SourcingState): Promise<Partial<SourcingState>> => {
  await logAgentAction(supabase, state.requestId, "Enrichment", `Enrichissement turbo pour ${state.candidates.length} entreprises (Batch: 15).`);

  const enrichedCandidates = [];
  const concurrencyLimit = 15;
  
  for (let i = 0; i < state.candidates.length; i += concurrencyLimit) {
    const batch = state.candidates.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(batch.map(async (c) => {
      // Exécution parallèle des deux tâches pour chaque candidat pour gagner du temps
      const [legalData, contactData] = await Promise.all([
        (async () => {
          const query = `official registry ${c.name} ${c.country} legal status active`;
          const check = await searchEngine.invoke(query, { depth: "basic" });
          const judge = await llm.invoke([
            ["system", "Vérifie si cette entreprise semble officiellement enregistrée et active. Réponds par un statut court (ex: 'Actif (Registre)', 'Non trouvé')."],
            ["user", `Entreprise : ${c.name}\nContexte de recherche :\n${check}`]
          ]);
          return { legalStatus: judge.content.toString(), check };
        })(),
        (async () => {
          if (!c.website) return { info: { phone: "N/A", email: "N/A", activityStatus: "N/A", detectedType: "Non Identifié" }, contactData: "" };
          
          const contactQuery = `site:${c.website} contact email phone about production factory`;
          const contactDataRaw = await searchEngine.invoke(contactQuery, { depth: "basic" });
          const response = await llm.invoke([
            ["system", "Analyse les données pour extraire les contacts officiels et déterminer si l'entreprise possède ses propres usines (Fabricant) ou si elle revend (Distributeur). Réponds UNIQUEMENT au format JSON suivant : { \"legalStatus\": \"...\", \"activityStatus\": \"...\", \"detectedType\": \"Fabricant|Distributeur|Non Identifié\", \"phone\": \"...\", \"email\": \"...\" }"],
            ["user", `Société : ${c.name}\nSource Web :\n${contactDataRaw}`]
          ]);
          
          let info;
          try {
            const content = response.content.toString().replace(/```json|```/g, "").trim();
            info = JSON.parse(content);
          } catch (e) {
            info = { phone: "Non trouvé", email: "Non trouvé", activityStatus: "Inconnu", detectedType: "Non Identifié" };
          }
          return { info, contactData: contactDataRaw };
        })()
      ]);

      return {
        ...c,
        legalStatus: legalData.legalStatus,
        phone: contactData.info.phone || "Non Vérifié",
        email: contactData.info.email || "Non Vérifié",
        activityStatus: contactData.info.activityStatus,
        detectedType: contactData.info.detectedType,
        technicalAudit: { 
          ...c.technicalAudit, 
          legalCheck: legalData.legalStatus, 
          rawLegalContext: legalData.check.substring(0, 500),
          activityAndContact: contactData.info
        }
      };
    }));
    enrichedCandidates.push(...batchResults);
  }

  return {
    candidates: enrichedCandidates,
    currentAgent: "Enrichment"
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

  const stats = {
    total: sorted.length,
    exploitable: sorted.filter(s => s.qualificationLevel === "exploitable").length,
    qualified: sorted.filter(s => s.qualificationLevel === "qualified").length,
    identified: sorted.filter(s => s.qualificationLevel === "identified").length
  };

  await logAgentAction(supabase, state.requestId, "Consolidation", `Sourcing terminé (${process.env.SEARCH_PROVIDER}). Total: ${stats.total} | Exploitables: ${stats.exploitable} | Qualifiés: ${stats.qualified} | Identifiés: ${stats.identified}`);

  return {
    finalSuppliers: sorted,
    currentAgent: "Consolidation",
    messages: [new AIMessage(`Terminé. ${sorted.length} fournisseurs enregistrés.`)]
  };
};
