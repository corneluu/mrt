import { defineCollection, z } from 'astro:content';

const proiecte = defineCollection({
  type: 'content',
  schema: z.object({
    titlu: z.string(),
    descriere: z.string(),
    imagine: z.string(),
    categorie: z.enum(['educatie', 'sanatate', 'comunitate', 'social', 'tineret']),
    status: z.enum(['activ', 'finalizat', 'planificat']),
    dataStart: z.date(),
    dataFinal: z.date().optional(),
    beneficiari: z.number().optional(),
    locatie: z.string().optional(),
    parteneri: z.array(z.string()).optional(),
  }),
});

const noutati = defineCollection({
  type: 'content',
  schema: z.object({
    titlu: z.string(),
    descriere: z.string(),
    imagine: z.string(),
    data: z.date(),
    autor: z.string().default('Echipa MRT'),
    categorie: z.enum(['eveniment', 'stire', 'raport', 'comunitate']),
    tags: z.array(z.string()).optional(),
  }),
});

const parteneri = defineCollection({
  type: 'data',
  schema: z.object({
    nume: z.string(),
    logo: z.string(),
    website: z.string().url().optional(),
    tip: z.enum(['partener', 'sponsor', 'institutional']),
    descriere: z.string().optional(),
    ordine: z.number().default(0),
  }),
});

const echipa = defineCollection({
  type: 'data',
  schema: z.object({
    nume: z.string(),
    rol: z.string(),
    imagine: z.string().optional(),
    bio: z.string().optional(),
    ordine: z.number().default(0),
  }),
});

export const collections = { proiecte, noutati, parteneri, echipa };
