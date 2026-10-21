// Tiny DOM helpers for the admin app (no framework).

type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, any> = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k in el && k !== 'list' && k !== 'form') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function toast(message: string, type: 'ok' | 'error' = 'ok') {
  const t = h('div', { class: `toast toast-${type}`, role: 'status' }, message);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, type === 'error' ? 6000 : 3000);
}

export function confirmDialog(message: string, okLabel = 'Confirmă', danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog' },
      h('p', {}, message),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => close(false) }, 'Anulează'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => close(true) }, okLabel),
      ),
    );
    const close = (v: boolean) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', () => close(false));
    document.body.append(dlg);
    dlg.showModal();
  });
}

/** Shows Supabase/JS errors in Romanian where we know the cause. */
export function errorText(err: any): string {
  const msg = String(err?.message ?? err ?? 'Eroare necunoscută');
  if (err?.code === '23505') return 'Există deja o înregistrare cu această valoare (de ex. același link/slug).';
  if (err?.code === '23514') return 'O valoare nu respectă regulile (verifică câmpurile).';
  if (err?.code === '42501' || /row-level security/i.test(msg)) return 'Nu ai drepturi pentru această acțiune.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Eroare de rețea. Verifică conexiunea la internet.';
  if (/email not confirmed/i.test(msg)) return 'Contul nu este confirmat. În Supabase → Authentication → Users, confirmă emailul acestui cont.';
  return msg;
}

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Preview URL for images stored either as full URLs (uploads) or site paths (/images/...). */
export const imgSrc = (url?: string | null) => (!url ? '' : /^https?:/.test(url) ? url : BASE + url);

export const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' }).format(new Date(d));

export function slugify(text: string) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export const loading = () => h('div', { class: 'loading' }, 'Se încarcă…');
