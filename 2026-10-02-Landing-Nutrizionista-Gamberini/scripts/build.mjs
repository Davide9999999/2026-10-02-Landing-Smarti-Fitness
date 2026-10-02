/* ==========================================================
   Build statico — Dott. Nicolò Gamberini
   Legge gli articoli da WordPress (REST API) e genera il sito in dist/.
   Nessuna dipendenza: richiede Node >= 18.

   Variabili d'ambiente:
     WP_API          endpoint REST (default: sito WordPress attuale)
     SITE_URL        URL pubblico del sito (su Netlify si usa URL in automatico)
     ALLOW_INDEXING  "true" solo in produzione; altrimenti il sito è noindex
   ========================================================== */
import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const WP_API = (process.env.WP_API || "https://www.nutrizionistanicologamberini.it/wp-json/wp/v2").replace(/\/$/, "");
const SITE_URL = (process.env.SITE_URL || process.env.URL || "http://localhost:8080").replace(/\/$/, "");
const INDEXING = process.env.ALLOW_INDEXING === "true";
const BLOG_PATH = "/blog-nutrizione-benessere/";
const FALLBACK_IMG = "/img/2026-10-02-Servizio-Piani-Nutrizionali.jpg";
const BUILD = Date.now().toString(36);

const config = JSON.parse(await readFile(join(ROOT, "scripts", "2026-10-02-Categorie-Blog.json"), "utf8"));
const AREE = config.aree;
const CAT_LABELS = Object.fromEntries(Object.entries(AREE).map(([k, v]) => [k, v.label]));

/* ---------- Utility ---------- */
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", laquo: "«", raquo: "»" };
const decode = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const strip = (h) => decode(String(h).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const fill = (tpl, data) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in data ? data[k] : m));
const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const postUrl = (p) => `/${p.slug}/`;
const abs = (u) => (/^https?:/.test(u) ? u : SITE_URL + u);

function cleanHtml(h) {
  return h
    .replace(/\s(class|style|id|srcset|sizes|decoding|fetchpriority|width|height|loading|data-[\w-]+)="[^"]*"/g, "")
    .replace(/<img /g, '<img loading="lazy" ')
    .replace(/<a (?![^>]*target=)/g, '<a target="_blank" rel="noopener" ')
    .replace(/<\/?div>/g, "")
    .replace(/<p>\s*(&nbsp;)?\s*<\/p>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/* ---------- Fetch WordPress ---------- */
async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "gamberini-static-build" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
  return { data: await res.json(), pages: +res.headers.get("x-wp-totalpages") || 1 };
}
async function fetchPosts() {
  const all = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const r = await fetchJson(`${WP_API}/posts?per_page=100&page=${page}&_embed=wp:featuredmedia,wp:term&status=publish`);
    total = r.pages;
    all.push(...r.data);
  }
  return all;
}

const unmapped = new Set();
function toPost(x) {
  const terms = (x._embedded?.["wp:term"]?.[0] || []).map((t) => decode(t.name));
  const cats = Object.keys(AREE).filter((k) => terms.some((t) => AREE[k].categorie.includes(t)));
  terms.forEach((t) => {
    if (!config.ignora.includes(t) && !Object.values(AREE).some((a) => a.categorie.includes(t))) unmapped.add(t);
  });
  const media = x._embedded?.["wp:featuredmedia"]?.[0];
  const sizes = media?.media_details?.sizes || {};
  const full = media?.source_url || "";
  const card = sizes["ocean-thumb-ml"]?.source_url || sizes.medium_large?.source_url || full || FALLBACK_IMG;
  const hero = sizes.large?.source_url || sizes["1536x1536"]?.source_url || full || FALLBACK_IMG;
  const words = strip(x.content.rendered).split(" ").length;
  let excerpt = strip(x.excerpt.rendered).replace(/^Intro\s*/, "").replace(/\s*\[…\]$/, "…");
  if (excerpt.length > 190) excerpt = excerpt.slice(0, 190).trimEnd() + "…";
  return {
    slug: x.slug,
    title: decode(x.title.rendered),
    date: x.date.slice(0, 10),
    modified: x.modified.slice(0, 10),
    cats: cats.length ? cats : ["benessere"],
    tags: terms.filter((t) => !["Uncategorized", "Senza categoria"].includes(t)),
    img: card,
    hero,
    min: Math.max(1, Math.round(words / 200)),
    excerpt,
    html: cleanHtml(x.content.rendered)
  };
}

/* ---------- Componenti ---------- */
function card(p, featured = false) {
  const cat = p.cats[0];
  return `<a class="post${featured ? " post--featured" : ""} reveal" href="${postUrl(p)}">` +
    `<div class="post__img"><img src="${esc(p.img)}" alt="" loading="lazy"></div>` +
    `<div class="post__body"><div class="post__meta"><span class="chip" data-cat="${cat}">${esc(CAT_LABELS[cat])}</span>` +
    `<span>${fmtDate(p.date)}</span><span aria-hidden="true">·</span><span>${p.min} min</span></div>` +
    `<h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><span class="post__more">Leggi l'articolo →</span></div></a>`;
}
const countIn = (posts, k) => posts.filter((p) => p.cats.includes(k)).length;

function related(post, posts) {
  const main = post.cats[0];
  return posts.filter((p) => p.slug !== post.slug).map((p) => {
    let s = 0;
    p.cats.forEach((c) => { if (post.cats.includes(c)) s += c === main ? 3 : 1; });
    p.tags.forEach((t) => { if (post.tags.includes(t) && t !== "Alimentazione") s += 2; });
    return { p, s };
  }).sort((a, b) => b.s - a.s || (a.p.date < b.p.date ? 1 : -1)).slice(0, 3).map((r) => r.p);
}

const ORG = {
  "@type": "ProfessionalService",
  name: "Dott. Nicolò Gamberini — Biologo Nutrizionista",
  url: SITE_URL + "/",
  image: abs("/img/2026-10-02-Gamberini-Ritratto.jpg"),
  telephone: "+39 3715912105",
  email: "nutrizionista.gamberini@gmail.com",
  vatID: "02769780020",
  address: { "@type": "PostalAddress", streetAddress: "Via Carso 2", addressLocality: "Biella", addressRegion: "BI", addressCountry: "IT" },
  sameAs: ["https://www.instagram.com/dr_gamberini_nutrizionista/", "https://www.linkedin.com/in/nicol%C3%B2-gamberini/"]
};
const AUTHOR = { "@type": "Person", name: "Nicolò Gamberini", jobTitle: "Biologo Nutrizionista", url: SITE_URL + "/#chi-sono" };
const jsonld = (o) => JSON.stringify({ "@context": "https://schema.org", ...o }).replace(/</g, "\\u003c");

/* ---------- Build ---------- */
const t0 = Date.now();
console.log(`→ WordPress: ${WP_API}`);
console.log(`→ Sito: ${SITE_URL} · indicizzazione ${INDEXING ? "ATTIVA" : "disattivata (noindex)"}`);

const posts = (await fetchPosts()).map(toPost).sort((a, b) => (a.date < b.date ? 1 : -1));
if (!posts.length) throw new Error("Nessun articolo ricevuto da WordPress: build interrotto per non pubblicare un blog vuoto.");

const layout = await readFile(join(SRC, "partials", "layout.html"), "utf8");
const tpl = {
  home: await readFile(join(SRC, "pages", "home.html"), "utf8"),
  blog: await readFile(join(SRC, "pages", "blog.html"), "utf8"),
  article: await readFile(join(SRC, "pages", "article.html"), "utf8")
};

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await cp(join(SRC, "assets"), DIST, { recursive: true });

async function page(path, d) {
  const html = fill(layout, {
    robots: INDEXING ? "" : '<meta name="robots" content="noindex, nofollow">',
    canonical: SITE_URL + path,
    ogType: "website",
    ogImage: abs("/img/2026-10-02-Gamberini-Ritratto.jpg"),
    progress: "",
    blogCurrent: "",
    scripts: "",
    year: new Date().getFullYear(),
    build: BUILD,
    ...d
  });
  const file = join(DIST, path.endsWith("/") ? path + "index.html" : path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

// Home
const catStrip = Object.keys(AREE).map((k) =>
  `<a href="${BLOG_PATH}?cat=${k}"><span class="chip" data-cat="${k}">${esc(CAT_LABELS[k])} · ${countIn(posts, k)}</span></a>`).join("");
await page("/", {
  page: "home",
  title: "Nutrizionista a Biella — Dott. Nicolò Gamberini, Biologo Nutrizionista",
  description: "Dott. Nicolò Gamberini, Biologo Nutrizionista a Biella. Piani nutrizionali personalizzati, impedenziometria e antropometria per sportivi, patologie e chi vuole cambiare stile di vita.",
  jsonld: jsonld({ ...ORG, founder: AUTHOR }),
  main: fill(tpl.home, { postCount: posts.length, catStrip, latestPosts: posts.slice(0, 3).map((p) => card(p)).join("") })
});

// Archivio blog
const filters = `<button class="filter" type="button" data-cat="all" aria-pressed="true">Tutti<sup>${posts.length}</sup></button>` +
  Object.keys(AREE).map((k) => `<button class="filter" type="button" data-cat="${k}" aria-pressed="false">${esc(CAT_LABELS[k])}<sup>${countIn(posts, k)}</sup></button>`).join("");
const index = posts.map(({ html, hero, modified, ...p }) => ({ ...p, url: postUrl(p) }));
await page(BLOG_PATH, {
  page: "blog",
  title: "Blog Nutrizione e Benessere — Dott. Nicolò Gamberini",
  description: "Articoli di nutrizione, sport, integrazione, prevenzione e stile di vita a cura del Dott. Nicolò Gamberini, Biologo Nutrizionista a Biella.",
  blogCurrent: ' aria-current="page"',
  jsonld: jsonld({ "@type": "Blog", name: "Blog Nutrizione e Benessere", url: SITE_URL + BLOG_PATH, author: AUTHOR }),
  scripts: `<script>window.CATS=${JSON.stringify(CAT_LABELS)};window.ARTICOLI=${JSON.stringify(index).replace(/</g, "\\u003c")};</script>`,
  main: fill(tpl.blog, {
    postCount: posts.length,
    filters,
    posts: posts.slice(0, 9).map((p, i) => card(p, i === 0)).join("")
  })
});

// Articoli
for (const p of posts) {
  const url = SITE_URL + postUrl(p);
  const cat = p.cats[0];
  await page(postUrl(p), {
    page: "article",
    title: `${esc(p.title)} — Blog Dott. Nicolò Gamberini`,
    description: esc(p.excerpt),
    ogType: "article",
    ogImage: esc(abs(p.hero)),
    blogCurrent: ' aria-current="page"',
    progress: '<div class="progress" aria-hidden="true"></div>',
    jsonld: jsonld({
      "@type": "BlogPosting", headline: p.title, description: p.excerpt, image: abs(p.hero),
      datePublished: p.date, dateModified: p.modified, author: AUTHOR, publisher: { "@type": "Organization", name: ORG.name },
      mainEntityOfPage: url, keywords: p.tags.join(", ")
    }),
    main: fill(tpl.article, {
      title: esc(p.title), cat, catLabel: esc(CAT_LABELS[cat]), date: p.date, dateLabel: fmtDate(p.date), min: p.min,
      cover: `<img src="${esc(p.hero)}" alt="" fetchpriority="high">`,
      html: p.html,
      tags: p.tags.map((t) => `<span>#${esc(t)}</span>`).join(""),
      shareUrl: encodeURIComponent(url),
      shareText: encodeURIComponent(`${p.title} ${url}`),
      related: related(p, posts).map((r) => card(r)).join("")
    })
  });
}

// 404
await page("/404.html", {
  page: "404", title: "Pagina non trovata — Dott. Nicolò Gamberini", description: "Pagina non trovata.", jsonld: jsonld(ORG),
  robots: '<meta name="robots" content="noindex">',
  main: `<section class="page-hero"><div class="container"><p class="eyebrow">Errore 404</p><h1>Questa pagina non esiste.</h1>` +
    `<p>Potrebbe essere stata spostata. Prova dal blog o torna alla home.</p><div class="hero__actions">` +
    `<a class="btn btn--primary" href="/">Torna alla home</a><a class="btn btn--ghost" href="${BLOG_PATH}">Vai al blog</a></div></div></section>`
});

// Sitemap, RSS, robots, redirect, header
const urls = [["/", posts[0].date], [BLOG_PATH, posts[0].date], ...posts.map((p) => [postUrl(p), p.modified])];
await writeFile(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(([u, d]) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${d}</lastmod></url>`).join("\n") + "\n</urlset>\n");

await writeFile(join(DIST, "feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>` +
  `<title>Blog Dott. Nicolò Gamberini</title><link>${SITE_URL}${BLOG_PATH}</link><description>Nutrizione e benessere</description><language>it-it</language>\n` +
  posts.slice(0, 20).map((p) => `<item><title>${esc(p.title)}</title><link>${SITE_URL}${postUrl(p)}</link><guid>${SITE_URL}${postUrl(p)}</guid>` +
    `<pubDate>${new Date(p.date + "T08:00:00Z").toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`).join("\n") +
  "\n</channel></rss>\n");

await writeFile(join(DIST, "robots.txt"), INDEXING
  ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  : "User-agent: *\nDisallow: /\n");

// Redirect dalle vecchie pagine del prototipo e dagli archivi WordPress
await writeFile(join(DIST, "_redirects"), [
  `/blog.html            ${BLOG_PATH}  301`,
  `/articolo.html  a=:a  /:a/  301`,
  `/category/*           ${BLOG_PATH}  301`,
  `/tag/*                ${BLOG_PATH}  301`,
  `/feed/                /feed.xml  301`
].join("\n") + "\n");

if (!INDEXING) await writeFile(join(DIST, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");

console.log(`✓ ${posts.length} articoli, ${urls.length} pagine generate in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (unmapped.size) console.warn(`⚠ Categorie WordPress non mappate (finiscono in "Benessere"): ${[...unmapped].join(", ")}\n  → aggiungile in scripts/2026-10-02-Categorie-Blog.json`);
