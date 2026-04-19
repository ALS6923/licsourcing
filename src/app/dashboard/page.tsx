"use client";

import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { MessageSquare, Copy, X, Bot, CheckCircle2, Factory, ShieldAlert, ShieldCheck, Mail, Phone, ExternalLink, Download, Loader2, AlertCircle, Terminal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Types
interface Supplier {
  id: string;
  name: string;
  country: string;
  specialty: string;
  website: string;
  contact_phone: string;
  contact_email: string;
  relevance_score: number;
  confidence_score: number;
  legal_status: string;
  activity_status: string;
  ai_comment: string;
}

interface AgentLog {
  id: string;
  agent_name: string;
  message: string;
  level: string;
  created_at: string;
}

interface Evidence {
  id: string;
  supplier_id: string;
  agent_name: string;
  verification_type: string;
  details: any;
}

const mockAgentsLogs = [
  { time: "00:01", msg: "Agent Orchestrateur : Requête reçue, lancement des agents régionaux...", region: "Global" },
  { time: "00:05", msg: "Agent Europe : Recherche de fabricants de moteurs électriques...", region: "Europe" },
  { time: "00:08", msg: "Agent Asie : Analyse des bases de données export (Chine, Vietnam)...", region: "Asie" },
  { time: "00:15", msg: "Agent Europe : 45 candidats potentiels trouvés. Filtrage initial...", region: "Europe" },
  { time: "00:22", msg: "Agent Vérification Légale : Analyse des registres pour 12 entreprises européennes...", region: "Légal" },
  { time: "00:25", msg: "Agent Asie : 32 candidats potentiels trouvés. Filtrage initial...", region: "Asie" },
  { time: "00:30", msg: "Agent Contact : Extraction et vérification des coordonnées officielles...", region: "Contact" },
  { time: "00:35", msg: "Agent Scoring : Évaluation des preuves et calculs de fiabilité.", region: "Scoring" },
  { time: "00:40", msg: "Agent Consolidation : Sélection finale des 5 meilleurs fournisseurs.", region: "Consolidation" },
];

const mockSuppliers = [
  {
    id: 1,
    name: "ElektroMotoren GmbH",
    country: "Allemagne",
    specialty: "Moteurs triphasés haute efficacité IE4",
    website: "elektromotoren-gmbh.example.de",
    phone: "+49 30 1234567",
    email: "b2b@elektromotoren-gmbh.example.de",
    legalStatus: "Vérifié (Registre DE)",
    activityStatus: "Site actif (Mise à jour J-2)",
    score: 96,
    aiComment: "Excellente correspondance produit. Le statut légal est pleinement confirmé sur le registre. Le numéro de téléphone mène directement au standard B2B.",
    match: 98,
  },
  {
    id: 2,
    name: "Hangzhou Power Drive Co., Ltd",
    country: "Chine",
    specialty: "Fabrication de moteurs industriels OEM",
    website: "hzpowerdrive.example.cn",
    phone: "+86 571 8888 8888",
    email: "export@hzpowerdrive.example.cn",
    legalStatus: "Vérifié (Business License CN)",
    activityStatus: "Signal d'export récent (J-15)",
    score: 89,
    aiComment: "Fabricant réel avec une licence d'export valide vérifiée. Email officiel obtenu. Attention aux délais de livraison pour les prototypes (habituellement 4-6 semaines).",
    match: 92,
  },
  {
    id: 3,
    name: "Izmir Motor Sanayi A.Ş.",
    country: "Turquie",
    specialty: "Moteurs asynchrones industriels",
    website: "izmirmotor.example.tr",
    phone: "Non Vérifié",
    email: "contact@izmirmotor.example.tr",
    legalStatus: "Vérifié (Chambre de commerce TQ)",
    activityStatus: "Activité détectée",
    score: 76,
    aiComment: "Le produit correspond mais le téléphone principal n'a pas pu être recoupé par plusieurs sources. L'entreprise est bien enregistrée et active. Contact email privilégié.",
    match: 85,
  }
];

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [requestInfo, setRequestInfo] = useState<any>(null);
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceTab, setEvidenceTab] = useState<'narrative' | 'technical'>('narrative');
  
  const [messageModalSupplier, setMessageModalSupplier] = useState<Supplier | null>(null);
  const [messageLang, setMessageLang] = useState<'fr' | 'en'>('fr');
  const [copied, setCopied] = useState(false);

  // Fetch Request Info
  useEffect(() => {
    if (!requestId) return;
    
    const fetchRequest = async () => {
      const { data } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle();
      if (data) setRequestInfo(data);
    };
    
    fetchRequest();
  }, [requestId]);

  // Poll for logs and suppliers
  useEffect(() => {
    if (!requestId) return;

    const fetchData = async () => {
      // Fetch Logs
      const { data: logData } = await supabase
        .from('agent_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });
      
      if (logData) setLogs(logData);

      // Fetch Suppliers
      const { data: supData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('request_id', requestId)
        .order('relevance_score', { ascending: false });
      
      if (supData && supData.length > 0) {
        setSuppliers(supData);
        setIsProcessing(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [requestId]);

  // Fetch Evidence when a supplier is selected
  useEffect(() => {
    if (!selectedSupplier) return;
    
    const fetchEvidence = async () => {
      const { data } = await supabase
        .from('supplier_evidence')
        .select('*')
        .eq('supplier_id', selectedSupplier.id);
      
      if (data) setEvidence(data);
    };
    
    fetchEvidence();
  }, [selectedSupplier]);

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateMessageText = (supplierName: string, lang: 'fr' | 'en') => {
    const ctx = requestInfo || { product: "Produit", description: "Usage", quantity: "N/A", constraints: "CE" };
    if (lang === 'fr') {
      return `Bonjour l'équipe de ${supplierName},\n\nNous vous contactons dans le cadre d'un nouveau projet de sourcing.\nNous sommes à la recherche d'un partenaire fiable pour la fourniture de : ${ctx.product}.\n\nUsage prévu : ${ctx.description}\nVolume estimé : ${ctx.quantity}\nExigences strictement spécifiques : ${ctx.constraints || "Standard"}\n\nPourriez-vous nous faire un retour concernant votre capacité de production pour ce type de demande, vos délais de fabrication actuels, ainsi qu'une première indication tarifaire ou un catalogue incluant les fiches techniques certifiées ?\n\nDans l'attente de votre retour,\n\nCordialement,\n(Votre Signature)`;
    } else {
      return `Dear ${supplierName} Team,\n\nWe are reaching out to you regarding a new sourcing project.\nWe are looking for a reliable partner to supply: ${ctx.product}.\n\nIntended usage: ${ctx.description}\nEstimated volume: ${ctx.quantity}\nStrict requirements: ${ctx.constraints || "Standard"}\n\nCould you please let us know about your production capabilities for this kind of request, your current lead times, and provide an initial price indication or a catalog with certified technical datasheets?\n\nLooking forward to your reply.\n\nBest regards,\n(Your Signature)`;
    }
  };

  // (On supprime l'ancien toggle sélection qui servait à l'envoi groupé)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans pb-24">
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">A</div>
              <span className="text-xl font-bold">Aether</span>
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Factory className="w-4 h-4" /> {requestInfo ? `REQ-${requestInfo.id.substring(0,6)} : ${requestInfo.product}` : "Chargement..."}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
              <Download className="w-5 h-5" />
            </button>
            <button className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-brand-600 dark:hover:bg-brand-400 hover:text-white transition-all">
              Nouvelle Requête
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 mt-8">
        
        {/* Processing Simulation UI */}
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-3xl mx-auto mt-16"
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900 mb-6 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                  <Bot className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Les Agents Aether sont au travail...</h2>
                <p className="text-gray-500">Cela prend généralement 2 à 5 minutes pour garantir zéro information erronée.</p>
              </div>

              <div className="glass-panel rounded-2xl p-6 h-[400px] overflow-hidden flex flex-col justify-end relative">
                <div className="absolute top-4 left-6 text-xs font-mono text-gray-400 font-medium">TERMINAL DE L'ORCHESTRATEUR</div>
                <div className="space-y-3 font-mono text-sm max-h-[300px] overflow-y-auto">
                  {logs.map((log, idx) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-4"
                    >
                      <span className="text-gray-400 shrink-0">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        log.agent_name === 'RegionalSearch' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        log.agent_name === 'LegalVerification' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        log.agent_name === 'ActivityContact' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                      }`}>
                        {log.agent_name}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">{log.message}</span>
                    </motion.div>
                  ))}
                  <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold mt-4 animate-pulse">
                    <Terminal className="w-4 h-4" /> Analyse en cours...
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Fournisseurs Qualifiés ({suppliers.length})</h1>
                  <p className="text-gray-500">Les agents Aether ont analysé les candidats pour vous présenter les profils les plus exploitables.</p>
                </div>
              </div>

              <div className="space-y-6">
                {suppliers.map((sup, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={sup.id} 
                    className="glass-panel p-6 sm:p-8 rounded-2xl border border-transparent hover:border-brand-300 transition-all cursor-pointer"
                    onClick={() => { setSelectedSupplier(sup); setShowEvidence(true); }}
                  >
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* En Tête Fournisseur */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{sup.name}</h3>
                          <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-semibold">
                            {sup.country}
                          </span>
                        </div>
                        <p className="text-brand-600 dark:text-brand-400 font-medium mb-6 flex items-center gap-2">
                          <Factory className="w-4 h-4" /> {sup.specialty}
                        </p>
                        
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex items-start gap-3">
                          <Bot className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                             {sup.ai_comment || "Aucun commentaire disponible."}
                          </p>
                        </div>
                      </div>

                      {/* Métriques et Contacts */}
                      <div className="flex-1 lg:max-w-xs flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                            <span className="block text-3xl font-bold text-brand-600 dark:text-brand-400 mb-1">{sup.relevance_score}/100</span>
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Score Confiance</span>
                          </div>
                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                            <span className="block text-3xl font-bold text-gray-900 dark:text-white mb-1">{sup.confidence_score}%</span>
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Match Produit</span>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3 text-sm flex-1">
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                            <ShieldCheck className="w-4 h-4" /> {sup.legal_status}
                          </div>
                          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />
                          
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 truncate">
                             <ExternalLink className="w-4 h-4 shrink-0" /> {sup.website || "N/A"}
                            </div>
                            <div className={`flex items-center gap-2 ${!sup.contact_phone ? "text-amber-600" : "text-gray-600 dark:text-gray-300"}`}>
                             {!sup.contact_phone ? <ShieldAlert className="w-4 h-4" /> : <Phone className="w-4 h-4" />} 
                             {sup.contact_phone || "Non identifié"}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 truncate">
                             <Mail className="w-4 h-4 shrink-0" /> {sup.contact_email || "Non identifié"}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-auto grid grid-cols-2 gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedSupplier(sup); setShowEvidence(true); }}
                            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-800"
                          >
                            Les Preuves
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setMessageModalSupplier(sup); }}
                            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest bg-brand-50 text-brand-700  hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50 rounded-lg transition-colors border border-brand-200 dark:border-brand-800/50 flex items-center justify-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Rédiger Devis
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODALE DE PREUVES ET AUDIT */}
        <AnimatePresence>
          {showEvidence && selectedSupplier && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={() => setShowEvidence(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-gray-950 w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh] overflow-hidden"
              >
                {/* Header Modale */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Audit Technique & Preuves</h2>
                      <p className="text-sm text-gray-500">{selectedSupplier.name} — {selectedSupplier.country}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowEvidence(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center px-6 pt-4 gap-6 border-b border-gray-50 dark:border-gray-900">
                  <button 
                    onClick={() => setEvidenceTab('narrative')}
                    className={`pb-3 text-sm font-bold transition-all relative ${evidenceTab === 'narrative' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  >
                    Audit Métier (Narratif)
                    {evidenceTab === 'narrative' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400" />}
                  </button>
                  <button 
                    onClick={() => setEvidenceTab('technical')}
                    className={`pb-3 text-sm font-bold transition-all relative ${evidenceTab === 'technical' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  >
                    Données Brutes (JSON)
                    {evidenceTab === 'technical' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400" />}
                  </button>
                </div>

                {/* Contenu Tabs */}
                <div className="flex-1 overflow-y-auto p-8">
                  {evidenceTab === 'narrative' ? (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Synthèse des Décisions</h4>
                          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                              <p className="text-sm text-gray-700 dark:text-gray-300"><b>Légitimité :</b> {selectedSupplier.legal_status}</p>
                            </div>
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                              <p className="text-sm text-gray-700 dark:text-gray-300"><b>Activité :</b> {selectedSupplier.activity_status}</p>
                            </div>
                            <div className="flex items-start gap-3">
                              {selectedSupplier.contact_email ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />}
                              <p className="text-sm text-gray-700 dark:text-gray-300"><b>Contact :</b> {selectedSupplier.contact_email ? "Coordonnées identifiées" : "À confirmer manuellement"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Score de Confiance</h4>
                          <div className="flex items-center gap-6">
                            <div className="text-5xl font-black text-brand-600 dark:text-brand-400">{selectedSupplier.relevance_score}</div>
                            <div className="text-sm text-gray-500 leading-relaxed italic">
                              "Le score reflète la capacité du fournisseur à répondre immédiatement au besoin sans risque majeur identifié."
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Faits vérifiés par les Agents</h4>
                        <div className="space-y-3">
                          {evidence.length > 0 ? evidence.map((ev, i) => (
                            <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                  <Bot className="w-3.5 h-3.5" /> Agent {ev.agent_name}
                                </span>
                                <span className="text-[10px] text-gray-400 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                                  {ev.verification_type}
                                </span>
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-200">
                                {typeof ev.details === 'object' ? (
                                  <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded text-xs font-mono">
                                    {JSON.stringify(ev.details, null, 2).substring(0, 300)}...
                                  </div>
                                ) : ev.details}
                              </div>
                            </div>
                          )) : (
                            <div className="py-12 text-center border-2 border-dashed border-gray-100 dark:border-gray-900 rounded-2xl">
                              <Loader2 className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-2" />
                              <p className="text-sm text-gray-400">Chargement des preuves...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-900 text-green-400 p-6 rounded-xl font-mono text-xs overflow-x-auto h-full">
                      <pre>{JSON.stringify({ supplier: selectedSupplier, audit_trail: evidence }, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* Footer Modale */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center text-xs text-gray-400 font-medium">
                  <div className="flex items-center gap-4">
                    <span>ARCHIVÉ LE {new Date().toLocaleDateString()}</span>
                    <span>SOURCE : AETHER MULTI-AGENT PIPELINE</span>
                  </div>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(JSON.stringify({ supplier: selectedSupplier, audit_trail: evidence }, null, 2)); alert("Audit technique copié !"); }}
                    className="flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Copier l'Audit Complet
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL GÉNÉRATION DE MESSAGE */}
        <AnimatePresence>
          {messageModalSupplier && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setMessageModalSupplier(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col p-6"
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                       <MessageSquare className="w-5 h-5 text-brand-500" /> Assistant de Contact
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Une ébauche de message, prête à l'emploi pour <b>{messageModalSupplier.name}</b>.
                    </p>
                  </div>
                  <button onClick={() => setMessageModalSupplier(null)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4 bg-gray-50 dark:bg-gray-950 p-1.5 rounded-lg w-max">
                  <button 
                    onClick={() => setMessageLang('fr')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${messageLang === 'fr' ? 'bg-white dark:bg-gray-800 shadow-sm text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    Français (FR)
                  </button>
                  <button 
                    onClick={() => setMessageLang('en')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${messageLang === 'en' ? 'bg-white dark:bg-gray-800 shadow-sm text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    Anglais (EN)
                  </button>
                </div>

                <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6">
                  <textarea 
                    readOnly
                    className="w-full bg-transparent outline-none resize-none text-sm text-gray-700 dark:text-gray-300 min-h-[220px]"
                    value={generateMessageText(messageModalSupplier.name, messageLang)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">✨ Message généré à partir de votre besoin strict.</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMessageModalSupplier(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                      Fermer
                    </button>
                    <button 
                      onClick={() => handleCopyMessage(generateMessageText(messageModalSupplier.name, messageLang))}
                      className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:bg-brand-600 dark:hover:bg-brand-400 hover:text-white transition-all flex items-center gap-2 shadow-lg"
                    >
                      {copied ? <><CheckCircle2 className="w-4 h-4" /> Copié</> : <><Copy className="w-4 h-4" /> Copier le texte</>}
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
