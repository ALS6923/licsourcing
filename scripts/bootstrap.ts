import dotenv from 'dotenv';
import path from 'path';

// Charge .env.local avant tout le reste
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Log pour vérifier (à masquer en prod)
console.log("[Bootstrap] URL Supabase:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "OK" : "MANQUANT");

// Lance le benchmark
import './run_benchmark';
