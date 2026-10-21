// Field definitions for each editable content table (columns from supabase/migrations).
import type { CrudConfig, Field } from './crud';

const publicat: Field = { name: 'publicat', label: 'Vizibilitate', type: 'checkbox', default: true, help: 'Publicat pe site (debifează pentru ciornă)' };

const persoana = (table: string, title: string, singular: string): CrudConfig => ({
  table, title, singular,
  order: { column: 'ordine', ascending: true },
  sortable: true,
  fields: [
    { name: 'nume', label: 'Nume', type: 'text', required: true },
    { name: 'rol', label: 'Rol', type: 'text', required: true },
    { name: 'imagine', label: 'Fotografie', type: 'image', help: 'Fără fotografie se afișează inițialele.' },
    { name: 'bio', label: 'Descriere scurtă', type: 'textarea' },
    publicat,
  ],
  row: (r) => ({ title: r.nume, subtitle: r.rol, image: r.imagine ?? '' }),
});

export const proiecte: CrudConfig = {
  table: 'proiecte', title: 'Proiecte', singular: 'proiect',
  order: { column: 'data_start', ascending: false },
  fields: [
    { name: 'titlu', label: 'Titlu', type: 'text', required: true },
    { name: 'slug', label: 'Link (slug)', type: 'slug', required: true, slugFrom: 'titlu', help: 'Apare în adresa paginii: /proiecte/<slug>/. Se completează singur din titlu.' },
    { name: 'descriere', label: 'Descriere scurtă', type: 'textarea', required: true, help: 'Apare pe cardul proiectului și în Google.' },
    { name: 'imagine', label: 'Imagine principală', type: 'image', required: true },
    { name: 'continut', label: 'Conținut', type: 'richtext' },
    { name: 'categorie', label: 'Categorie', type: 'select', required: true, options: [['social', 'Social'], ['educatie', 'Educație'], ['sanatate', 'Sănătate'], ['comunitate', 'Comunitate'], ['tineret', 'Tineret']] },
    { name: 'status', label: 'Stare', type: 'select', required: true, options: [['activ', 'Activ'], ['planificat', 'Planificat'], ['finalizat', 'Finalizat']] },
    { name: 'data_start', label: 'Data de început', type: 'date', required: true },
    { name: 'data_final', label: 'Data de final', type: 'date' },
    { name: 'beneficiari', label: 'Număr beneficiari', type: 'number' },
    { name: 'locatie', label: 'Locație', type: 'text' },
    { name: 'parteneri', label: 'Parteneri', type: 'tags' },
    publicat,
  ],
  row: (r) => ({ title: r.titlu, subtitle: `${r.status} · ${r.data_start}`, image: r.imagine }),
};

export const noutati: CrudConfig = {
  table: 'noutati', title: 'Noutăți', singular: 'articol',
  order: { column: 'data', ascending: false },
  fields: [
    { name: 'titlu', label: 'Titlu', type: 'text', required: true },
    { name: 'slug', label: 'Link (slug)', type: 'slug', required: true, slugFrom: 'titlu', help: 'Apare în adresa paginii: /noutati/<slug>/.' },
    { name: 'descriere', label: 'Rezumat', type: 'textarea', required: true },
    { name: 'imagine', label: 'Imagine principală', type: 'image', required: true },
    { name: 'continut', label: 'Conținut', type: 'richtext' },
    { name: 'data', label: 'Data publicării', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { name: 'autor', label: 'Autor', type: 'text', required: true, default: 'Echipa MRT' },
    { name: 'categorie', label: 'Categorie', type: 'select', required: true, options: [['stire', 'Știre'], ['eveniment', 'Eveniment'], ['raport', 'Raport'], ['comunitate', 'Comunitate']] },
    { name: 'tags', label: 'Etichete', type: 'tags' },
    publicat,
  ],
  row: (r) => ({ title: r.titlu, subtitle: r.data, image: r.imagine }),
};

export const echipa = persoana('echipa', 'Echipa noastră', 'membru');
export const voluntari = persoana('voluntari', 'Voluntari', 'voluntar');

export const parteneri: CrudConfig = {
  table: 'parteneri', title: 'Parteneri', singular: 'partener',
  order: { column: 'ordine', ascending: true },
  sortable: true,
  fields: [
    { name: 'nume', label: 'Nume', type: 'text', required: true },
    { name: 'logo', label: 'Logo', type: 'image', required: true },
    { name: 'website', label: 'Website', type: 'url', help: 'Adresa completă, cu https://' },
    { name: 'tip', label: 'Tip', type: 'select', required: true, options: [['partener', 'Partener'], ['sponsor', 'Sponsor'], ['institutional', 'Instituțional']] },
    { name: 'descriere', label: 'Descriere', type: 'textarea' },
    publicat,
  ],
  row: (r) => ({ title: r.nume, subtitle: r.tip, image: r.logo }),
};

export const galerie: CrudConfig = {
  table: 'galerie', title: 'Galerie foto', singular: 'fotografie',
  order: { column: 'ordine', ascending: true },
  sortable: true,
  multiUpload: true,
  fields: [
    { name: 'imagine', label: 'Fotografie', type: 'image', required: true },
    { name: 'titlu', label: 'Titlu / legendă', type: 'text', help: 'Apare sub fotografie.' },
    { name: 'alt', label: 'Descriere pentru accesibilitate', type: 'text', help: 'Ce se vede în imagine (citit de cititoarele de ecran și de Google).' },
    publicat,
  ],
  row: (r) => ({ title: r.titlu || '(fără titlu)', subtitle: r.alt, image: r.imagine }),
};
