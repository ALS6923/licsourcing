-- Migration V2 : Renommage match_score -> relevance_score et typage JSONB pour details
-- À exécuter dans le SQL Editor de Supabase

-- 1. Renommage de la colonne match_score
ALTER TABLE public.suppliers RENAME COLUMN match_score TO relevance_score;

-- 2. Changement de type pour la colonne details de supplier_evidence
-- On utilise USING pour convertir le texte existant en JSONB si possible
ALTER TABLE public.supplier_evidence 
ALTER COLUMN details TYPE JSONB USING details::jsonb;

-- 3. Mise à jour des commentaires pour clarté
COMMENT ON COLUMN public.suppliers.ai_comment IS 'Commentaire métier synthétique pour l''utilisateur';
COMMENT ON COLUMN public.supplier_evidence.details IS 'Audit technique brut stocké en JSON (Structured Output des agents)';
