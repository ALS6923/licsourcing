"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, ShieldCheck, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import SourcingForm from "@/components/SourcingForm";

export default function Home() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-30 dark:opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-400 to-blue-500 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
            A
          </div>
          <span className="text-xl font-semibold tracking-tight">
            Aether Sourcing
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-gray-300">
          <a href="#features" className="hover:text-brand-600 transition-colors">Fonctionnalités</a>
          <a href="#process" className="hover:text-brand-600 transition-colors">Notre Process</a>
        </nav>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-brand-600 dark:hover:bg-brand-400 hover:text-white transition-all shadow-lg hover:shadow-brand-500/25"
        >
          Nouvelle Recherche
        </button>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium mb-8 border border-brand-100 dark:border-brand-800">
            <Zap className="w-4 h-4" />
            <span>Sourcing B2B Propulsé par l'IA Multi-Agents</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
            Trouvez les <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-blue-600">Meilleurs Fournisseurs</span><br />
            en moins de 5 minutes.
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Aether utilise une flotte d'agents autonomes pour sourcer, vérifier légalement et qualifier vos futurs partenaires internationaux, sans aucune information inventée.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setIsFormOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-lg font-medium transition-all shadow-xl shadow-brand-600/20 flex items-center justify-center gap-2 group"
            >
              Lancer une recherche IA
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#demo" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
              Voir la Démo
            </a>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-32"
        >
          {[
            {
              icon: Globe,
              title: "Recherche Globale Parallèle",
              desc: "Agents régionaux (Europe, Asie, Afrique du Nord) opérant simultanément."
            },
            {
              icon: ShieldCheck,
              title: "Zéro Hallucination, 100% Vérifié",
              desc: "Validation croisée de l'existence légale et des données de contact."
            },
            {
              icon: CheckCircle2,
              title: "Exploitable Immédiatement",
              desc: "Données complètes avec scoring de confiance pour contacter le top 5 directement."
            }
          ].map((feature, idx) => (
            <div key={idx} className="glass-panel p-8 rounded-2xl text-left">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Sourcing Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 text-gray-900 dark:text-white">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-panel rounded-2xl shadow-2xl flex flex-col">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
            >
              ✕
            </button>
            <SourcingForm onClose={() => setIsFormOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
