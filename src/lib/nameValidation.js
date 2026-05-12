import BANNED_NAMES from '../data/banned_names.json';

// norm(): uniqueness key — lowercase, strip ALL spaces and underscores.
// "K", "k", "K_", "k__", "k k", "k_k" all → "k"
const norm = (s) => s.toLowerCase().replace(/[\s_]+/g, '');

// toDisplay(): canonical display form — trim, collapse spaces, strip leading/trailing underscores.
// Preserves internal underscores and mixed case.
const toDisplay = (s) => s.trim().replace(/\s+/g, ' ').replace(/^[\s_]+|[\s_]+$/g, '');

// Escape SQL LIKE/ILIKE wildcards so we get a literal match.
const escapeLike = (s) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

// Build lookup structures from the JSON — single source of truth.
const RESERVED_SET  = new Set(BANNED_NAMES.reserved.map(norm));
const BLOCKED_TERMS = BANNED_NAMES.blocked_terms.map(norm);

const ALLOWED_RE = /^[a-zA-Z0-9 _]+$/;
const NUMERIC_RE = /^\d+$/;       // numeric-only after stripping spaces/underscores
const REPEAT_RE  = /(.)\1{3,}/;   // 4+ identical consecutive chars

// Returns an error string, or null if valid.
// currentName: the player's locally saved beta_username (may be empty).
export function validateName(name, currentName = '') {
  // Format checks always apply regardless of ownership
  if (name.length < 1 || name.length > 16) return 'Name must be 1–16 characters.';
  if (!ALLOWED_RE.test(name)) return 'Only letters, numbers, spaces, and underscores.';

  const n  = norm(name);
  const cn = norm(currentName);

  // Current owner bypass — allow keeping their own name even if reserved/blocked
  if (cn && n === cn) return null;

  // Content checks (new name only)
  if (NUMERIC_RE.test(n)) return 'That name is taken.';
  if (REPEAT_RE.test(n))  return 'That name is taken.';
  if (RESERVED_SET.has(n)) return 'That name is taken.';
  for (const term of BLOCKED_TERMS) {
    if (n.includes(term)) return 'That name is taken.';
  }

  return null;
}

// Returns true if the name is already owned by a different player in Supabase.
// Fails silently (returns false) if Supabase is unavailable.
export async function checkNameTaken(supabase, name, currentName) {
  const n  = norm(name);
  const cn = norm(currentName || '');

  if (!supabase) return false;

  // Same normalized name as current — owner re-confirming their own name
  if (cn && n === cn) return false;

  try {
    // Query 1: literal display-name match with SQL wildcards escaped.
    // Catches "K" / "k" / "K " for an input of "K ".
    const display   = toDisplay(name);
    const escaped   = escapeLike(display);
    const { data: d1, error: e1 } = await supabase
      .from('grimfell_players')
      .select('beta_username')
      .ilike('beta_username', escaped)
      .limit(1);

    if (!e1 && d1?.length > 0 && norm(d1[0].beta_username) !== cn) return true;

    // Query 2: normalized string (pure alphanumeric, no wildcards possible).
    // Catches "K" stored in DB when player enters "K_" or "k k" (all norm to same key).
    if (n !== display.toLowerCase()) {
      const { data: d2, error: e2 } = await supabase
        .from('grimfell_players')
        .select('beta_username')
        .ilike('beta_username', n)
        .limit(1);
      if (!e2 && d2?.length > 0 && norm(d2[0].beta_username) !== cn) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Canonical display form — call this before storing beta_username.
export { toDisplay as normDisplay };
