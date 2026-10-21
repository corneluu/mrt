// Generic list + edit form for the content tables, driven by field definitions.
import Quill from 'quill';
import Sortable from 'sortablejs';
import { supabase, uploadImage } from './supabase';
import { h, toast, confirmDialog, errorText, imgSrc, slugify, loading } from './ui';

export type Field = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'richtext' | 'image' | 'date' | 'select' | 'number' | 'tags' | 'checkbox' | 'slug' | 'url';
  required?: boolean;
  options?: [string, string][];
  help?: string;
  slugFrom?: string;
  default?: unknown;
};

export type CrudConfig = {
  table: string;
  title: string;
  singular: string;
  fields: Field[];
  order: { column: string; ascending: boolean };
  sortable?: boolean;       // drag & drop reordering via the `ordine` column
  multiUpload?: boolean;    // gallery: add many photos at once
  row: (r: any) => { title: string; subtitle?: string; image?: string };
};

export async function renderCrud(root: HTMLElement, cfg: CrudConfig) {
  root.replaceChildren(loading());
  const { data, error } = await supabase
    .from(cfg.table).select('*').is('sters_la', null)
    .order(cfg.order.column, { ascending: cfg.order.ascending });
  if (error) { root.replaceChildren(h('p', { class: 'error' }, errorText(error))); return; }
  let rows = data ?? [];

  const list = h('ul', { class: `item-list ${cfg.multiUpload ? 'item-grid' : ''}` });
  const search = h('input', { type: 'search', class: 'input', placeholder: 'Caută…', 'aria-label': 'Caută' });

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren(...rows
      .filter((r) => !q || JSON.stringify(cfg.row(r)).toLowerCase().includes(q))
      .map((r) => {
        const v = cfg.row(r);
        return h('li', { class: 'item', 'data-id': r.id },
          cfg.sortable && !q ? h('span', { class: 'drag-handle', title: 'Trage pentru a reordona', 'aria-hidden': 'true' }, '⋮⋮') : null,
          v.image !== undefined ? h('img', { class: 'thumb', src: imgSrc(v.image), alt: '', loading: 'lazy' }) : null,
          h('div', { class: 'item-text' },
            h('strong', {}, v.title || '(fără titlu)'),
            v.subtitle ? h('span', { class: 'muted' }, v.subtitle) : null,
            r.publicat === false ? h('span', { class: 'badge' }, 'Ciornă') : null,
          ),
          h('div', { class: 'item-actions' },
            h('button', { class: 'btn btn-sm', onclick: () => renderForm(root, cfg, r) }, 'Editează'),
            h('button', {
              class: 'btn btn-sm btn-danger-outline',
              onclick: async () => {
                if (!(await confirmDialog(`Muți „${v.title}” în coș? Îl poți restaura timp de 30 de zile.`, 'Mută în coș'))) return;
                const { error } = await supabase.from(cfg.table).update({ sters_la: new Date().toISOString() }).eq('id', r.id);
                if (error) return toast(errorText(error), 'error');
                rows = rows.filter((x) => x.id !== r.id);
                draw();
                toast('Mutat în coș.');
              },
            }, 'Șterge'),
          ),
        );
      }));
    if (!list.children.length) list.append(h('li', { class: 'empty' }, q ? 'Niciun rezultat.' : 'Nu există încă nimic aici.'));
  };
  search.addEventListener('input', draw);
  draw();

  if (cfg.sortable) {
    Sortable.create(list, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: async () => {
        const ids = [...list.querySelectorAll<HTMLElement>('[data-id]')].map((el) => el.dataset.id!);
        rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        const results = await Promise.all(ids.map((id, i) => supabase.from(cfg.table).update({ ordine: i + 1 }).eq('id', id)));
        const failed = results.find((r) => r.error);
        failed ? toast(errorText(failed.error), 'error') : toast('Ordinea a fost salvată.');
      },
    });
  }

  const multi = cfg.multiUpload ? h('label', { class: 'btn btn-primary' },
    '＋ Încarcă fotografii',
    h('input', {
      type: 'file', accept: 'image/*', multiple: true, hidden: true,
      onchange: async (e: Event) => {
        const files = [...((e.target as HTMLInputElement).files ?? [])];
        let ordine = Math.max(0, ...rows.map((r) => r.ordine ?? 0));
        for (const [i, file] of files.entries()) {
          toast(`Se încarcă ${i + 1}/${files.length}…`);
          try {
            const url = await uploadImage(file, cfg.table);
            const { data, error } = await supabase.from(cfg.table).insert({ imagine: url, ordine: ++ordine }).select().single();
            if (error) throw error;
            rows.push(data);
          } catch (err) {
            toast(`${file.name}: ${errorText(err)}`, 'error');
          }
        }
        draw();
        toast('Fotografiile au fost adăugate. Adaugă titluri din „Editează”.');
      },
    }),
  ) : null;

  root.replaceChildren(
    h('div', { class: 'page-head' },
      h('h1', {}, cfg.title),
      h('div', { class: 'page-actions' },
        multi ?? h('button', { class: 'btn btn-primary', onclick: () => renderForm(root, cfg, null) }, `＋ Adaugă ${cfg.singular}`),
      ),
    ),
    h('div', { class: 'toolbar' }, search, cfg.sortable ? h('span', { class: 'muted hint' }, 'Trage de ⋮⋮ pentru a schimba ordinea.') : null),
    list,
  );
}

function renderForm(root: HTMLElement, cfg: CrudConfig, row: any | null) {
  const isNew = !row;
  const values: Record<string, any> = { ...(row ?? {}) };
  const getters: Record<string, () => any> = {};
  let slugTouched = !isNew;

  const fieldEls = cfg.fields.map((f) => {
    const id = `f-${f.name}`;
    const current = values[f.name] ?? f.default ?? (f.type === 'tags' ? [] : f.type === 'checkbox' ? true : '');
    let control: HTMLElement;

    switch (f.type) {
      case 'textarea': {
        const el = h('textarea', { id, class: 'input', rows: 4, value: current ?? '' });
        getters[f.name] = () => el.value.trim();
        control = el;
        break;
      }
      case 'richtext': {
        const holder = h('div', { class: 'richtext' });
        control = h('div', { class: 'richtext-wrap' }, holder);
        // Quill needs the element in the DOM; initialise right after render.
        queueMicrotask(() => {
          const quill = new Quill(holder, {
            theme: 'snow',
            placeholder: 'Scrie conținutul aici…',
            modules: {
              toolbar: {
                container: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image', 'blockquote'], ['clean']],
                handlers: {
                  image: () => {
                    const input = h('input', { type: 'file', accept: 'image/*' });
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      try {
                        toast('Se încarcă imaginea…');
                        const url = await uploadImage(file, cfg.table);
                        const at = quill.getSelection(true)?.index ?? quill.getLength();
                        quill.insertEmbed(at, 'image', url, 'user');
                      } catch (err) { toast(errorText(err), 'error'); }
                    };
                    input.click();
                  },
                },
              },
            },
          });
          quill.clipboard.dangerouslyPasteHTML(current ?? '');
          getters[f.name] = () => (quill.getText().trim() ? quill.getSemanticHTML() : '');
        });
        getters[f.name] = () => current ?? '';
        break;
      }
      case 'image': {
        let url: string = current ?? '';
        const preview = h('img', { class: 'image-preview', alt: '', src: imgSrc(url), hidden: !url });
        const status = h('span', { class: 'muted' });
        const remove = h('button', {
          type: 'button', class: 'btn btn-sm', hidden: !url,
          onclick: () => { url = ''; preview.hidden = true; remove.hidden = true; },
        }, 'Elimină');
        const input = h('input', {
          type: 'file', accept: 'image/*', id, class: 'file-input',
          onchange: async () => {
            const file = input.files?.[0];
            if (!file) return;
            status.textContent = 'Se încarcă…';
            try {
              url = await uploadImage(file, cfg.table);
              preview.src = url; preview.hidden = false; remove.hidden = false;
              status.textContent = '';
            } catch (err) { status.textContent = ''; toast(errorText(err), 'error'); }
          },
        });
        getters[f.name] = () => url;
        control = h('div', { class: 'image-field' }, preview, h('div', { class: 'image-buttons' }, input, remove, status));
        break;
      }
      case 'select': {
        const el = h('select', { id, class: 'input' }, ...(f.options ?? []).map(([v, l]) => h('option', { value: v, selected: v === current }, l)));
        getters[f.name] = () => el.value;
        control = el;
        break;
      }
      case 'checkbox': {
        const el = h('input', { id, type: 'checkbox', checked: !!current });
        getters[f.name] = () => el.checked;
        control = h('label', { class: 'check' }, el, f.help ?? '');
        break;
      }
      case 'tags': {
        const el = h('input', { id, class: 'input', value: (current ?? []).join(', '), placeholder: 'separate prin virgulă' });
        getters[f.name] = () => el.value.split(',').map((s) => s.trim()).filter(Boolean);
        control = el;
        break;
      }
      case 'number': {
        const el = h('input', { id, type: 'number', class: 'input', min: 0, value: current ?? '' });
        getters[f.name] = () => (el.value === '' ? null : Number(el.value));
        control = el;
        break;
      }
      default: {
        const type = f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text';
        const el = h('input', { id, type, class: 'input', value: current ?? '' });
        if (f.type === 'slug') el.addEventListener('input', () => { slugTouched = true; });
        getters[f.name] = () => (f.type === 'slug' ? slugify(el.value) : el.value.trim());
        control = el;
        if (f.type === 'slug') queueMicrotask(() => {
          const src = root.querySelector<HTMLInputElement>(`#f-${f.slugFrom}`);
          src?.addEventListener('input', () => { if (!slugTouched) el.value = slugify(src.value); });
        });
      }
    }

    return h('div', { class: `field field-${f.type}` },
      f.type !== 'checkbox' ? h('label', { for: id }, f.label, f.required ? h('span', { class: 'req' }, ' *') : null) : h('span', { class: 'field-label' }, f.label),
      control,
      f.help && f.type !== 'checkbox' ? h('small', { class: 'muted' }, f.help) : null,
    );
  });

  const saveBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvează');
  const form = h('form', {
    class: 'edit-form',
    onsubmit: async (e: Event) => {
      e.preventDefault();
      const payload: Record<string, any> = {};
      for (const f of cfg.fields) {
        let v = getters[f.name]();
        // Empty dates/numbers/links/images are stored as NULL; empty text stays '' (some text columns are NOT NULL).
        if (v === '' && ['date', 'number', 'url', 'image'].includes(f.type)) v = null;
        if (f.required && (v === '' || v === null || (Array.isArray(v) && !v.length))) {
          return toast(`Câmpul „${f.label}” este obligatoriu.`, 'error');
        }
        payload[f.name] = v;
      }
      saveBtn.disabled = true;
      const q = isNew ? supabase.from(cfg.table).insert(payload) : supabase.from(cfg.table).update(payload).eq('id', row.id);
      const { error } = await q;
      saveBtn.disabled = false;
      if (error) return toast(errorText(error), 'error');
      toast(isNew ? 'Adăugat. Apare pe site după reconstruirea de noapte.' : 'Salvat. Apare pe site după reconstruirea de noapte.');
      renderCrud(root, cfg);
    },
  },
    ...fieldEls,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => renderCrud(root, cfg) }, 'Înapoi'),
      saveBtn,
    ),
  );

  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, isNew ? `${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} nou` : `Editează: ${cfg.row(row).title || ''}`)),
    form,
  );
  window.scrollTo(0, 0);
}
