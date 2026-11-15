// Draws the profile cards from data/stats.json into assets/*.svg, one light
// and one dark version of each, and refreshes the generated parts of README.md.
// Output depends only on the data, so an unchanged day gives unchanged files.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './theme.mjs';
import { SCENES, SCENE_CLASSES } from './bangkok.mjs';

// What the header card says, and which Bangkok scenes it draws (see bangkok.mjs).
const HERO = {
  tagline: 'building productivity & language learning tools',
  location: 'Bangkok, Thailand',
  scenes: ['temples', 'lanterns', 'river', 'tuktuk'],
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 840;
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x) => `${Math.round(x * 100)}%`;
const r1 = (n) => Math.round(n * 10) / 10;

// A bar whose data end (the top) is rounded and whose base sits square on the baseline.
function bar(x, y, w, h, fill, { radius = 3, extra = '' } = {}) {
  if (h <= 0) return '';
  const r = Math.min(radius, w / 2, h);
  return `<path d="M${r1(x)} ${r1(y + h)}V${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}H${r1(x + w - r)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)}V${r1(y + h)}Z" fill="${fill}"${extra}/>`;
}

function text(x, y, s, { size = 12, fill, weight = 400, anchor = 'start', font = FONT, extra = '' } = {}) {
  return `<text x="${r1(x)}" y="${r1(y)}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra}>${esc(s)}</text>`;
}

function svg({ height, title, desc, t, body, style = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>text{font-variant-numeric:tabular-nums}${style}</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="12" fill="${t.surface}" stroke="${t.border}"/>
${body}
</svg>
`;
}

function heading(x, y, title, subtitle, t) {
  return text(x, y, title, { size: 15, weight: 600, fill: t.text }) + (subtitle ? text(x, y + 19, subtitle, { size: 12, fill: t.text2 }) : '');
}

// Small deterministic random numbers, so windows light the same way every run.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ── Hero: the past six months as a skyline, one building per week ────────────────
function hero(stats, t, opts = {}) {
  const scenes = opts.scenes ?? HERO.scenes;
  const hasRiver = scenes.includes('river');
  const ground = 276;
  const riverDepth = hasRiver ? 30 : 0;
  const H = ground + riverDepth + (hasRiver ? 28 : 42);
  const maxH = 140;
  const weeks = stats.recent.weeks;
  const pitch = Math.min(30, (W - 48) / weeks.length);
  const bw = pitch - 4;
  const x0 = (W - pitch * weeks.length + 4) / 2;
  const sorted = weeks.map((w) => w.count).sort((a, b) => b - a);
  // Scale to just above the second-tallest week, so one huge week does not
  // flatten the rest; a taller week is cut with a break mark and its number.
  const cap = Math.max(1, Math.min(sorted[0], Math.ceil((sorted[1] || sorted[0]) * 1.15)));
  const buildings = weeks.map((w, i) => ({
    x: x0 + i * pitch,
    w: bw,
    h: w.count === 0 ? 3 : Math.max(6, (Math.min(w.count, cap) / cap) * maxH),
    now: i === weeks.length - 1,
    over: w.count > cap,
    count: w.count,
  }));
  const layers = scenes.map((name) => SCENES[name]({ t, W, ground, river: riverDepth, buildings }));
  const layer = (key) => layers.map((l) => l[key] || '').join('\n');
  const parts = [];

  const sky = t.dark
    ? `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1124"/><stop offset="1" stop-color="${t.surface}"/></linearGradient>`
    : `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdeedd"/><stop offset="1" stop-color="${t.surface}"/></linearGradient>`;
  parts.push(`<defs>${sky}<clipPath id="card"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11"/></clipPath></defs>`);
  parts.push(`<g clip-path="url(#card)"><rect width="${W}" height="${ground}" fill="url(#sky)"/>`);

  if (t.dark) {
    const rand = rng(7);
    for (let i = 0; i < 46; i += 1) {
      const x = rand() * W;
      const y = 10 + rand() * 150;
      const r = rand() < 0.15 ? 1.3 : 0.8;
      const twinkle = i % 5 === 0 ? ` class="tw" style="animation-delay:${r1(rand() * 4)}s"` : '';
      parts.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="#e6edf3" opacity="${r1(0.35 + rand() * 0.5)}"${twinkle}/>`);
    }
    // Crescent moon: a disc with a smaller disc cut out of it
    parts.push(`<mask id="moon"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="609" cy="50" r="18" fill="#000"/></mask>`);
    parts.push(`<radialGradient id="glow"><stop offset="0.5" stop-color="#f3ead2" stop-opacity="0.12"/><stop offset="1" stop-color="#f3ead2" stop-opacity="0"/></radialGradient><circle cx="600" cy="56" r="44" fill="url(#glow)"/>`);
    parts.push(`<circle cx="600" cy="56" r="20" fill="#f3ead2" mask="url(#moon)"/>`);
  } else {
    parts.push(`<circle cx="600" cy="60" r="34" fill="#f8b77a" opacity="0.35"/><circle cx="600" cy="60" r="22" fill="#f59a52"/>`);
    // two clouds drifting slowly
    const cloud = (x, y, s, cls) => `<g class="${cls}" opacity="0.9"><g transform="translate(${x} ${y}) scale(${s})" fill="#ffffff"><rect x="0" y="10" width="64" height="16" rx="8"/><circle cx="22" cy="12" r="12"/><circle cx="40" cy="9" r="9"/></g></g>`;
    parts.push(cloud(380, 34, 0.9, 'drift'));
    parts.push(cloud(660, 92, 0.7, 'drift slow'));
  }
  parts.push(layer('back'));

  const rand = rng(42);
  for (const b of buildings) {
    const { x, h, now } = b;
    const y = ground - h;
    parts.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(bw)}" height="${r1(h)}" rx="1" fill="${now ? t.orange : t.building}"/>`);
    // windows
    if (h > 14) {
      const cols = bw >= 22 ? 3 : bw >= 10 ? 2 : 1;
      for (let wy = y + 5; wy < ground - 6; wy += 7) {
        for (let c = 0; c < cols; c += 1) {
          const lit = rand() < (t.dark ? 0.38 : 0.5);
          if (!lit) continue;
          const wx = x + (cols === 1 ? (bw - 3) / 2 : 3 + (c * (bw - 9)) / (cols - 1));
          const flicker = t.dark && rand() < 0.04 ? ` class="fl" style="animation-delay:${r1(rand() * 6)}s"` : '';
          parts.push(`<rect x="${r1(wx)}" y="${r1(wy)}" width="3" height="3" fill="${now ? t.nowWindow : t.window}"${flicker}/>`);
        }
      }
    }
    if (b.over) {
      // break mark: the real tower is taller than the frame allows
      parts.push(`<path d="M${r1(x - 2)} ${r1(y + 12)}l${r1(bw + 4)} -5M${r1(x - 2)} ${r1(y + 17)}l${r1(bw + 4)} -5" stroke="${t.surface}" stroke-width="2.5"/>`);
    }
    if (now) {
      parts.push(`<rect x="${r1(x + bw / 2 - 0.75)}" y="${r1(y - 9)}" width="1.5" height="9" fill="${t.orange}"/>`);
      parts.push(`<circle cx="${r1(x + bw / 2)}" cy="${r1(y - 10)}" r="2.2" fill="${t.orange}" class="beacon"/>`);
    }
  }
  parts.push(layer('below'));
  parts.push(`<rect x="0" y="${ground}" width="${W}" height="1" fill="${t.axis}"/>`);
  parts.push(layer('front'));
  parts.push('</g>');

  // month labels where a new month starts
  let last = '';
  weeks.forEach((w, i) => {
    const m = MONTHS[Number(w.start.slice(5, 7)) - 1];
    if (m !== last && i > 1 && i < weeks.length - 1) {
      parts.push(text(x0 + i * pitch, ground + riverDepth + 17, m, { size: 10.5, fill: t.muted }));
    }
    last = m;
  });

  parts.push(text(28, 54, stats.name || stats.login, { size: 30, weight: 700, fill: t.text }));
  parts.push(text(29, 80, HERO.tagline, { size: 15, fill: t.text2 }));
  // map pin, then the place
  parts.push(`<path transform="translate(29 92)" fill-rule="evenodd" fill="${t.orange}" d="M5 0C2.2 0 0 2.2 0 5c0 3.7 5 9 5 9s5-5.3 5-9C10 2.2 7.8 0 5 0zm0 3.1a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 1 1 0-3.8z"/>`);
  parts.push(text(45, 104, HERO.location, { size: 13, weight: 500, fill: t.text2 }));
  parts.push(text(29, 128, '› my past 6 months on GitHub, one building per week', { size: 12, fill: t.muted, font: MONO }));

  const style = `@keyframes tw{0%,100%{opacity:.25}50%{opacity:1}}@keyframes fl{0%,92%,100%{opacity:1}95%{opacity:.15}}@keyframes beacon{0%,100%{opacity:1}50%{opacity:.25}}@keyframes drift{0%,100%{transform:translateX(0)}50%{transform:translateX(24px)}}
.tw{animation:tw 4s ease-in-out infinite}.fl{animation:fl 7s steps(1) infinite}.beacon{animation:beacon 2.4s ease-in-out infinite}
.drift{animation:drift 18s ease-in-out infinite}.slow{animation-duration:26s}
${layer('style')}
@media (prefers-reduced-motion:reduce){.tw,.fl,.beacon,.drift,${SCENE_CLASSES.map((c) => `.${c}`).join(',')}{animation:none}}`;
  const peak = weeks.reduce((a, b) => (b.count > a.count ? b : a));
  return svg({
    height: H,
    t,
    style,
    title: `${stats.name}: ${HERO.tagline}, ${HERO.location}`,
    desc: `A ${HERO.location} skyline where each building is one week of GitHub contributions over the past six months. ${fmt(stats.recent.total)} contributions in total; the busiest week, starting ${peak.start}, had ${fmt(peak.count)}.`,
    body: parts.join('\n'),
  });
}

// ── Stat tiles ──────────────────────────────────────────────────────────────
function numbers(stats, t) {
  const H = 132;
  const a = stats.activity;
  const streak = stats.recent.streak.current;
  const longest = stats.lifetime.longestStreak.length;
  const tiles = [
    {
      value: fmt(stats.recent.total),
      label: 'contributions',
      note: `in the past 6 months, on ${stats.recent.activeDays} days`,
    },
    {
      value: `${streak} ${streak === 1 ? 'day' : 'days'}`,
      label: 'commit streak',
      note: streak > 0 && streak >= longest ? 'my longest ever' : `longest: ${longest} days`,
    },
  ];
  if (a) tiles.push({ value: fmt(a.commits), label: `commits in ${a.repos} repos`, note: `${a.privateRepos} of them private` });
  tiles.push({
    value: fmt(stats.lifetime.total),
    label: `contributions since ${new Date(stats.joined).getUTCFullYear()}`,
    note: `on ${fmt(stats.lifetime.activeDays)} different days`,
  });
  const tw = (W - 48) / tiles.length;
  const body = tiles
    .map((tile, i) => {
      const x = 24 + i * tw + (i === 0 ? 4 : 20);
      const sep = i > 0 ? `<rect x="${r1(24 + i * tw)}" y="28" width="1" height="${H - 56}" fill="${t.grid}"/>` : '';
      return (
        sep +
        text(x, 62, tile.value, { size: 30, weight: 650, fill: t.text }) +
        text(x, 86, tile.label, { size: 13, fill: t.text2 }) +
        text(x, 104, tile.note, { size: 12, fill: t.muted })
      );
    })
    .join('\n');
  return svg({
    height: H,
    t,
    title: 'My GitHub numbers',
    desc: tiles.map((tile) => `${tile.value} ${tile.label} (${tile.note})`).join('. '),
    body,
  });
}

// ── README blocks ───────────────────────────────────────────────────────────
function picture(name, alt) {
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg">
  <img alt="${esc(alt)}" src="assets/${name}-light.svg" width="100%">
</picture>`;
}

function publicBlock(stats) {
  const ago = (iso) => {
    const d = new Date(iso);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  return stats.public.recent
    .map((r) => `- [**${r.name}**](${r.url})${r.description ? ` · ${r.description.trim()}` : ''} <sub>${[r.language, ago(r.pushedAt)].filter(Boolean).join(' · ')}</sub>`)
    .join('\n');
}

function replaceBlock(readme, name, content) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(readme)) return readme;
  return readme.replace(re, `$1\n${content}\n$2`);
}

async function main() {
  const stats = JSON.parse(await readFile(join(ROOT, 'data', 'stats.json'), 'utf8'));
  await mkdir(join(ROOT, 'assets'), { recursive: true });
  const cards = { hero, numbers };
  const written = [];
  for (const [name, draw] of Object.entries(cards)) {
    for (const [mode, theme] of Object.entries(THEMES)) {
      const out = draw(stats, theme);
      if (!out) continue;
      await writeFile(join(ROOT, 'assets', `${name}-${mode}.svg`), out);
      written.push(`${name}-${mode}`);
    }
  }

  const readmePath = join(ROOT, 'README.md');
  let readme = await readFile(readmePath, 'utf8').catch(() => '');
  readme = replaceBlock(readme, 'public', publicBlock(stats));
  const d = new Date(stats.generatedAt);
  readme = replaceBlock(readme, 'updated', `<sub>Last updated ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}</sub>`);
  await writeFile(readmePath, readme);
  console.log(`Rendered ${written.length} cards: ${written.join(', ')}`);
}

export { picture, hero };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
