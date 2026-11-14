// Pure helpers that turn raw GitHub data into the numbers the cards show.
// Kept free of I/O so they can be tested without the network.

export const TIME_ZONE = 'Asia/Bangkok';

/** Hour (0-23) and weekday (0 = Monday … 6 = Sunday) of an ISO time in the given zone. */
export function localParts(iso, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === 'hour').value) % 24;
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(
    parts.find((p) => p.type === 'weekday').value,
  );
  return { hour, weekday };
}

/**
 * Streaks over a list of { date: 'YYYY-MM-DD', count } days, sorted ascending.
 * The current streak may end yesterday: today is not over yet.
 */
export function streaks(days) {
  let longest = { length: 0, start: null, end: null };
  let run = { length: 0, start: null, end: null };
  for (const day of days) {
    if (day.count > 0) {
      run = run.length === 0 ? { length: 1, start: day.date, end: day.date } : { ...run, length: run.length + 1, end: day.date };
      if (run.length > longest.length) longest = run;
    } else {
      run = { length: 0, start: null, end: null };
    }
  }
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i -= 1; // today can still happen
  for (; i >= 0 && days[i].count > 0; i -= 1) current += 1;
  return { current, longest };
}

/** Sums days into weeks of seven, oldest first, keeping each week's first date. */
export function weeklyTotals(days) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    weeks.push({ start: slice[0].date, count: slice.reduce((sum, d) => sum + d.count, 0) });
  }
  return weeks;
}

/** The day with the most contributions (the latest one on a tie). */
export function busiestDay(days) {
  return days.reduce((best, d) => (best === null || d.count >= best.count ? d : best), null);
}

/**
 * Language mix weighted by the commits I made in each repo, so a huge
 * repo I touched once does not drown out the code I actually wrote.
 * repos: [{ commits, languages: [{ name, size }] }]
 */
export function languageMix(repos, { top = 6, ignore = [] } = {}) {
  const weights = new Map();
  for (const repo of repos) {
    const langs = repo.languages.filter((l) => !ignore.includes(l.name));
    const total = langs.reduce((sum, l) => sum + l.size, 0);
    if (!total || !repo.commits) continue;
    for (const l of langs) weights.set(l.name, (weights.get(l.name) || 0) + (repo.commits * l.size) / total);
  }
  const sum = [...weights.values()].reduce((a, b) => a + b, 0);
  if (!sum) return [];
  const sorted = [...weights.entries()].map(([name, w]) => ({ name, share: w / sum })).sort((a, b) => b.share - a.share);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((s, l) => s + l.share, 0);
  if (rest > 0.0005) head.push({ name: 'Other', share: rest });
  return head;
}

/** A short, honest label for when most commits happen. */
export function rhythmLabel(hours) {
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const band = (from, to) => hours.slice(from, to).reduce((a, b) => a + b, 0) / total;
  // Bands are per hour of the day, so compare their average rate, not their sum:
  // the afternoon band is longer than the early-morning one.
  const bands = [
    { name: 'early mornings', share: band(5, 9), hours: 4 },
    { name: 'mornings', share: band(9, 12), hours: 3 },
    { name: 'afternoons', share: band(12, 18), hours: 6 },
    { name: 'evenings', share: band(18, 23), hours: 5 },
    { name: 'late nights', share: band(23, 24) + band(0, 5), hours: 6 },
  ];
  return bands.map((b) => ({ ...b, rate: b.share / b.hours })).sort((a, b) => b.rate - a.rate)[0];
}

export function peakIndex(values) {
  return values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
}
