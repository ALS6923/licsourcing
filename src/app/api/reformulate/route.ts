import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Dans une version de production, nous ferions appel à un LLM instancié avec `zod`
    // pour extraire le summary et les warnings structurés.
    // Exemple : const response = await llm.withStructuredOutput(ReformulationSchema).invoke(prompt);

    // MOCK DE REFORMULATION POUR LE MVP
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simuler délai IA

    const warnings: string[] = [];
    
    // Logique heuristique basique pour démontrer le Point de Vigilance
    if (data.quantity && data.quantity.toLowerCase().includes("petite")) {
      warnings.push("La quantité demandée semble trop faible pour intéresser un Fabricant direct. Les distributeurs pourraient être plus pertinents.");
    }
    if (data.isAllCountries && data.constraints?.toLowerCase().includes("urgent")) {
      warnings.push("Une recherche mondiale avec une contrainte de temps 'urgente' peut remonter des fournisseurs éloignés avec des délais de livraison incompatibles.");
    }
    
    const geodataRaw = data.isAllCountries ? "Monde Entier" : [...data.geoRegions, ...data.geoCountries].join(", ");

    const markdownSummary = `
**Produit cible :** ${data.product}
**Usage / Description :** ${data.description}
**Quantité estimée :** ${data.quantity}
**Zone(s) ciblée(s) :** ${geodataRaw}
**Type de fournisseur ciblé :** ${data.supplierTypePreference}
**Contraintes :** ${data.certifications ? data.certifications + ", " : ""} ${data.constraints || "Aucune"}
    `.trim();

    return NextResponse.json({
      success: true,
      data: {
        summary: markdownSummary,
        warnings: warnings,
      }
    });

  } catch (error) {
    console.error("API Reformulate Error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la reformulation." },
      { status: 500 }
    );
  }
}
