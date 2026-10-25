import { appearancesFromLabel, type Appearance } from './appearance';

/* Expected pill appearance from the FDA drug label database (openFDA).
   Free, no key needed. Lookups try the exact package (NDC) first, then the
   drug name — in which case several manufacturers' pills may be listed. */

export interface FdaResult {
  appearances: Appearance[];
  matchedBy: 'ndc' | 'name';
  labelName: string;
  manufacturer: string;
  url: string;
}

interface LabelDoc {
  how_supplied?: string[];
  spl_product_data_elements?: string[];
  description?: string[];
  openfda?: { brand_name?: string[]; generic_name?: string[]; manufacturer_name?: string[]; spl_set_id?: string[] };
}

const API = 'https://api.fda.gov/drug/label.json';

async function search(q: string, limit: number, signal?: AbortSignal): Promise<LabelDoc[]> {
  const res = await fetch(`${API}?search=${encodeURIComponent(q)}&limit=${limit}`, { signal });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.status === 429 ? 'The FDA database is busy. Try again in a minute.' : `FDA database error (${res.status}).`);
  return ((await res.json()) as { results: LabelDoc[] }).results ?? [];
}

const dailymed = (d: LabelDoc) => {
  const id = d.openfda?.spl_set_id?.[0];
  return id ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${id}` : 'https://dailymed.nlm.nih.gov/dailymed/';
};

/** 11-digit or dashed NDC → the dashed forms openFDA may use. */
export function ndcForms(ndc: string): string[] {
  if (ndc.includes('-')) return [ndc];
  const d = ndc.replace(/\D/g, '');
  if (d.length !== 11) return [];
  // 11-digit (5-4-2) may come from 4-4-2, 5-3-2 or 5-4-1 by a padded zero
  return [`${d.slice(0, 5)}-${d.slice(5, 9)}-${d.slice(9)}`, `${d.slice(1, 5)}-${d.slice(5, 9)}-${d.slice(9)}`, `${d.slice(0, 5)}-${d.slice(6, 9)}-${d.slice(9)}`, `${d.slice(0, 5)}-${d.slice(5, 9)}-${d.slice(10)}`];
}

export async function lookupAppearance(opts: { drug: string; strength: string; ndc?: string; manufacturer?: string }, signal?: AbortSignal): Promise<FdaResult | null> {
  const text = (d: LabelDoc) => [d.how_supplied?.[0], d.spl_product_data_elements?.[0], d.description?.[0]].filter(Boolean).join(' ');

  for (const ndc of opts.ndc ? ndcForms(opts.ndc) : []) {
    const docs = await search(`openfda.package_ndc:"${ndc}"`, 1, signal);
    if (docs[0]) {
      const appearances = appearancesFromLabel(text(docs[0]), opts.strength);
      if (appearances.length) return { appearances, matchedBy: 'ndc', labelName: docs[0].openfda?.generic_name?.[0] ?? opts.drug, manufacturer: docs[0].openfda?.manufacturer_name?.[0] ?? '', url: dailymed(docs[0]) };
    }
  }

  const name = opts.drug.trim().split(/\s+/)[0];
  if (!name) return null;
  const docs = await search(`(openfda.generic_name:"${name}" OR openfda.brand_name:"${name}")`, 25, signal);
  // prefer the manufacturer printed on the bottle, if any
  const mfg = opts.manufacturer?.split(/\s+/)[0]?.toLowerCase();
  const ordered = mfg ? [...docs].sort((a, b) => Number(!!b.openfda?.manufacturer_name?.[0]?.toLowerCase().includes(mfg)) - Number(!!a.openfda?.manufacturer_name?.[0]?.toLowerCase().includes(mfg))) : docs;
  const all: Appearance[] = [];
  let first: LabelDoc | null = null;
  for (const d of ordered) {
    for (const a of appearancesFromLabel(text(d), opts.strength)) {
      if (!all.some((x) => x.imprint === a.imprint && x.colors.join() === a.colors.join())) all.push(a);
      first ??= d;
    }
    if (all.length >= 6) break;
  }
  if (!all.length || !first) return null;
  return { appearances: all, matchedBy: 'name', labelName: first.openfda?.generic_name?.[0] ?? opts.drug, manufacturer: first.openfda?.manufacturer_name?.[0] ?? '', url: dailymed(first) };
}
