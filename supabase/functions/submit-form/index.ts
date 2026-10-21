// Public endpoint for the site's forms: Turnstile check → validation → rate limit → insert.
// Secrets (set with `supabase secrets set`): TURNSTILE_SECRET, IP_SALT.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://corneluu.github.io', 'http://localhost:4321', 'http://localhost:4322'];
const FORM_TYPES = ['contact', 'voluntariat', 'parteneriat'];
const MAX_PER_10_MIN = 3;

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

const reply = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/<[^>]*>?/g, '').trim().slice(0, max) : '';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
  if (req.method !== 'POST') return reply(405, { success: false, message: 'Metodă nepermisă.' }, origin);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return reply(403, { success: false, message: 'Origine nepermisă.' }, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { success: false, message: 'Cerere invalidă.' }, origin);
  }

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';

  // 1. Turnstile
  const ts = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: Deno.env.get('TURNSTILE_SECRET') ?? '', response: String(body.turnstile ?? ''), remoteip: ip }),
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!ts.success) return reply(400, { success: false, message: 'Verificarea anti-spam a eșuat. Reîncarcă pagina și încearcă din nou.' }, origin);

  // 2. Validation, using the admin-editable form config for required fields
  const tip = String(body.tip_formular ?? '');
  if (!FORM_TYPES.includes(tip)) return reply(400, { success: false, message: 'Tip de formular invalid.' }, origin);

  const { data: cfg } = await supabase.from('setari_formulare').select('campuri').eq('tip_formular', tip).maybeSingle();
  const campuri = (cfg?.campuri ?? {}) as Record<string, { required?: boolean; hidden?: boolean }>;
  const req_ = (f: string) => !!campuri[f]?.required && !campuri[f]?.hidden;

  const nume = clean(body.nume, 100);
  const email = clean(body.email, 120);
  const telefon = clean(body.telefon, 25);
  const mesaj = clean(body.mesaj, 3000);
  const extra = {
    varsta: clean(body.varsta, 3),
    ocupatie: clean(body.ocupatie, 80),
    disponibilitate: clean(body.disponibilitate, 80),
  };

  const errors: string[] = [];
  if (nume.length < 2) errors.push('nume');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('email');
  if (mesaj.length < 10) errors.push('mesaj');
  if (req_('phone') && !telefon) errors.push('telefon');
  if (tip === 'voluntariat') {
    if (req_('age') && !extra.varsta) errors.push('varsta');
    if (req_('occupation') && !extra.ocupatie) errors.push('ocupatie');
    if (req_('availability') && !extra.disponibilitate) errors.push('disponibilitate');
  }
  if (errors.length) return reply(400, { success: false, message: 'Câmpuri invalide: ' + errors.join(', ') }, origin);

  // 3. Rate limit per (salted, hashed) IP
  const ip_hash = ip ? await sha256((Deno.env.get('IP_SALT') ?? '') + ip) : null;
  if (ip_hash) {
    const { count } = await supabase.from('mesaje').select('id', { count: 'exact', head: true })
      .eq('ip_hash', ip_hash).gte('creat_la', new Date(Date.now() - 10 * 60_000).toISOString());
    if ((count ?? 0) >= MAX_PER_10_MIN) {
      return reply(429, { success: false, message: 'Prea multe mesaje într-un timp scurt. Încearcă din nou peste câteva minute.' }, origin);
    }
  }

  // 4. Save
  const { error } = await supabase.from('mesaje').insert({
    tip_formular: tip, nume, email, telefon: telefon || null, mesaj,
    extra: tip === 'voluntariat' ? extra : {},
    pagina: clean(body.pagina, 300), ip_hash,
  });
  if (error) return reply(500, { success: false, message: 'Mesajul nu a putut fi salvat.' }, origin);

  return reply(200, { success: true }, origin);
});
