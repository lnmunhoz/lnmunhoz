// Draws the profile cards from data/stats.json into assets/*.svg, one light
// and one dark version of each, and refreshes the generated parts of README.md.
// Output depends only on the data, so an unchanged day gives unchanged files.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { peakIndex, rhythmLabel } from './stats.mjs';
import { THEMES } from './theme.mjs';

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

// ── Hero: the past year as a skyline, one building per week ────────────────
function hero(stats, t) {
  const H = 300;
  const ground = 258;
  const maxH = 140;
  const weeks = stats.lastYear.weeks;
  const pitch = Math.min(15, (W - 48) / weeks.length);
  const bw = pitch - 4;
  const x0 = (W - pitch * weeks.length + 4) / 2;
  const sorted = weeks.map((w) => w.count).sort((a, b) => b - a);
  // Scale to just above the second-tallest week, so one huge week does not
  // flatten the rest; a taller week is cut with a break mark and its number.
  const cap = Math.max(1, Math.min(sorted[0], Math.ceil((sorted[1] || sorted[0]) * 1.15)));
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

  const rand = rng(42);
  weeks.forEach((w, i) => {
    const x = x0 + i * pitch;
    const isNow = i === weeks.length - 1;
    const over = w.count > cap;
    const h = w.count === 0 ? 3 : Math.max(6, (Math.min(w.count, cap) / cap) * maxH);
    const y = ground - h;
    const fill = isNow ? t.orange : t.building;
    parts.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(bw)}" height="${r1(h)}" rx="1" fill="${fill}"/>`);
    // windows
    if (h > 14) {
      const cols = bw >= 10 ? 2 : 1;
      for (let wy = y + 5; wy < ground - 6; wy += 7) {
        for (let c = 0; c < cols; c += 1) {
          const lit = rand() < (t.dark ? 0.38 : 0.5);
          if (!lit) continue;
          const wx = x + (cols === 2 ? 2 + c * (bw - 7) : (bw - 3) / 2);
          const flicker = t.dark && rand() < 0.04 ? ` class="fl" style="animation-delay:${r1(rand() * 6)}s"` : '';
          parts.push(`<rect x="${r1(wx)}" y="${r1(wy)}" width="3" height="3" fill="${isNow ? t.nowWindow : t.window}"${flicker}/>`);
        }
      }
    }
    if (over) {
      // break mark: the real tower is taller than the frame allows
      parts.push(`<path d="M${r1(x - 2)} ${r1(y + 12)}l${r1(bw + 4)} -5M${r1(x - 2)} ${r1(y + 17)}l${r1(bw + 4)} -5" stroke="${t.surface}" stroke-width="2.5"/>`);
    }
    if (isNow) {
      parts.push(`<rect x="${r1(x + bw / 2 - 0.75)}" y="${r1(y - 9)}" width="1.5" height="9" fill="${t.orange}"/>`);
      parts.push(`<circle cx="${r1(x + bw / 2)}" cy="${r1(y - 10)}" r="2.2" fill="${t.orange}" class="beacon"/>`);
      parts.push(text(x - 6, y - 16, `${fmt(w.count)} this week`, { size: 11.5, weight: 600, fill: t.text, anchor: 'end' }));
    }
  });
  parts.push(`<rect x="0" y="${ground}" width="${W}" height="1" fill="${t.axis}"/></g>`);

  // month labels where a new month starts
  let last = '';
  weeks.forEach((w, i) => {
    const m = MONTHS[Number(w.start.slice(5, 7)) - 1];
    if (m !== last && i > 1 && i < weeks.length - 1) {
      parts.push(text(x0 + i * pitch, ground + 17, m, { size: 10.5, fill: t.muted }));
    }
    last = m;
  });

  parts.push(text(28, 54, stats.name || stats.login, { size: 30, weight: 700, fill: t.text }));
  parts.push(text(29, 80, 'building productivity & language learning tools · Bangkok', { size: 15, fill: t.text2 }));
  parts.push(text(29, 104, '› my past year on GitHub, one building per week', { size: 12, fill: t.muted, font: MONO }));

  const style = `@keyframes tw{0%,100%{opacity:.25}50%{opacity:1}}@keyframes fl{0%,92%,100%{opacity:1}95%{opacity:.15}}@keyframes beacon{0%,100%{opacity:1}50%{opacity:.25}}@keyframes drift{0%,100%{transform:translateX(0)}50%{transform:translateX(24px)}}
.tw{animation:tw 4s ease-in-out infinite}.fl{animation:fl 7s steps(1) infinite}.beacon{animation:beacon 2.4s ease-in-out infinite}
.drift{animation:drift 18s ease-in-out infinite}.slow{animation-duration:26s}
@media (prefers-reduced-motion:reduce){.tw,.fl,.beacon,.drift{animation:none}}`;
  const peak = weeks.reduce((a, b) => (b.count > a.count ? b : a));
  return svg({
    height: H,
    t,
    style,
    title: `${stats.name}: productivity and language learning tools, Bangkok`,
    desc: `A city skyline where each building is one week of GitHub contributions over the past year. ${fmt(stats.lastYear.total)} contributions in total; the busiest week, starting ${peak.start}, had ${fmt(peak.count)}.`,
    body: parts.join('\n'),
  });
}

// ── Stat tiles ──────────────────────────────────────────────────────────────
function numbers(stats, t) {
  const H = 132;
  const a = stats.activity;
  const thisYear = new Date(stats.generatedAt).getUTCFullYear();
  const before = stats.years.filter((y) => y.year < thisYear).reduce((m, y) => Math.max(m, y.total), 0);
  const streak = stats.lastYear.streak.current;
  const longest = stats.lifetime.longestStreak.length;
  const tiles = [
    {
      value: fmt(stats.lastYear.total),
      label: 'contributions',
      note: stats.lastYear.total > before ? 'past 12 months, a record' : 'in the past 12 months',
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

// ── When I commit: hour of day and day of week ──────────────────────────────
function rhythm(stats, t) {
  const a = stats.activity;
  if (!a?.hours) return null;
  const H = 250;
  const parts = [];
  const total = a.hours.reduce((s, v) => s + v, 0);
  const peak = peakIndex(a.hours);
  const lateHours = [22, 23, 0, 1, 2, 3, 4];
  const late = lateHours.reduce((s, h) => s + a.hours[h], 0) / total;
  const label = rhythmLabel(a.hours);
  const hourName = (h) => (h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h} am` : `${h - 12} pm`);

  parts.push(heading(24, 34, `When I commit: mostly ${label.name}`, `Commits by hour, Bangkok time, past 12 months. The peak hour starts at ${hourName(peak)}.`, t));

  // Hours, starting at 5 am so the night stays in one piece on the right.
  const order = Array.from({ length: 24 }, (_, i) => (i + 5) % 24);
  const left = 24;
  const right = 520;
  const top = 96;
  const base = 200;
  const pitch = (right - left) / 24;
  const bw = pitch - 4;
  const max = Math.max(...a.hours, 1);
  const lateStart = left + order.indexOf(22) * pitch - 2;
  parts.push(`<rect x="${r1(lateStart)}" y="${top - 22}" width="${r1(right - lateStart + 2)}" height="${base - top + 22}" rx="6" fill="${t.band}"/>`);
  parts.push(text(right - 6, top - 8, `${pct(late)} after 10 pm`, { size: 11.5, weight: 600, fill: t.text2, anchor: 'end' }));
  order.forEach((h, i) => {
    const x = left + i * pitch + 2;
    const v = a.hours[h];
    const hgt = (v / max) * (base - top);
    parts.push(bar(x, base - hgt, bw, hgt, h === peak ? t.orange : t.blue));
    if ([6, 12, 18, 0].includes(h)) parts.push(text(x + bw / 2, base + 17, hourName(h), { size: 11, fill: t.muted, anchor: 'middle' }));
  });
  parts.push(`<rect x="${left}" y="${base}" width="${right - left}" height="1" fill="${t.axis}"/>`);

  // Weekdays
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const full = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const busiest = peakIndex(a.weekdays);
  const wl = 572;
  const wr = W - 24;
  parts.push(`<rect x="548" y="30" width="1" height="${H - 60}" fill="${t.grid}"/>`);
  parts.push(text(wl, 86, `Busiest day: ${full[busiest]}`, { size: 12, weight: 600, fill: t.text2 }));
  const wp = (wr - wl) / 7;
  const wbw = wp - 10;
  const wmax = Math.max(...a.weekdays, 1);
  a.weekdays.forEach((v, i) => {
    const x = wl + i * wp + 5;
    const hgt = (v / wmax) * (base - top);
    parts.push(bar(x, base - hgt, wbw, hgt, i === busiest ? t.orange : t.blue));
    parts.push(text(x + wbw / 2, base + 17, days[i], { size: 11, fill: t.muted, anchor: 'middle' }));
  });
  parts.push(`<rect x="${wl}" y="${base}" width="${wr - wl}" height="1" fill="${t.axis}"/>`);

  return svg({
    height: H,
    t,
    title: 'When I commit',
    desc: `Commits by hour of day (Bangkok time) and by weekday over the past 12 months. Peak hour starts at ${hourName(peak)}; ${pct(late)} of commits land between 10 pm and 5 am; the busiest day is ${full[busiest]}.`,
    body: parts.join('\n'),
  });
}

// ── Languages and the years on GitHub ───────────────────────────────────────
function craft(stats, t) {
  const H = 270;
  const parts = [];
  const langs = stats.activity?.languages || [];
  const base = 232;

  if (langs.length) {
    parts.push(heading(24, 34, 'What I write', 'Language mix of my commits, past 12 months', t));
    const nameX = 112;
    const barX = 122;
    const barMax = 230;
    const rowH = (base - 74) / langs.length;
    const max = langs[0].share;
    langs.forEach((l, i) => {
      const y = 76 + i * rowH;
      const w = Math.max(2, (l.share / max) * barMax);
      parts.push(text(nameX, y + 12, l.name, { size: 12, fill: t.text2, anchor: 'end' }));
      parts.push(`<rect x="${barX}" y="${r1(y + 2)}" width="${r1(w)}" height="${r1(Math.min(14, rowH - 6))}" rx="3" fill="${l.name === 'Other' ? t.other : t.blue}"/>`);
      parts.push(text(barX + w + 8, y + 12, pct(l.share), { size: 12, fill: t.text, weight: 600 }));
    });
  }

  // years
  const thisYear = new Date(stats.generatedAt).getUTCFullYear();
  const years = stats.years;
  const left = 448;
  const right = W - 24;
  const top = 92;
  parts.push(`<rect x="420" y="30" width="1" height="${H - 60}" fill="${t.grid}"/>`);
  parts.push(heading(left, 34, `${thisYear - years[0].year} years on GitHub`, `Contributions per year, ${fmt(stats.lifetime.total)} in total`, t));
  const pitch = (right - left) / years.length;
  const bw = pitch - 6;
  const max = Math.max(...years.map((y) => y.total), 1);
  const prevBest = years.filter((y) => y.year < thisYear).reduce((b, y) => (!b || y.total > b.total ? y : b), null);
  years.forEach((y, i) => {
    const x = left + i * pitch + 3;
    const h = (y.total / max) * (base - top);
    const now = y.year === thisYear;
    parts.push(bar(x, base - h, bw, h, now ? t.orange : t.blue));
    parts.push(text(x + bw / 2, base + 16, `’${String(y.year).slice(2)}`, { size: 10.5, fill: t.muted, anchor: 'middle' }));
    if (now || (prevBest && y.year === prevBest.year)) {
      parts.push(text(x + bw / 2, base - h - 7, fmt(y.total), { size: 11, weight: 600, fill: t.text, anchor: now ? 'end' : 'middle', extra: now ? ` dx="${r1(bw / 2)}"` : '' }));
    }
  });
  parts.push(`<rect x="${left}" y="${base}" width="${right - left}" height="1" fill="${t.axis}"/>`);

  return svg({
    height: H,
    t,
    title: 'What I write, and my years on GitHub',
    desc:
      (langs.length ? `Languages: ${langs.map((l) => `${l.name} ${pct(l.share)}`).join(', ')}. ` : '') +
      `Contributions per year: ${years.map((y) => `${y.year}: ${y.total}`).join(', ')}.`,
    body: parts.join('\n'),
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
  const cards = { hero, numbers, rhythm, craft };
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

export { picture };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
