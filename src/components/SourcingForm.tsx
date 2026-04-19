"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, MapPin, Package, Settings, ShieldCheck, CheckCircle2, AlertTriangle, Factory, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SourcingForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<{
    product: string;
    description: string;
    quantity: string;
    geoRegions: string[];
    geoCountries: string[];
    isAllCountries: boolean;
    supplierTypePreference: string;
    certifications: string;
    constraints: string;
  }>({
    product: "",
    description: "",
    quantity: "",
    geoRegions: [],
    geoCountries: [],
    isAllCountries: false,
    supplierTypePreference: "Fabricant",
    certifications: "",
    constraints: ""
  });

  const [countrySearch, setCountrySearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [reformulationData, setReformulationData] = useState<{
    summary: string;
    warnings: string[];
  } | null>(null);

  const regionOptions = ["Europe", "Asie", "Afrique du Nord", "Moyen-Orient", "Amérique du Nord"];
  const countryOptions = [
    "France", "Turquie", "Chine", "Allemagne", "Italie", "Espagne", "États-Unis", "Inde", "Vietnam", "Maroc", "Pologne"
  ].sort(); // Basic B2B mock list

  const filteredCountries = countryOptions.filter(
    c => c.toLowerCase().includes(countrySearch.toLowerCase()) && !formData.geoCountries.includes(c)
  );

  const handleRegionToggle = (region: string) => {
    setFormData(prev => ({
      ...prev,
      isAllCountries: false,
      geoRegions: prev.geoRegions.includes(region) 
        ? prev.geoRegions.filter(r => r !== region) 
        : [...prev.geoRegions, region]
    }));
  };

  const handleAddCountry = (country: string) => {
    setFormData(prev => ({
      ...prev,
      isAllCountries: false,
      geoCountries: [...prev.geoCountries, country]
    }));
    setCountrySearch("");
    setIsDropdownOpen(false);
  };

  const handleRemoveCountry = (country: string) => {
    setFormData(prev => ({
      ...prev,
      geoCountries: prev.geoCountries.filter(c => c !== country)
    }));
  };

  const handleReformulation = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reformulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setReformulationData(data.data);
        setStep(3); // Go to Reformulation User Validation
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la reformulation.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success && data.requestId) {
        router.push(`/dashboard?requestId=${data.requestId}`);
      } else {
        alert("Erreur serveur");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="p-8 sm:p-12 relative">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold mb-3">Nouvelle Recherche IA</h2>
        <p className="text-gray-500 max-w-lg mx-auto">
          {step === 3 ? "Validation de l'interprétation par l'Orchestrateur" : "Veuillez détailler vos besoins pour que nos agents puissent identifier les fournisseurs parfaits."}
        </p>
      </div>

      <div className="space-y-8">
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Package className="w-4 h-4 text-brand-600" /> Produit Recherché
              </label>
              <input 
                required
                type="text" 
                placeholder="Ex: Gants nitrile" 
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                value={formData.product}
                onChange={e => setFormData({...formData, product: e.target.value})}
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Settings className="w-4 h-4 text-brand-600" /> Description technique & Usage
              </label>
              <textarea 
                required
                rows={3}
                placeholder="Spécifications, normes alimentaires..." 
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                Volume & Quantité Estimée
              </label>
              <input 
                required
                type="text" 
                placeholder="Ex: 500 cartons / mois" 
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
              />
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="button" 
                onClick={() => setStep(2)}
                disabled={!formData.product || !formData.description || !formData.quantity}
                className="px-8 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            
            {/* TYPOLOGIE */}
            <div className="bg-brand-50/50 dark:bg-brand-950/20 p-5 rounded-2xl border border-brand-100 dark:border-brand-900/50">
              <label className="flex items-center gap-2 text-sm font-bold mb-3 text-brand-800 dark:text-brand-300">
                <Factory className="w-4 h-4" /> Typologie de Fournisseur
              </label>
              <div className="flex flex-wrap gap-3">
                {["Fabricant", "Distributeur", "Indifférent"].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, supplierTypePreference: type})}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      formData.supplierTypePreference === type 
                        ? "bg-brand-600 border-brand-600 text-white" 
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {type} {type === "Fabricant" && "(Prioritaire)"}
                  </button>
                ))}
              </div>
            </div>

            {/* GEO FIELDS */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="w-4 h-4 text-brand-600" /> Options Géographiques
                </label>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, isAllCountries: !formData.isAllCountries, geoRegions: [], geoCountries: []})}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${formData.isAllCountries ? 'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-900 dark:text-brand-300' : 'bg-gray-100 text-gray-600 border-transparent dark:bg-gray-800 dark:text-gray-300'}`}
                >
                  🌐 Monde Entier (Ignorer les filtres)
                </button>
              </div>

              {!formData.isAllCountries && (
                <div className="space-y-4">
                  {/* Regions Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    {regionOptions.map(region => (
                      <button
                        key={region}
                        type="button"
                        onClick={() => handleRegionToggle(region)}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          formData.geoRegions.includes(region) 
                            ? "bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-500" 
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {region}
                      </button>
                    ))}
                  </div>

                  {/* Specific Countries Autocomplete */}
                  <div className="relative">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <AnimatePresence>
                        {formData.geoCountries.map(country => (
                          <motion.span 
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                            key={country} 
                            className="bg-brand-100 dark:bg-brand-900/50 text-brand-800 dark:text-brand-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-brand-200 dark:border-brand-800"
                          >
                            {country}
                            <button type="button" onClick={() => handleRemoveCountry(country)} className="hover:text-brand-900 dark:hover:text-white">
                              <X className="w-3 h-3" />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                    
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Ajouter des pays (Ex: France, Chine...)" 
                        className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={countrySearch}
                        onChange={e => {
                          setCountrySearch(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                      />
                      
                      {isDropdownOpen && countrySearch.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {filteredCountries.length > 0 ? (
                            filteredCountries.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => handleAddCountry(c)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                {c}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500">Aucun résultat. Appuyez sur Entrée pour forcer la saisie.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600" /> Certifications Requises
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: ISO, Contact alimentaire..." 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  value={formData.certifications}
                  onChange={e => setFormData({...formData, certifications: e.target.value})}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  Contraintes Spécifiques
                </label>
                <input 
                  type="text"
                  placeholder="Délais urgents, contact direct..." 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  value={formData.constraints}
                  onChange={e => setFormData({...formData, constraints: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="px-6 py-3 text-gray-500 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
              >
                Retour
              </button>
              
              <button 
                type="button" 
                onClick={handleReformulation}
                disabled={loading || (!formData.isAllCountries && formData.geoRegions.length === 0 && formData.geoCountries.length === 0)}
                className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-brand-600 dark:hover:bg-brand-400 hover:text-white transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyse...</> : "Valider vers IA"}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3 : REFORMULATION (HUMAN IN THE LOOP) */}
        {step === 3 && reformulationData && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="w-24 h-24" />
              </div>
              
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-green-500 w-5 h-5" /> Synthèse de votre demande
              </h3>
              
              <div className="prose prose-sm dark:prose-invert text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {reformulationData.summary}
              </div>

              {reformulationData.warnings && reformulationData.warnings.length > 0 && (
                <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
                  <h4 className="text-amber-800 dark:text-amber-400 font-bold flex items-center gap-2 mb-2 text-sm">
                    <AlertTriangle className="w-4 h-4" /> Point de vigilance IA
                  </h4>
                  <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-1 list-disc pl-4">
                    {reformulationData.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                type="button" 
                onClick={() => setStep(2)}
                className="w-full px-6 py-4 border-2 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all"
              >
                Modifier la demande
              </button>
              <button 
                onClick={handleSubmitFinal}
                disabled={loading}
                className="w-full px-6 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-xl shadow-brand-500/25 flex justify-center items-center gap-2 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Valider définitivement et Lancer"}
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
