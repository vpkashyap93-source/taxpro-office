export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(sp: SearchParams): Promise<Record<string, string | undefined>> {
  const raw = await sp;
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export function matches(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}
