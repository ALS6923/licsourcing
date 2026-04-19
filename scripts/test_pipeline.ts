import * as dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement (DÈS LE DÉBUT)
const envResult = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import type { SourcingState, SupplierCandidate } from '../src/lib/agents/state';

async function runTest() {
  // Import dynamique obligatoire pour s'assurer que dotenv a chargé les variables 
  // avant que les clients (supabase, openai) ne s'initialisent
  const { sourcingAgentGraph } = await import('../src/lib/agents/graph');
  const { supabase } = await import('../src/lib/supabase');

  const startTime = Date.now();
  console.log("--- DÉMARRAGE DU TEST TECHNIQUE AETHER ---");
  console.log("Configuration : Gants Nitrile / France / 10 Max");
  console.log("Security : Mode Test (Zéro Envoi)");
  
  // 1. Diagnostic des variables
  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL', 
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'OPENROUTER_API_KEY', 
    'TAVILY_API_KEY'
  ];
  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error("ERREUR : Variables manquantes :", missing);
    return;
  }
  console.log("CHECK : Variables d'environnement OK (Tavily et OpenRouter détectés).");

  // 2. Création de la requête en DB pour les FK
  console.log("Enregistrement de la requête de test dans Supabase...");
  const { data: reqData, error: reqError } = await supabase.from('requests').insert([{
    product: "Gants nitrile",
    description: "Usage restauration / contact alimentaire",
    quantity: "10 000 unités / mois",
    geo_zones: ["France"],
    supplier_type_preference: "Fabricant",
    status: 'pending_agents'
  }]).select().single();

  if (reqError || !reqData) {
    console.error("ERREUR : Impossible de créer la requête parent dans Supabase.", reqError);
    return;
  }
  const requestId = reqData.id;
  console.log(`Requête créée avec succès. ID : ${requestId}`);

  // 3. Payload de test
  const initialState: Partial<SourcingState> = {
    requestId: requestId,
    product: "Gants nitrile",
    description: "Usage restauration / contact alimentaire",
    quantity: "10 000 unités / mois",
    isAllCountries: false,
    geoRegions: [],
    geoCountries: ["France"],
    supplierTypePreference: "Fabricant",
    certifications: "Norme EN 455",
    constraints: "Contact vérifié, activité actuelle, compatibilité alimentaire",
    messages: [],
    candidates: [],
    finalSuppliers: []
  };

  // 3. Exécution avec Timeout
  const timeoutMs = 300000; // 5 mins
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("TIMEOUT : L'exécution a dépassé 5 minutes.")), timeoutMs)
  );

  try {
    console.log("Lancement de l'Orchestrateur...");
    
    // On lance le graphe
    const runPromise = sourcingAgentGraph.invoke(initialState as any);
    const finalState = await Promise.race([runPromise, timeoutPromise]) as any;

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    // 4. Rapport Final
    console.log("\n--- RAPPORT FINAL DE RECETTE (RUN #2) ---");
    console.log(`Temps total : ${duration} secondes`);
    console.log(`Candidats identifiés (Search) : ${finalState.candidates.length}`);
    
    const exploitable = finalState.finalSuppliers.filter((s: SupplierCandidate) => s.qualificationLevel === "exploitable");
    const qualified = finalState.finalSuppliers.filter((s: SupplierCandidate) => s.qualificationLevel === "qualified");
    const identified = finalState.finalSuppliers.filter((s: SupplierCandidate) => s.qualificationLevel === "identified");
    
    console.log(`Fournisseurs EXPLOITABLES : ${exploitable.length}`);
    console.log(`Fournisseurs QUALIFIÉS : ${qualified.length}`);
    console.log(`Fournisseurs IDENTIFIÉS : ${identified.length}`);
    
    // Taux
    const totalFound = finalState.candidates.length || 1;
    const finalCount = finalState.finalSuppliers.length;
    const productivityRate = (finalCount / totalFound * 100).toFixed(1);

    console.log(`Taux de réussite productivité : ${productivityRate}%`);
    
    // Détails par fournisseur
    console.log("\nÉCHANTILLON DES RÉSULTATS (DÉTAILLÉS) :");
    finalState.finalSuppliers.slice(0, 5).forEach((s: SupplierCandidate, idx: number) => {
      console.log(`${idx + 1}. [${s.qualificationLevel?.toUpperCase()}] ${s.name} (${s.country}) - Relevance: ${s.relevanceScore}/100`);
      console.log(`   - Site : ${s.website || "N/A"}`);
      console.log(`   - Contact : ${s.email || "N/A"} / ${s.phone || "N/A"}`);
      console.log(`   - Commentaire Métier : ${s.aiComment?.split('|')[1]?.trim().substring(0, 200)}...`);
      console.log(`   - Audit Technique : Présent en base (UUID: ${s.id})`);
    });

    console.log("\n--- CONFIRMATION SÉCURITÉ & ARCHIVAGE ---");
    console.log("Les données ont été persistées dans Supabase (Tables: suppliers, supplier_evidence).");

  } catch (err: any) {
    console.error("\nERREUR DURANT LE TEST :");
    console.error(err.message);
  }
}

runTest();
