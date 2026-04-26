/**
 * Normalizes a string to a URL-safe slug.
 * Mirrors the server-side normalize_slug() Postgres function so client and DB agree.
 */
export const toSlug = (val: string): string =>
  val
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

export const capitalize = (val: string): string =>
  val
    .split('-')
    .map((p) => (p.length ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');