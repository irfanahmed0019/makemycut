#!/usr/bin/env node
/**
 * Build-time sitemap generator for MakeMyCut.
 * Queries Supabase for live (district, area) pairs and writes public/sitemap.xml.
 * Runs from the `prebuild` npm script so the deployed sitemap always matches the DB.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import 'dotenv/config';

const SITE = process.env.SITE_URL || 'https://makemycut.vercel.app';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/auth', priority: '0.4', changefreq: 'monthly' },
  { path: '/salon-login', priority: '0.4', changefreq: 'monthly' },
];

async function fetchAreas() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[sitemap] Supabase env vars missing, writing static-only sitemap.');
    return [];
  }
  const url = `${SUPABASE_URL}/rest/v1/barbers?select=district,area&is_deleted=eq.false&district=not.is.null&area=not.is.null`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] Supabase responded ${res.status}; falling back to static.`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn('[sitemap] fetch failed:', err.message);
    return [];
  }
}

function urlEntry(loc, priority, changefreq) {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const main = async () => {
  const rows = await fetchAreas();
  const seenDistricts = new Set();
  const seenAreas = new Set();
  const districtUrls = [];
  const areaUrls = [];

  for (const row of rows) {
    if (!row.district || !row.area) continue;
    if (!seenDistricts.has(row.district)) {
      seenDistricts.add(row.district);
      districtUrls.push(urlEntry(`${SITE}/salons/${row.district}`, '0.8', 'weekly'));
    }
    const areaKey = `${row.district}/${row.area}`;
    if (!seenAreas.has(areaKey)) {
      seenAreas.add(areaKey);
      areaUrls.push(urlEntry(`${SITE}/salons/${row.district}/${row.area}`, '0.7', 'weekly'));
    }
  }

  const staticUrls = STATIC_ROUTES.map((r) => urlEntry(`${SITE}${r.path}`, r.priority, r.changefreq));
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...staticUrls, ...districtUrls, ...areaUrls].join('\n') +
    `\n</urlset>\n`;

  const outPath = resolve(process.cwd(), 'public', 'sitemap.xml');
  writeFileSync(outPath, xml, 'utf8');
  console.log(
    `[sitemap] Wrote ${outPath} — ${STATIC_ROUTES.length} static, ${districtUrls.length} districts, ${areaUrls.length} areas.`,
  );
};

main().catch((err) => {
  console.error('[sitemap] fatal:', err);
  process.exit(0); // never fail the build because of sitemap
});