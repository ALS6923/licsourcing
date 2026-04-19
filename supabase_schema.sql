-- Schéma Supabase pour Aether Sourcing (SaaS Multi-Agents)
-- À exécuter dans le SQL Editor de Supabase

-- Activer l'extension UUID (souvent active par défaut, mais au cas où)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des requêtes de sourcing (Requests)
CREATE TABLE public.requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  product TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  geo_zones JSONB NOT NULL,
  supplier_type_preference TEXT DEFAULT 'Fabricant', -- Fabricant, Distributeur, Indifférent
  certifications TEXT,
  constraints TEXT,
  status TEXT DEFAULT 'pending_agents',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des fournisseurs qualifiés (Suppliers)
CREATE TABLE public.suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  specialty TEXT NOT NULL,
  detected_type TEXT DEFAULT 'Non Identifié', -- Fabricant, Distributeur
  website TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  relevance_score INTEGER NOT NULL,
  confidence_score INTEGER NOT NULL,
  legal_status TEXT NOT NULL,
  activity_status TEXT NOT NULL,
  ai_comment TEXT, -- Commentaire métier (Business comment)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des preuves de vérification (Supplier Evidence)
CREATE TABLE public.supplier_evidence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL, -- 'legal', 'activity', 'contact'
  verification_type TEXT NOT NULL,
  source_url TEXT,
  is_valid BOOLEAN NOT NULL,
  details JSONB, -- Audit technique stocké en format JSON
  found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des logs d'agents pour l'Orchestrateur (Verification Logs)
CREATE TABLE public.agent_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  message TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sécurité Row Level Security (RLS)

-- Activer RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir/modifier uniquement leurs propres requêtes (Si connectés)
CREATE POLICY "Users can manage their own requests" 
ON public.requests 
FOR ALL USING (auth.uid() = user_id);

-- [MODE TEST MVP] Autoriser les insertions et lectures anonymes car l'Auth n'est pas encore branchée
CREATE POLICY "Allow anonymous inserts for MVP" ON public.requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous selects for MVP" ON public.requests FOR SELECT TO anon USING (true);

-- Les fournisseurs liés à une requête appartenant à l'utilisateur
CREATE POLICY "Users can view suppliers for their requests" 
ON public.suppliers 
FOR SELECT USING (
  request_id IN (SELECT id FROM public.requests WHERE user_id = auth.uid() OR user_id IS NULL)
);

CREATE POLICY "Allow anonymous insert suppliers for MVP" ON public.suppliers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Users can view evidence for their suppliers" 
ON public.supplier_evidence 
FOR SELECT USING (
  supplier_id IN (
    SELECT id FROM public.suppliers WHERE request_id IN (
      SELECT id FROM public.requests WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can view agent logs for their requests" 
ON public.agent_logs 
FOR SELECT USING (
  request_id IN (SELECT id FROM public.requests WHERE user_id = auth.uid() OR user_id IS NULL)
);

CREATE POLICY "Allow anonymous insert logs for MVP" ON public.agent_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous insert evidence for MVP" ON public.supplier_evidence FOR INSERT TO anon WITH CHECK (true);
