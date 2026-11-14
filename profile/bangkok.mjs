// Bangkok touches for the skyline header. Each scene adds layers around the
// data buildings and never changes them: temples and lanterns sit behind,
// the tuk-tuk drives in front, the river runs below the street.
//
// Every scene gets: { t, W, ground, river, buildings: [{ x, w, h, now }] }
// and returns any of: { back, front, below, style }.
// Animations start part-way through (negative delays), so a still frame
// already shows them, and they stop for people who prefer reduced motion.

const r1 = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

// ── Temples on the horizon ─────────────────────────────────────────────────
function prang(cx, base, h, w) {
  // A Khmer-style tower: stepped tiers, a corn-cob crown and a thin spire.
  const left = [];
  let y = base;
  let half = w / 2;
  const tierH = h * 0.085;
  for (let i = 0; i < 5; i += 1) {
    left.push([cx - half, y], [cx - half, y - tierH]);
    half *= 0.84;
    left.push([cx - half, y - tierH]);
    y -= tierH;
  }
  const cobH = h * 0.42;
  for (let k = 0; k <= 10; k += 1) {
    const a = (k / 10) * (Math.PI / 2);
    left.push([cx - half * Math.cos(a) - (k === 10 ? 1.4 : 0), y - cobH * Math.sin(a) * 0.96]);
  }
  left.push([cx - 0.9, base - h], [cx, base - h - 4]);
  const right = left.slice(0, -1).reverse().map(([x, py]) => [2 * cx - x, py]);
  return { points: pts([...left, ...right]), tip: [cx, base - h - 4] };
}

function chedi(cx, base, r) {
  // A bell-shaped stupa on three steps, with rings and a spire.
  let d = '';
  let y = base;
  for (const k of [1.35, 1.15, 0.95]) {
    d += `M${r1(cx - r * k)} ${r1(y)}h${r1(2 * r * k)}v-5h${r1(-2 * r * k)}Z`;
    y -= 5;
  }
  d += `M${r1(cx - r)} ${r1(y)}C${r1(cx - r)} ${r1(y - r * 0.95)} ${r1(cx - r * 0.5)} ${r1(y - r * 1.2)} ${r1(cx - r * 0.3)} ${r1(y - r * 1.32)}`;
  d += `L${r1(cx + r * 0.3)} ${r1(y - r * 1.32)}C${r1(cx + r * 0.5)} ${r1(y - r * 1.2)} ${r1(cx + r)} ${r1(y - r * 0.95)} ${r1(cx + r)} ${r1(y)}Z`;
  y -= r * 1.32;
  let ring = r * 0.34;
  for (let i = 0; i < 4; i += 1) {
    d += `M${r1(cx - ring)} ${r1(y)}h${r1(2 * ring)}v-3.4h${r1(-2 * ring)}Z`;
    y -= 3.4;
    ring *= 0.8;
  }
  const top = y - r * 1.1;
  d += `M${r1(cx - ring)} ${r1(y)}L${r1(cx)} ${r1(top)}L${r1(cx + ring)} ${r1(y)}Z`;
  return { d, tip: [cx, top] };
}

function hall(cx, base, w) {
  // A temple hall: body, three stacked roofs with upturned eaves, chofa finials.
  let d = `M${r1(cx - w / 2)} ${r1(base)}h${r1(w)}v-22h${r1(-w)}Z`;
  let roofBase = base - 20;
  let span = w / 2 + 10;
  const finials = [];
  for (let i = 0; i < 3; i += 1) {
    const peak = roofBase - 20 + i * 2;
    d += `M${r1(cx - span - 4)} ${r1(roofBase - 5)}L${r1(cx - span)} ${r1(roofBase)}L${r1(cx + span)} ${r1(roofBase)}L${r1(cx + span + 4)} ${r1(roofBase - 5)}L${r1(cx + span - 6)} ${r1(roofBase - 3)}L${r1(cx)} ${r1(peak)}L${r1(cx - span + 6)} ${r1(roofBase - 3)}Z`;
    finials.push([cx - span - 4, roofBase - 5], [cx + span + 4, roofBase - 5]);
    roofBase = peak + 8;
    span *= 0.7;
  }
  const top = roofBase - 8;
  d += `M${r1(cx - 1)} ${r1(top + 6)}v-8q1 -4 4 -5q-2 3 -2 5v8Z`;
  return { d, tip: [cx + 2, top - 6], finials };
}

export function temples({ t, ground }) {
  const fill = t.dark ? '#1e2b45' : '#ead7c1';
  const gold = t.dark ? '#d4a853' : '#d9963a';
  const main = prang(300, ground, 128, 64);
  const side1 = prang(252, ground, 74, 34);
  const side2 = prang(348, ground, 74, 34);
  const stupa = chedi(540, ground, 22);
  const temple = hall(150, ground, 74);
  const tips = [main.tip, side1.tip, side2.tip, stupa.tip, temple.tip]
    .map(([x, y]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.6" fill="${gold}"/>`)
    .join('');
  return {
    back: `<g fill="${fill}">
<polygon points="${side1.points}"/><polygon points="${side2.points}"/><polygon points="${main.points}"/>
<path d="${stupa.d}"/><path d="${temple.d}"/>
</g>${tips}`,
  };
}

// ── Sky lanterns drifting up ───────────────────────────────────────────────
export function lanterns({ t, ground }) {
  const body = t.dark ? '#f6a341' : '#e8743b';
  const glow = t.dark ? '#ffb35c' : '#f4a26b';
  // x, resting height, size, seconds per climb, how far through the climb it starts
  const list = [
    [372, 196, 0.8, 26, 0.1],
    [438, 150, 1, 30, 0.45],
    [486, 214, 0.7, 24, 0.7],
    [530, 120, 0.9, 32, 0.25],
    [655, 176, 1.1, 28, 0.55],
    [700, 104, 0.75, 34, 0.85],
    [748, 206, 0.85, 27, 0.35],
    [792, 140, 0.7, 31, 0.6],
  ];
  const items = list
    .map(([x, y, s, dur, phase]) => {
      const from = r1(ground - 6 - y);
      const to = r1(-y - 30);
      return `<g transform="translate(${x} ${y}) scale(${s})"><g class="lantern" style="--from:${from}px;--to:${to}px;animation-duration:${dur}s;animation-delay:-${r1(dur * phase)}s">
<circle r="11" fill="url(#lanternGlow)"/>
<path d="M-4.5 -6.5h9l-1.6 10.5h-5.8z" fill="${body}"/><rect x="-1.4" y="4.4" width="2.8" height="1.6" rx="0.8" fill="#ffe6a8"/>
</g></g>`;
    })
    .join('\n');
  return {
    back: `<defs><radialGradient id="lanternGlow"><stop offset="0" stop-color="${glow}" stop-opacity="${t.dark ? 0.45 : 0.25}"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>${items}`,
    style: `@keyframes rise{0%{transform:translate(0,var(--from));opacity:0}8%{opacity:1}50%{transform:translate(6px,calc((var(--from) + var(--to)) / 2))}85%{opacity:1}100%{transform:translate(-3px,var(--to));opacity:0}}
.lantern{animation:rise 28s linear infinite}`,
  };
}

// ── A tuk-tuk driving down the street ──────────────────────────────────────
export function tuktuk({ t, ground, W }) {
  const body = t.dark ? '#199e70' : '#1baf7a';
  const roof = t.dark ? '#c3c2b7' : '#2b3440';
  const tyre = t.dark ? '#0b0f14' : '#1f2328';
  const beam = t.dark ? `<path d="M29 -9L64 -15L64 -2Z" fill="#f2c66d" opacity="0.22"/>` : '';
  const start = 470;
  return {
    front: `<g transform="translate(${start} ${ground})"><g class="drive" style="--from:${-start - 70}px;--to:${W - start + 20}px">
${beam}
<rect x="0" y="-21" width="23" height="3.5" rx="1.5" fill="${roof}"/>
<rect x="1.5" y="-18" width="1.6" height="8" fill="${roof}"/><rect x="20" y="-18" width="1.6" height="8" fill="${roof}"/>
<path d="M0.5 -11h21l7 2.5v4.8h-28z" fill="${body}"/>
<rect x="23" y="-10" width="3" height="2" rx="0.6" fill="#ffe6a8"/>
<circle cx="6" cy="-3" r="3.2" fill="${tyre}"/><circle cx="25" cy="-3" r="3.2" fill="${tyre}"/>
</g></g>`,
    style: `@keyframes drive{from{transform:translateX(var(--from))}to{transform:translateX(var(--to))}}
.drive{animation:drive 30s linear infinite;animation-delay:-14s}`,
  };
}

// ── The Chao Phraya under the street, with a long-tail boat ─────────────────
export function river({ t, ground, W, river: depth, buildings }) {
  const water = t.dark ? '#0d1a2e' : '#d9e8f4';
  const line = t.dark ? '#3a5a85' : '#a9c6e0';
  const reflections = buildings
    .filter((b) => b.h > 4)
    .map((b) => {
      const h = Math.min(b.h * 0.38, depth - 5);
      return `<rect x="${r1(b.x)}" y="${ground + 1}" width="${r1(b.w)}" height="${r1(h)}" fill="${b.now ? t.orange : t.building}" opacity="${t.dark ? 0.35 : 0.4}"/>`;
    })
    .join('');
  const waves = [7, 14, 21]
    .map((dy, i) => `<line x1="0" y1="${ground + dy}" x2="${W}" y2="${ground + dy}" stroke="${line}" stroke-width="1" stroke-dasharray="${14 + i * 6} ${22 + i * 5}" class="wave" style="animation-duration:${9 + i * 4}s"/>`)
    .join('');
  const hull = t.dark ? '#8a5f42' : '#7a4f33';
  const canopy = t.dark ? '#d4a853' : '#d9963a';
  const start = 560;
  const boat = `<g transform="translate(${start} ${ground + 16})"><g class="sail" style="--from:${W - start + 60}px;--to:${-start - 60}px">
<path d="M-30 -11L-23 -2H20L24 -6L23 1H-21Z" fill="${hull}"/>
<rect x="-15" y="-9" width="24" height="2.4" rx="1" fill="${canopy}"/>
<rect x="-13" y="-7" width="1.4" height="5" fill="${canopy}"/><rect x="6" y="-7" width="1.4" height="5" fill="${canopy}"/>
<path d="M21 -4L40 5" stroke="${hull}" stroke-width="1.4"/><rect x="18" y="-8" width="5" height="4" rx="1" fill="${hull}"/>
</g></g>`;
  return {
    below: `<rect x="0" y="${ground + 1}" width="${W}" height="${depth}" fill="${water}"/>${reflections}${waves}${boat}`,
    style: `@keyframes wave{to{stroke-dashoffset:-120}}@keyframes sail{from{transform:translateX(var(--from))}to{transform:translateX(var(--to))}}
.wave{animation:wave 10s linear infinite}.sail{animation:sail 60s linear infinite;animation-delay:-30s}`,
  };
}

export const SCENES = { temples, lanterns, tuktuk, river };
export const SCENE_CLASSES = ['lantern', 'drive', 'wave', 'sail'];
