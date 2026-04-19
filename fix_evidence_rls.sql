-- Correctif RLS : Autoriser l'insertion anonyme des preuves d'audit
-- À exécuter dans le SQL Editor de Supabase pour activer la persistance

CREATE POLICY "Allow anonymous insert evidence for MVP" 
ON public.supplier_evidence 
FOR INSERT TO anon 
WITH CHECK (true);
