import './env';
import { sourcingAgentGraph } from '../src/lib/agents/graph';
import { supabase } from '../src/lib/supabase';

/**
 * Script de BENCHMARK : Tavily vs Perplexity
 * Produit : Gants Nitrile
 */
async function runBenchmark() {
  const queryData = {
    product: "gants nitrile",
    description: "Usage: restauration / contact alimentaire. Typologie: fabricant prioritaire. Contraintes: contact vérifié, activité actuelle.",
    quantity: "10000",
    isAllCountries: false,
    geoRegions: [],
    geoCountries: ["France"],
    supplierTypePreference: "Fabricant"
  };

  async function startRun(provider: string) {
    console.log(`\n=========================================`);
    console.log(`>>> DÉMARRAGE RUN : ${provider.toUpperCase()} <<<`);
    console.log(`=========================================\n`);
    
    // Forcer le provider
    process.env.SEARCH_PROVIDER = provider;
    
    // 1. Insertion de la requête en base pour avoir un UUID valide
    const { data: dbData, error } = await supabase
      .from('requests')
      .insert([{
        product: `[BENCHMARK ${provider}] Gants Nitrile`,
        description: queryData.description,
        quantity: queryData.quantity,
        geo_zones: { regions: [], countries: ["France"] },
        supplier_type_preference: queryData.supplierTypePreference,
        status: 'pending_agents'
      }])
      .select()
      .single();

    if (error || !dbData) {
      console.error("Erreur création requête Supabase:", error);
      return null;
    }

    const requestId = dbData.id;
    console.log(`[ID Requête] ${requestId}`);

    const initialState = {
      requestId,
      ...queryData,
      messages: [],
      candidates: [],
      finalSuppliers: []
    };

    try {
      // Exécution du graphe LangGraph
      await sourcingAgentGraph.invoke(initialState as any);
      
      // Marquage comme complété
      await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId);
      
      console.log(`\n[SUCCESS] Run ${provider} terminé.`);
      return requestId;
    } catch (e) {
      console.error(`\n[ERROR] Échec du run ${provider}:`, e);
      await supabase.from('requests').update({ status: 'failed' }).eq('id', requestId);
      return requestId;
    }
  }

  // Lancement séquentiel pour éviter les conflits d'env vars (même si process.env est global)
  const idPerplexity = await startRun("perplexity");
  const idTavily = await startRun("tavily");

  console.log(`\n=========================================`);
  console.log(`BENCHMARK TERMINÉ`);
  console.log(`-----------------------------------------`);
  console.log(`ID Run Perplexity : ${idPerplexity}`);
  console.log(`ID Run Tavily     : ${idTavily}`);
  console.log(`=========================================\n`);
  
  process.exit(0);
}

runBenchmark().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
