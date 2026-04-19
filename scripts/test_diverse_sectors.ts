import * as dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runDiverseTests() {
  const { sourcingAgentGraph } = await import('../lib/agents/graph');
  const { supabase } = await import('../lib/supabase');

  const testCases = [
    {
      name: "Secteur PACKAGING",
      data: {
        product: "Biodegradable Coffee Capsules",
        description: "Capsules compatible Nespresso, compostable home, PLA-based, food contact certified.",
        quantity: "1,000,000 units / quarterly",
        geoRegions: ["Europe"],
        geoCountries: ["Italy", "Spain"],
        supplierTypePreference: "Fabricant"
      }
    },
    {
      name: "Secteur TEXTILE",
      data: {
        product: "Recycled Polyester Functional Shirts",
        description: "Sports t-shirts made from at least 80% recycled PET, GOTS or GRS certified.",
        quantity: "5,000 units / batch",
        geoRegions: ["Europe"],
        geoCountries: ["Portugal", "Turkey"],
        supplierTypePreference: "Fabricant"
      }
    },
    {
      name: "Secteur ELECTRONICS",
      data: {
        product: "Custom PCB Assembly (PCBA)",
        description: "IoT sensor boards, 4-layer, smt assembly, RoHS compliant, CE marking support.",
        quantity: "1,000 units / month",
        geoRegions: ["Europe"],
        geoCountries: ["Germany", "Poland"],
        supplierTypePreference: "Fabricant"
      }
    }
  ];

  console.log("=== DÉBUT DES TESTS MULTI-SECTEURS AETHER ===");

  for (const testCase of testCases) {
    console.log(`\n--- TEST : ${testCase.name} ---`);
    console.log(`Produit : ${testCase.data.product}`);
    
    try {
      // 1. Création de la requête parent
      const { data: request, error: reqError } = await supabase
        .from('requests')
        .insert([{
          product: testCase.data.product,
          description: testCase.data.description,
          quantity: testCase.data.quantity,
          geo_zones: { regions: testCase.data.geoRegions, countries: testCase.data.geoCountries },
          supplier_type_preference: testCase.data.supplierTypePreference,
          status: 'testing_diverse'
        }])
        .select()
        .single();

      if (reqError) throw reqError;
      console.log(`Requête créée (ID: ${request.id})`);

      // 2. Lancement du graph
      const initialState = {
        requestId: request.id,
        ...testCase.data,
        messages: [],
        candidates: [],
        finalSuppliers: [],
        currentAgent: "Orchestrator"
      };

      console.log("Exécution du pipeline (max 2 min)...");
      const finalState = await sourcingAgentGraph.invoke(initialState as any);

      const exploitable = finalState.finalSuppliers.filter((s: any) => s.status === "Exploitable");
      const toVerify = finalState.finalSuppliers.filter((s: any) => s.status === "À vérifier manuellement");

      console.log(`RÉSULTATS ${testCase.name} :`);
      console.log(`- Exploitable : ${exploitable.length}`);
      console.log(`- À vérifier : ${toVerify.length}`);
      console.log(`Lien Résumé : /dashboard?requestId=${request.id}`);

    } catch (err) {
      console.error(`Échec du test ${testCase.name}:`, err);
    }
  }

  console.log("\n=== TOUS LES TESTS SONT TERMINÉS ===");
}

runDiverseTests().catch(console.error);
