import { BaseMessage } from "@langchain/core/messages";
import { StateGraphArgs } from "@langchain/langgraph";

export interface SupplierCandidate {
  id: string;
  name: string;
  country: string;
  specialty?: string;
  website?: string;
  phone?: string;
  email?: string;
  relevanceScore?: number;
  aiComment?: string; // Commentaire métier final
  businessComment?: string; // Commentaire métier intermédiaire
  technicalAudit?: any; // Audit technique brut pour supplier_evidence
  legalStatus?: string;
  activityStatus?: string;
  urlChecked?: boolean;
  detectedType?: string; // Fabricant, Distributeur
  status?: string; // Label descriptif (ex: "Site manquant", "Exploitable")
  qualificationLevel?: "identified" | "qualified" | "exploitable" | "rejected";
}

export interface SourcingState {
  requestId: string;
  product: string;
  description: string;
  quantity: string;
  isAllCountries: boolean;
  geoRegions: string[];
  geoCountries: string[];
  supplierTypePreference: string;
  certifications?: string;
  constraints?: string;
  messages: BaseMessage[];
  candidates: SupplierCandidate[];
  finalSuppliers: SupplierCandidate[];
  currentAgent: string; // Pour les logs de progression
}

export const sourcingAgentState: StateGraphArgs<SourcingState>["channels"] = {
  requestId: {
    value: (x: string, y: string) => y ?? x,
    default: () => "",
  },
  product: {
    value: (x: string, y: string) => y ?? x,
    default: () => "",
  },
  description: {
    value: (x: string, y: string) => y ?? x,
    default: () => "",
  },
  quantity: {
    value: (x: string, y: string) => y ?? x,
    default: () => "",
  },
  isAllCountries: {
    value: (x: boolean, y: boolean) => y ?? x,
    default: () => false,
  },
  geoRegions: {
    value: (x: string[], y: string[]) => y ?? x,
    default: () => [],
  },
  geoCountries: {
    value: (x: string[], y: string[]) => y ?? x,
    default: () => [],
  },
  supplierTypePreference: {
    value: (x: string, y: string) => y ?? x,
    default: () => "Fabricant",
  },
  certifications: {
    value: (x?: string, y?: string) => y ?? x,
  },
  constraints: {
    value: (x?: string, y?: string) => y ?? x,
  },
  messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },
  candidates: {
    value: (x: SupplierCandidate[], y: SupplierCandidate[]) => y ?? x,
    default: () => [],
  },
  finalSuppliers: {
    value: (x: SupplierCandidate[], y: SupplierCandidate[]) => y ?? x,
    default: () => [],
  },
  currentAgent: {
    value: (x: string, y: string) => y ?? x,
    default: () => "Orchestrator",
  },
};
