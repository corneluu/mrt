/**
 * Build-time reads from Supabase's REST API with the public (publishable) key.
 * Row-level security only exposes published, non-deleted rows to this key.
 * Throws on any failure so a broken connection fails the build instead of
 * deploying a site with empty sections.
 */
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_KEY;

export async function selectRows<T = Record<string, any>>(table: string, query = 'select=*'): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_KEY lipsesc din .env');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (!res.ok) {
    throw new Error(`Supabase: ${table} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Settings rows (contact, juridic, social) as one object keyed by `cheie`. */
export async function getSetari(): Promise<Record<string, Record<string, string>>> {
  const rows = await selectRows<{ cheie: string; valoare: Record<string, string> }>('setari');
  return Object.fromEntries(rows.map(r => [r.cheie, r.valoare]));
}
