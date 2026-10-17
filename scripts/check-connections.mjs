import process from 'node:process';
import { readFileSync } from 'node:fs';

const local = process.argv.includes('--local');
const config = local ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((line) => line.includes('=') && !line.startsWith('#')).map((line) => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];
})) : process.env;
let failed = false;
if (process.argv.includes('--vercel')) {
  const target = 'https://deu-bom-financas-sem-erro.vercel.app';
  const response = await fetch(target, { signal: AbortSignal.timeout(20_000) });
  console.log(`Vercel public site: HTTP ${response.status}; Vercel headers: ${response.headers.has('x-vercel-id')}`);
  if (!response.ok) failed = true;
  await response.body.cancel();
  if (!process.env.VERCEL_TOKEN) { console.error('VERCEL_TOKEN is not available.'); failed = true; }
  else {
    const metadata = await fetch('https://api.vercel.com/v9/projects/prj_s5VpsAYH1MfNwHQwyO1GOJ8N4sX5', { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` }, signal: AbortSignal.timeout(20_000) });
    console.log(`Vercel project authorization: HTTP ${metadata.status}`);
    if (!metadata.ok) failed = true;
    else {
      const project = await metadata.json();
      const linked = project.link?.repo === 'deu-bom' && project.link?.org === 'alisson-correia';
      console.log(`Git integration points to alisson-correia/deu-bom: ${linked}`);
      if (!linked) failed = true;
    }
  }
} else {
  const projectId = readFileSync('supabase/config.toml', 'utf8').match(/project_id\s*=\s*"([^"]+)"/)?.[1];
  const url = config.VITE_SUPABASE_URL;
  const key = config.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  if (url.replace(/\/$/, '') !== `https://${projectId}.supabase.co`) { console.error('Supabase URL differs from supabase/config.toml. Check environment settings.'); failed = true; }
  for (const table of ['budgets','categories','event_items','event_participants','events','profiles','purchase_goals','transactions','workspace_invitations','workspace_members','workspaces']) {
    try {
      const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers: { apikey: key }, signal: AbortSignal.timeout(15_000) });
      console.log(`${table}: HTTP ${response.status}`);
      if (!response.ok) failed = true;
      await response.body.cancel();
    } catch { console.error(`${table}: connection failed`); failed = true; }
  }
  console.log('Read-only, limit=0: no records requested. This does not audit RLS or RPC functions.');
}
process.exitCode = failed ? 1 : 0;
