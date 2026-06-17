// Country classification per AGENTS.md "Event log schema → country".
//
// The mapping is encoded as data (not control flow) so that adjusting the
// buckets — adding a new country to ENG, splitting EUR, etc. — is a one-line
// change to the table below. `classifyCountry` is purely derived from it.

interface CountryClassDef {
  /** Display label for the class, used in dropdowns and the chart legend. */
  label: string
  /** Raw 2-letter ISO country codes that roll up into this class. */
  members: readonly string[]
}

// Order matters for UI display: classes appear in dropdowns in this order.
const COUNTRY_CLASS_DEFS: readonly CountryClassDef[] = [
  { label: 'ENG', members: ['us', 'ca', 'gb', 'ie', 'au', 'nz'] },
  { label: 'kr', members: ['kr'] },
  { label: 'tw', members: ['tw'] },
  { label: 'jp', members: ['jp'] },
  {
    label: 'EUR',
    members: [
      'fr', 'de', 'za', 'tr', 'nl', 'it', 'pl', 'ua', 'se', 'es',
      'ro', 'fi', 'ch', 'cz', 'be', 'at', 'pt', 'hu',
    ],
  },
  { label: 'Other', members: [] }, // catch-all; populated implicitly
]

const RAW_TO_CLASS = new Map<string, string>()
for (const def of COUNTRY_CLASS_DEFS) {
  for (const member of def.members) RAW_TO_CLASS.set(member, def.label)
}

/** Map a raw 2-letter ISO country code to its display class. */
export function classifyCountry(raw: string | null | undefined): string {
  if (!raw) return 'Other'
  return RAW_TO_CLASS.get(raw.toLowerCase()) ?? 'Other'
}

/** All country classes in canonical display order (suitable for dropdowns). */
export const COUNTRY_CLASSES: readonly string[] = COUNTRY_CLASS_DEFS.map(
  (d) => d.label,
)
