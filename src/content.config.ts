import { defineCollection, z } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { selectRows } from './utils/supabase';

// Content lives in Supabase (edited from the admin page) and is pulled in at build time.
// `map` turns a DB row into the collection's data; `html` is the rich-text body, if any.
function supabaseLoader(
  table: string,
  order: string,
  map: (row: any) => Record<string, unknown>,
  html?: (row: any) => string,
): Loader {
  return {
    name: `supabase-${table}`,
    load: async ({ store, parseData }) => {
      store.clear();
      for (const row of await selectRows(table, `select=*&order=${order}`)) {
        const id = row.slug ?? row.id;
        const data = await parseData({ id, data: map(row) });
        store.set({ id, data, ...(html && { rendered: { html: html(row) } }) });
      }
    },
  };
}

const proiecte = defineCollection({
  loader: supabaseLoader('proiecte', 'data_start.desc', r => ({
    titlu: r.titlu,
    descriere: r.descriere,
    imagine: r.imagine,
    categorie: r.categorie,
    status: r.status,
    dataStart: r.data_start,
    dataFinal: r.data_final ?? undefined,
    beneficiari: r.beneficiari ?? undefined,
    locatie: r.locatie ?? undefined,
    parteneri: r.parteneri?.length ? r.parteneri : undefined,
  }), r => r.continut),
  schema: z.object({
    titlu: z.string(),
    descriere: z.string(),
    imagine: z.string(),
    categorie: z.enum(['educatie', 'sanatate', 'comunitate', 'social', 'tineret']),
    status: z.enum(['activ', 'finalizat', 'planificat']),
    dataStart: z.coerce.date(),
    dataFinal: z.coerce.date().optional(),
    beneficiari: z.number().optional(),
    locatie: z.string().optional(),
    parteneri: z.array(z.string()).optional(),
  }),
});

const noutati = defineCollection({
  loader: supabaseLoader('noutati', 'data.desc', r => ({
    titlu: r.titlu,
    descriere: r.descriere,
    imagine: r.imagine,
    data: r.data,
    autor: r.autor,
    categorie: r.categorie,
    tags: r.tags?.length ? r.tags : undefined,
  }), r => r.continut),
  schema: z.object({
    titlu: z.string(),
    descriere: z.string(),
    imagine: z.string(),
    data: z.coerce.date(),
    autor: z.string().default('Echipa MRT'),
    categorie: z.enum(['eveniment', 'stire', 'raport', 'comunitate']),
    tags: z.array(z.string()).optional(),
  }),
});

const parteneri = defineCollection({
  loader: supabaseLoader('parteneri', 'ordine', r => ({
    nume: r.nume,
    logo: r.logo,
    website: r.website ?? undefined,
    tip: r.tip,
    descriere: r.descriere ?? undefined,
    ordine: r.ordine,
  })),
  schema: z.object({
    nume: z.string(),
    logo: z.string(),
    website: z.string().url().optional(),
    tip: z.enum(['partener', 'sponsor', 'institutional']),
    descriere: z.string().optional(),
    ordine: z.number().default(0),
  }),
});

const persoana = (r: any) => ({
  nume: r.nume,
  rol: r.rol,
  imagine: r.imagine ?? undefined,
  bio: r.bio ?? undefined,
  ordine: r.ordine,
});

const persoanaSchema = z.object({
  nume: z.string(),
  rol: z.string(),
  imagine: z.string().optional(),
  bio: z.string().optional(),
  ordine: z.number().default(0),
});

const echipa = defineCollection({ loader: supabaseLoader('echipa', 'ordine', persoana), schema: persoanaSchema });
const voluntari = defineCollection({ loader: supabaseLoader('voluntari', 'ordine', persoana), schema: persoanaSchema });

const galerie = defineCollection({
  loader: supabaseLoader('galerie', 'ordine', r => ({ src: r.imagine, alt: r.alt, titlu: r.titlu, ordine: r.ordine })),
  schema: z.object({
    src: z.string(),
    alt: z.string(),
    titlu: z.string(),
    ordine: z.number(),
  }),
});

export const collections = { proiecte, noutati, parteneri, echipa, voluntari, galerie };
