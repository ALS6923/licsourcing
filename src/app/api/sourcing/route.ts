import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { sourcingAgentGraph } from "@/lib/agents/graph";
import { SourcingState } from "@/lib/agents/state";

export const maxDuration = 60; // Autorise une exécution longue (Vercel Pro)

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    const { product, description, quantity, isAllCountries, geoRegions, geoCountries, supplierTypePreference, certifications, constraints } = data;

    if (!product || !description || !quantity || (!isAllCountries && geoRegions.length === 0 && geoCountries.length === 0)) {
      return NextResponse.json(
        { error: "Données de formulaire incomplètes." },
        { status: 400 }
      );
    }

    // 1. Enregistrement de la requête initiale dans Supabase
    const { data: dbData, error: reqError } = await supabase
      .from('requests')
      .insert([{
        product,
        description,
        quantity,
        geo_zones: { 
          regions: isAllCountries ? ["Global"] : geoRegions, 
          countries: geoCountries 
        },
        supplier_type_preference: supplierTypePreference || "Fabricant",
        certifications,
        constraints,
        status: 'pending_agents'
      }])
      .select()
      .single();
        
    if (reqError || !dbData) {
      console.error("Erreur création requête Supabase:", reqError);
      return NextResponse.json({ error: "Erreur lors de la création de la requête." }, { status: 500 });
    }

    const requestId = dbData.id;

    // 2. Préparation du state initial pour LangGraph
    const initialState: Partial<SourcingState> = {
      requestId,
      product,
      description,
      quantity,
      isAllCountries,
      geoRegions,
      geoCountries,
      supplierTypePreference: supplierTypePreference || "Fabricant",
      certifications,
      constraints,
      messages: [],
      candidates: [],
      finalSuppliers: []
    };

    // 3. Lancement en arrière-plan robuste via 'after'
    // Permet de répondre au client immédiatement sans couper le process Vercel
    after(async () => {
      try {
        await sourcingAgentGraph.invoke(initialState);
        await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId);
      } catch (err) {
        console.error("Graph Error (Background):", err);
        await supabase.from('requests').update({ status: 'failed' }).eq('id', requestId);
      }
    });

    return NextResponse.json({
      success: true,
      requestId
    });

  } catch (error) {
    console.error("API Sourcing Error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors du lancement du workflow." },
      { status: 500 }
    );
  }
}
