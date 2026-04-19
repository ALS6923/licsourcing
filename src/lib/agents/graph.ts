import { StateGraph, START, END } from "@langchain/langgraph";
import { SourcingState, sourcingAgentState } from "./state";
import { 
  regionalSearchNode, 
  legalVerificationNode, 
  activityAndContactNode, 
  scoringConsolidationNode 
} from "./nodes";

// 1. Initialiser le Graphe avec le State défini
const builder = new StateGraph<SourcingState>({ channels: sourcingAgentState });

// 2. Ajouter les Nœuds (Agents)
builder.addNode("RegionalSearch", regionalSearchNode);
builder.addNode("LegalVerification", legalVerificationNode);
builder.addNode("ActivityContact", activityAndContactNode);
builder.addNode("Consolidation", scoringConsolidationNode);

// 3. Définir le flux (Flow)
builder.addEdge(START, "RegionalSearch" as any);
builder.addEdge("RegionalSearch" as any, "LegalVerification" as any);
builder.addEdge("LegalVerification" as any, "ActivityContact" as any);
builder.addEdge("ActivityContact" as any, "Consolidation" as any);
builder.addEdge("Consolidation" as any, END);

// Point d'entrée compilé (Runnable)
export const sourcingAgentGraph = builder.compile();
