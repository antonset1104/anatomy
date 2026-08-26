/**
 * audit-mobile.mjs — Penjaga regresi tampilan ponsel.
 *
 * Tiga cacat berikut pernah lolos ke produksi dan baru ketahuan lewat audit
 * manual: halaman meluber horizontal di 360px, tombol yang lebih kecil dari
 * ambang sentuh 44px, dan teks 10,4px yang tidak terbaca dalam genggaman.
 * Ketiganya tidak menimbulkan error apa pun — build tetap hijau, tidak ada
 * pengecualian di konsol — sehingga satu-satunya cara menangkapnya adalah
 * benar-benar merender halaman dan mengukurnya.
 *
 * Skrip ini menyajikan direktori hasil build lewat server statis kecil,
 * membukanya di Chromium pada beberapa lebar layar ponsel, lalu membandingkan
 * hasil ukur dengan anggaran di mobile-budget.json. Keluar dengan kode 1 bila
 * ada anggaran yang terlampaui.
 *
 * Playwright tidak dijadikan dependensi repo — beberapa repo ini statis murni
 * dan tidak punya package.json sama sekali. Alur kerja CI memasangnya secara
 * global lalu menunjuk ke sana lewat PLAYWRIGHT_MODULE.
 *
 *   node .github/ci/audit-mobile.mjs [path/ke/mobile-budget.json]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const configPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(HERE, 'mobile-budget.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const ROOT = path.resolve(REPO, config.root ?? '.');
const ENTRY = config.entry ?? '/';
const WIDTHS = config.widths ?? [360, 390, 414];
const B = config.budgets ?? {};

if (!fs.existsSync(ROOT)) {
  console.error(`✗ Direktori hasil build tidak ada: ${path.relative(REPO, ROOT) || '.'}`);
  console.error('  Jalankan langkah build sebelum audit ini.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png',
  '.gif': 'image/gif', '.avif': 'image/avif', '.xml': 'application/xml', '.txt': 'text/plain',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf'
};

/** Server statis yang meniru perilaku SPA fallback milik Cloudflare Pages. */
function serve(root, port) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    let file = path.join(root, rel);
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

/**
 * Dijalankan di dalam halaman.
 *
 * Elemen di dalam wadah yang memang menggulir horizontal tidak dihitung
 * sebagai luberan — baris pil yang menggulir adalah pola yang disengaja,
 * bukan cacat.
 */
const PROBE = () => {
  const vw = window.innerWidth;

  const insideScroller = (el) => {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return true;
      node = node.parentElement;
    }
    return false;
  };

  const describe = (el) => {
    const cls = String(el.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? `.${cls}` : '');
  };

  const visible = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  const overflow = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el) || insideScroller(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      overflow.push({ el: describe(el), right: Math.round(r.right), left: Math.round(r.left) });
    }
  });

  const smallTargets = [];
  document.querySelectorAll('a,button,input,select,textarea,[role=button]').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Tautan teks di dalam kalimat mengalir memang tidak pantas dipaksa 44px.
    if (el.tagName === 'A' && el.closest('p, li:not([class]), figcaption')) return;
    if (r.height < 43.5 || r.width < 43.5) {
      smallTargets.push({ el: describe(el), box: `${Math.round(r.width)}x${Math.round(r.height)}` });
    }
  });

  let minFont = Infinity;
  const tiny = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (!el.childNodes.length || !visible(el)) return;
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!hasOwnText) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (!size) return;
    if (size < minFont) minFont = size;
    if (size < 12.5) tiny.push({ el: describe(el), px: size.toFixed(2) });
  });

  const dedupe = (list, key) => [...new Map(list.map((x) => [x.el + x[key], x])).values()].slice(0, 8);

  return {
    overflowPx: Math.max(0, document.body.scrollWidth - vw),
    overflow: dedupe(overflow, 'right'),
    smallTargets: smallTargets.length,
    smallSamples: dedupe(smallTargets, 'box'),
    minFontPx: Number.isFinite(minFont) ? Number(minFont.toFixed(2)) : null,
    tinySamples: dedupe(tiny, 'px')
  };
};

const moduleSpecifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
const playwright = await import(moduleSpecifier);
const { chromium } = playwright.default ?? playwright;

const server = await serve(ROOT, 4173);
const browser = await chromium.launch();
const failures = [];
const rows = [];

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 120)));

  await page.goto(`http://localhost:4173${ENTRY}`, { waitUntil: 'load', timeout: 45000 });
  // Beri kesempatan skrip yang menyisipkan markup setelah muat untuk selesai.
  await page.waitForTimeout(config.settleMs ?? 3000);

  const r = await page.evaluate(PROBE);
  rows.push({ width, ...r, pageErrors: pageErrors.length });

  const check = (name, actual, limit, compare, format) => {
    if (limit === undefined || limit === null) return;
    if (compare(actual, limit)) {
      failures.push(`${width}px · ${name}: ${format(actual)} (anggaran ${format(limit)})`);
    }
  };
  check('luberan horizontal', r.overflowPx, B.overflowPx, (a, l) => a > l, (v) => `${v}px`);
  check('target sentuh di bawah 44px', r.smallTargets, B.smallTargets, (a, l) => a > l, (v) => `${v}`);
  check('galat runtime halaman', pageErrors.length, B.pageErrors, (a, l) => a > l, (v) => `${v}`);
  if (B.minFontPx != null && r.minFontPx != null && r.minFontPx < B.minFontPx) {
    failures.push(`${width}px · ukuran font terkecil: ${r.minFontPx}px (anggaran minimal ${B.minFontPx}px)`);
  }

  if (pageErrors.length) rows[rows.length - 1].errorSamples = pageErrors.slice(0, 3);
  await context.close();
}

await browser.close();
server.close();

const pad = (v, n) => String(v).padEnd(n);
console.log(`\nAudit ponsel — ${config.name ?? path.basename(REPO)}  (${path.relative(REPO, ROOT) || '.'}${ENTRY})`);
console.log(`${pad('lebar', 8)}${pad('luberan', 10)}${pad('target<44', 11)}${pad('font min', 10)}galat`);
for (const r of rows) {
  console.log(
    pad(`${r.width}px`, 8) +
    pad(`${r.overflowPx}px`, 10) +
    pad(r.smallTargets, 11) +
    pad(r.minFontPx == null ? '—' : `${r.minFontPx}px`, 10) +
    r.pageErrors
  );
}

const worst = rows.find((r) => r.overflow.length || r.smallSamples.length || r.tinySamples.length);
if (worst) {
  if (worst.overflow.length) console.log('\n  contoh elemen meluber:  ' + worst.overflow.map((o) => `${o.el} (kanan ${o.right})`).join(', '));
  if (worst.smallSamples.length) console.log('  contoh target kecil:    ' + worst.smallSamples.map((o) => `${o.el} ${o.box}`).join(', '));
  if (worst.tinySamples.length) console.log('  contoh teks <12,5px:    ' + worst.tinySamples.map((o) => `${o.el} ${o.px}px`).join(', '));
}
if (worst?.errorSamples) console.log('  galat halaman:          ' + worst.errorSamples.join(' | '));

if (failures.length) {
  console.error('\n✗ Anggaran tampilan ponsel terlampaui:');
  for (const f of failures) console.error(`    ${f}`);
  console.error('\n  Perbaiki tampilannya, atau — bila memang disengaja — perbarui');
  console.error('  .github/ci/mobile-budget.json dengan alasannya di pesan commit.');
  process.exit(1);
}

console.log('\n✓ Seluruh anggaran tampilan ponsel terpenuhi.');
