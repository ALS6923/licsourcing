import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugRun() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  const requestId = "96d91d93-3c39-4f0c-ba8c-e165faef98a4";
  console.log(`--- DEBUG RUN ${requestId} ---`);

  const { data: logs } = await supabase.from('agent_logs').select('*').eq('request_id', requestId).order('created_at');
  console.log("\nLOGS D'AGENTS :");
  logs?.forEach(l => console.log(`[${l.agent_name}] ${l.message}`));

  const { data: candidates } = await supabase.from('suppliers').select('*').eq('request_id', requestId);
  console.log("\nFOURNISSEURS ENREGISTRÉS :");
  if (!candidates || candidates.length === 0) console.log("Aucun fournisseur n'a été inséré en base.");
  candidates?.forEach(c => console.log(`- ${c.name} : Status ${c.activity_status}, AI: ${c.ai_comment}`));
}

debugRun();
