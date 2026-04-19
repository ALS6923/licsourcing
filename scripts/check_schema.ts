import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkSchema() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  console.log("--- VÉRIFICATION DU SCHÉMA SUPABASE ---");
  const tables = ['requests', 'suppliers', 'supplier_evidence', 'agent_logs'];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`[-] TABLE '${table}' : MANQUANTE ou ERREUR (${error.message})`);
    } else {
      console.log(`[+] TABLE '${table}' : OK`);
    }
  }
}

checkSchema();
