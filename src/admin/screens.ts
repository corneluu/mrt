// Messages inbox, form settings, site settings, trash, activity log, admin list.
import { supabase } from './supabase';
import { h, toast, confirmDialog, errorText, fmtDate, loading } from './ui';

const FORM_LABELS: Record<string, string> = { contact: 'Contact', voluntariat: 'Voluntariat', parteneriat: 'Parteneriat' };
const STATUS_LABELS: Record<string, string> = { nou: 'Nou', in_lucru: 'În lucru', rezolvat: 'Rezolvat' };
const EXTRA_LABELS: Record<string, string> = { varsta: 'Vârsta', ocupatie: 'Ocupația', disponibilitate: 'Disponibilitate' };

const head = (title: string, ...actions: (Node | null)[]) =>
  h('div', { class: 'page-head' }, h('h1', {}, title), h('div', { class: 'page-actions' }, ...actions));

// ───────────── Messages ─────────────
export async function renderMesaje(root: HTMLElement) {
  root.replaceChildren(loading());
  const { data, error } = await supabase.from('mesaje').select('*').is('sters_la', null).order('creat_la', { ascending: false });
  if (error) return root.replaceChildren(h('p', { class: 'error' }, errorText(error)));
  let rows = data ?? [];

  const fTip = h('select', { class: 'input', 'aria-label': 'Tip formular' }, h('option', { value: '' }, 'Toate formularele'), ...Object.entries(FORM_LABELS).map(([v, l]) => h('option', { value: v }, l)));
  const fStatus = h('select', { class: 'input', 'aria-label': 'Stare' }, h('option', { value: '' }, 'Toate stările'), ...Object.entries(STATUS_LABELS).map(([v, l]) => h('option', { value: v }, l)));
  const search = h('input', { type: 'search', class: 'input', placeholder: 'Caută nume, email, text…', 'aria-label': 'Caută' });
  const list = h('ul', { class: 'item-list' });

  const filtered = () => {
    const q = search.value.trim().toLowerCase();
    return rows.filter((r) => (!fTip.value || r.tip_formular === fTip.value) && (!fStatus.value || r.status === fStatus.value)
      && (!q || [r.nume, r.email, r.telefon, r.mesaj, r.note].join(' ').toLowerCase().includes(q)));
  };

  const draw = () => {
    const items = filtered();
    list.replaceChildren(...items.map((r) => h('li', { class: `item message ${r.status === 'nou' ? 'is-new' : ''}` },
      h('div', { class: 'item-text' },
        h('strong', {}, r.nume, ' ', h('span', { class: 'muted' }, `<${r.email}>`)),
        h('span', { class: 'muted' }, `${FORM_LABELS[r.tip_formular]} · ${fmtDate(r.creat_la)}`),
        h('span', { class: 'preview' }, r.mesaj.slice(0, 120)),
      ),
      h('span', { class: `badge status-${r.status}` }, STATUS_LABELS[r.status]),
      h('div', { class: 'item-actions' }, h('button', { class: 'btn btn-sm', onclick: () => detail(r) }, 'Deschide')),
    )));
    if (!items.length) list.append(h('li', { class: 'empty' }, 'Niciun mesaj.'));
  };
  [fTip, fStatus].forEach((el) => el.addEventListener('change', draw));
  search.addEventListener('input', draw);

  const exportCsv = () => {
    const cols = ['creat_la', 'tip_formular', 'status', 'nume', 'email', 'telefon', 'mesaj', 'varsta', 'ocupatie', 'disponibilitate', 'note'];
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(';'), ...filtered().map((r) => cols.map((c) => cell(c in (r.extra ?? {}) ? r.extra[c] : c === 'creat_la' ? fmtDate(r.creat_la) : r[c])).join(';'))];
    // BOM + semicolons so Excel (Romanian locale) opens diacritics and columns correctly
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `mesaje-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const detail = (r: any) => {
    const status = h('select', { class: 'input' }, ...Object.entries(STATUS_LABELS).map(([v, l]) => h('option', { value: v, selected: v === r.status }, l)));
    const note = h('textarea', { class: 'input', rows: 4, value: r.note, placeholder: 'Note interne (nu le vede expeditorul)' });
    const extra = Object.entries(r.extra ?? {}).filter(([, v]) => v);
    root.replaceChildren(
      head('Mesaj', h('button', { class: 'btn', onclick: () => { draw(); root.replaceChildren(listView); } }, '← Înapoi')),
      h('div', { class: 'card message-detail' },
        h('dl', {},
          h('dt', {}, 'Formular'), h('dd', {}, FORM_LABELS[r.tip_formular]),
          h('dt', {}, 'Primit'), h('dd', {}, fmtDate(r.creat_la)),
          h('dt', {}, 'Nume'), h('dd', {}, r.nume),
          h('dt', {}, 'Email'), h('dd', {}, h('a', { href: `mailto:${r.email}` }, r.email)),
          r.telefon ? [h('dt', {}, 'Telefon'), h('dd', {}, h('a', { href: `tel:${r.telefon.replace(/\s/g, '')}` }, r.telefon))] : null,
          extra.map(([k, v]) => [h('dt', {}, EXTRA_LABELS[k] ?? k), h('dd', {}, String(v))]),
          r.pagina ? [h('dt', {}, 'Pagina'), h('dd', {}, r.pagina)] : null,
        ),
        h('h3', {}, 'Mesaj'),
        h('p', { class: 'message-body' }, r.mesaj),
        h('div', { class: 'field' }, h('label', {}, 'Stare'), status),
        h('div', { class: 'field' }, h('label', {}, 'Note'), note),
        h('div', { class: 'form-actions' },
          h('button', {
            class: 'btn btn-danger-outline',
            onclick: async () => {
              if (!(await confirmDialog('Muți mesajul în coș? Poate fi restaurat 30 de zile.', 'Mută în coș'))) return;
              const { error } = await supabase.from('mesaje').update({ sters_la: new Date().toISOString() }).eq('id', r.id);
              if (error) return toast(errorText(error), 'error');
              rows = rows.filter((x) => x.id !== r.id);
              toast('Mutat în coș.');
              draw(); root.replaceChildren(listView);
            },
          }, 'Șterge'),
          h('button', {
            class: 'btn btn-primary',
            onclick: async () => {
              const { error } = await supabase.from('mesaje').update({ status: status.value, note: note.value }).eq('id', r.id);
              if (error) return toast(errorText(error), 'error');
              Object.assign(r, { status: status.value, note: note.value });
              toast('Salvat.');
            },
          }, 'Salvează'),
        ),
      ),
    );
    window.scrollTo(0, 0);
  };

  const listView = h('div', {},
    head('Mesaje din formulare', h('button', { class: 'btn', onclick: exportCsv }, '⤓ Export CSV')),
    h('div', { class: 'toolbar' }, search, fTip, fStatus),
    list,
  );
  draw();
  root.replaceChildren(listView);
}

// ───────────── Form fields ─────────────
const FIELD_NAMES: Record<string, string> = {
  name: 'Nume', email: 'Email', phone: 'Telefon', age: 'Vârsta', occupation: 'Ocupația', availability: 'Disponibilitate', message: 'Mesaj',
};
const ALWAYS_REQUIRED = ['name', 'email', 'message'];
const VOLUNTEER_ONLY = ['age', 'occupation', 'availability'];

export async function renderFormulare(root: HTMLElement, tip = 'contact') {
  root.replaceChildren(loading());
  const { data, error } = await supabase.from('setari_formulare').select('*').eq('tip_formular', tip).single();
  if (error) return root.replaceChildren(h('p', { class: 'error' }, errorText(error)));
  const campuri = structuredClone(data.campuri);

  const tabs = h('div', { class: 'tabs', role: 'tablist' }, ...Object.entries(FORM_LABELS).map(([v, l]) =>
    h('button', { class: `tab ${v === tip ? 'active' : ''}`, role: 'tab', 'aria-selected': v === tip, onclick: () => renderFormulare(root, v) }, l)));

  const rows = Object.keys(FIELD_NAMES).filter((k) => tip === 'voluntariat' || !VOLUNTEER_ONLY.includes(k)).map((k) => {
    const c = campuri[k];
    const locked = ALWAYS_REQUIRED.includes(k);
    return h('fieldset', { class: 'card form-field-card' },
      h('legend', {}, FIELD_NAMES[k]),
      h('div', { class: 'field' }, h('label', {}, 'Etichetă'),
        h('input', { class: 'input', value: c.label, oninput: (e: Event) => { c.label = (e.target as HTMLInputElement).value; } })),
      h('div', { class: 'field' }, h('label', {}, k === 'availability' ? 'Text implicit în listă' : 'Text exemplu (placeholder)'),
        h('input', { class: 'input', value: c.placeholder, oninput: (e: Event) => { c.placeholder = (e.target as HTMLInputElement).value; } })),
      k === 'availability' ? h('div', { class: 'field' }, h('label', {}, 'Opțiuni (câte una pe rând)'),
        h('textarea', { class: 'input', rows: 4, value: (c.options ?? []).join('\n'), oninput: (e: Event) => { c.options = (e.target as HTMLTextAreaElement).value.split('\n').map((s) => s.trim()).filter(Boolean); } })) : null,
      h('div', { class: 'checks' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: locked || c.required, disabled: locked, onchange: (e: Event) => { c.required = (e.target as HTMLInputElement).checked; } }), 'Obligatoriu'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !locked && c.hidden, disabled: locked, onchange: (e: Event) => { c.hidden = (e.target as HTMLInputElement).checked; } }), 'Ascuns'),
        locked ? h('small', { class: 'muted' }, 'Câmp necesar, nu poate fi ascuns.') : null,
      ),
    );
  });

  root.replaceChildren(
    head('Câmpuri formulare'),
    tabs,
    h('p', { class: 'muted' }, 'Modificările apar pe site după reconstruirea de noapte.'),
    ...rows,
    h('div', { class: 'form-actions' }, h('button', {
      class: 'btn btn-primary',
      onclick: async () => {
        if (Object.values(campuri).some((c: any) => !c.label.trim())) return toast('Fiecare câmp are nevoie de o etichetă.', 'error');
        const { error } = await supabase.from('setari_formulare').update({ campuri }).eq('tip_formular', tip);
        error ? toast(errorText(error), 'error') : toast('Salvat.');
      },
    }, 'Salvează')),
  );
}

// ───────────── Site settings ─────────────
const SETTINGS: Record<string, { title: string; fields: [string, string, string?][] }> = {
  contact: { title: 'Date de contact', fields: [['adresa', 'Adresă'], ['cod_postal', 'Cod poștal'], ['telefon', 'Telefon'], ['email', 'Email'], ['program', 'Program de lucru', 'textarea'], ['harta_url', 'Link Google Maps', 'url']] },
  juridic: { title: 'Date juridice', fields: [['denumire', 'Denumire completă'], ['cui', 'CUI (cod fiscal)'], ['nr_registru', 'Nr. Registrul Asociațiilor'], ['iban', 'IBAN (RON)'], ['banca', 'Banca']] },
  social: { title: 'Rețele sociale', fields: [['facebook', 'Facebook', 'url'], ['instagram', 'Instagram', 'url'], ['tiktok', 'TikTok', 'url'], ['youtube', 'YouTube', 'url'], ['linkedin', 'LinkedIn', 'url']] },
};

export async function renderSetari(root: HTMLElement) {
  root.replaceChildren(loading());
  const { data, error } = await supabase.from('setari').select('*');
  if (error) return root.replaceChildren(h('p', { class: 'error' }, errorText(error)));
  const values = Object.fromEntries((data ?? []).map((r) => [r.cheie, { ...r.valoare }]));

  const cards = Object.entries(SETTINGS).map(([key, def]) => {
    values[key] ??= {};
    return h('form', {
      class: 'card settings-card',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const bad = def.fields.find(([k, , t]) => t === 'url' && values[key][k] && !/^https?:\/\//.test(values[key][k]));
        if (bad) return toast(`„${bad[1]}” trebuie să înceapă cu https://`, 'error');
        const { error } = await supabase.from('setari').upsert({ cheie: key, valoare: values[key] });
        error ? toast(errorText(error), 'error') : toast(`${def.title}: salvat.`);
      },
    },
      h('h2', {}, def.title),
      key !== 'contact' ? h('p', { class: 'muted' }, 'Câmpurile goale nu apar pe site.') : null,
      ...def.fields.map(([k, label, type]) => {
        const attrs = { class: 'input', value: values[key][k] ?? '', oninput: (e: Event) => { values[key][k] = (e.target as HTMLInputElement).value.trim(); } };
        return h('div', { class: 'field' }, h('label', {}, label),
          type === 'textarea' ? h('textarea', { ...attrs, rows: 3 }) : h('input', { ...attrs, type: type ?? 'text' }));
      }),
      h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvează')),
    );
  });

  root.replaceChildren(head('Setări site'), h('p', { class: 'muted' }, 'Modificările apar pe site după reconstruirea de noapte.'), ...cards);
}

// ───────────── Trash ─────────────
const TRASH_TABLES: Record<string, [string, (r: any) => string]> = {
  proiecte: ['Proiect', (r) => r.titlu], noutati: ['Noutate', (r) => r.titlu], echipa: ['Membru echipă', (r) => r.nume],
  voluntari: ['Voluntar', (r) => r.nume], parteneri: ['Partener', (r) => r.nume], galerie: ['Fotografie', (r) => r.titlu || '(fără titlu)'],
  mesaje: ['Mesaj', (r) => `${r.nume} <${r.email}>`],
};

export async function renderCos(root: HTMLElement) {
  root.replaceChildren(loading());
  const results = await Promise.all(Object.keys(TRASH_TABLES).map((t) =>
    supabase.from(t).select('*').not('sters_la', 'is', null).then(({ data, error }) => ({ t, data: data ?? [], error }))));
  const failed = results.find((r) => r.error);
  if (failed) return root.replaceChildren(h('p', { class: 'error' }, errorText(failed.error)));

  const items = results.flatMap(({ t, data }) => data.map((r) => ({ t, r }))).sort((a, b) => b.r.sters_la.localeCompare(a.r.sters_la));
  const list = h('ul', { class: 'item-list' }, ...items.map(({ t, r }) => {
    const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(r.sters_la).getTime()) / 86_400_000));
    const li = h('li', { class: 'item' },
      h('div', { class: 'item-text' },
        h('strong', {}, TRASH_TABLES[t][1](r)),
        h('span', { class: 'muted' }, `${TRASH_TABLES[t][0]} · șters ${fmtDate(r.sters_la)} · se șterge definitiv în ${daysLeft} zile`),
      ),
      h('div', { class: 'item-actions' },
        h('button', {
          class: 'btn btn-sm', onclick: async () => {
            const { error } = await supabase.from(t).update({ sters_la: null }).eq('id', r.id);
            if (error) return toast(errorText(error), 'error');
            li.remove(); toast('Restaurat.');
          },
        }, 'Restaurează'),
        h('button', {
          class: 'btn btn-sm btn-danger-outline', onclick: async () => {
            if (!(await confirmDialog('Ștergi definitiv? Acțiunea nu poate fi anulată.', 'Șterge definitiv'))) return;
            const { error } = await supabase.from(t).delete().eq('id', r.id);
            if (error) return toast(errorText(error), 'error');
            li.remove(); toast('Șters definitiv.');
          },
        }, 'Șterge definitiv'),
      ),
    );
    return li;
  }));
  if (!items.length) list.append(h('li', { class: 'empty' }, 'Coșul este gol.'));
  root.replaceChildren(head('Coș'), h('p', { class: 'muted' }, 'Elementele șterse rămân aici 30 de zile, apoi sunt șterse automat.'), list);
}

// ───────────── Activity log ─────────────
const ACTIONS: Record<string, string> = { creare: 'a adăugat', modificare: 'a modificat', stergere: 'a mutat în coș', restaurare: 'a restaurat', stergere_definitiva: 'a șters definitiv' };
const TABLE_NAMES: Record<string, string> = {
  proiecte: 'proiectul', noutati: 'articolul', echipa: 'membrul echipei', voluntari: 'voluntarul', parteneri: 'partenerul', galerie: 'fotografia',
  mesaje: 'mesajul de la', setari: 'setările', setari_formulare: 'formularul', admini: 'administratorul',
};

export async function renderJurnal(root: HTMLElement) {
  root.replaceChildren(loading());
  const { data, error } = await supabase.from('jurnal').select('*').order('creat_la', { ascending: false }).limit(300);
  if (error) return root.replaceChildren(h('p', { class: 'error' }, errorText(error)));
  const list = h('ul', { class: 'item-list log' }, ...(data ?? []).map((r) => h('li', { class: 'item' },
    h('div', { class: 'item-text' },
      h('span', {}, h('strong', {}, r.email), ` ${ACTIONS[r.actiune] ?? r.actiune} ${TABLE_NAMES[r.tabel] ?? r.tabel} `, h('em', {}, r.rezumat ?? '')),
      h('span', { class: 'muted' }, fmtDate(r.creat_la)),
    ),
  )));
  if (!data?.length) list.append(h('li', { class: 'empty' }, 'Nicio activitate încă.'));
  root.replaceChildren(head('Jurnal activitate'), h('p', { class: 'muted' }, 'Ultimele 300 de acțiuni ale administratorilor.'), list);
}

// ───────────── Admins ─────────────
export async function renderAdmini(root: HTMLElement, myEmail: string) {
  root.replaceChildren(loading());
  const { data, error } = await supabase.from('admini').select('*').order('creat_la');
  if (error) return root.replaceChildren(h('p', { class: 'error' }, errorText(error)));

  const email = h('input', { type: 'email', class: 'input', placeholder: 'email@exemplu.ro', required: true, 'aria-label': 'Email administrator nou' });
  root.replaceChildren(
    head('Administratori'),
    h('div', { class: 'card' },
      h('p', {}, 'Pentru a adăuga un administrator:'),
      h('ol', {},
        h('li', {}, 'În Supabase → Authentication → Users → Add user, creează contul (email + parolă, bifează „Auto confirm”).'),
        h('li', {}, 'Adaugă aici același email.'),
      ),
      h('form', {
        class: 'inline-form',
        onsubmit: async (e: Event) => {
          e.preventDefault();
          const { error } = await supabase.from('admini').insert({ email: email.value.trim().toLowerCase() });
          if (error) return toast(errorText(error), 'error');
          toast('Administrator adăugat.');
          renderAdmini(root, myEmail);
        },
      }, email, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Adaugă')),
    ),
    h('ul', { class: 'item-list' }, ...(data ?? []).map((r) => h('li', { class: 'item' },
      h('div', { class: 'item-text' }, h('strong', {}, r.email), h('span', { class: 'muted' }, `adăugat ${fmtDate(r.creat_la)}`)),
      r.email === myEmail ? h('span', { class: 'badge' }, 'Tu') : h('div', { class: 'item-actions' }, h('button', {
        class: 'btn btn-sm btn-danger-outline',
        onclick: async () => {
          if (!(await confirmDialog(`Elimini accesul pentru ${r.email}? Contul rămâne în Supabase, dar nu mai poate modifica nimic.`, 'Elimină'))) return;
          const { error } = await supabase.from('admini').delete().eq('email', r.email);
          if (error) return toast(errorText(error), 'error');
          renderAdmini(root, myEmail);
        },
      }, 'Elimină')),
    ))),
  );
}
