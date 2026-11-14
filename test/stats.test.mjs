import test from 'node:test';
import assert from 'node:assert/strict';
import { busiestDay, isAiPaired, languageMix, localParts, rhythmLabel, streaks, weeklyTotals } from '../profile/stats.mjs';

const days = (counts, start = '2026-01-01') =>
  counts.map((count, i) => ({ date: new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10), count }));

test('streaks: current streak ignores an empty today, longest is kept', () => {
  const s = streaks(days([1, 1, 1, 0, 2, 3, 0]));
  assert.equal(s.current, 2);
  assert.equal(s.longest.length, 3);
  assert.equal(s.longest.start, '2026-01-01');
});

test('streaks: an empty yesterday ends the current streak', () => {
  assert.equal(streaks(days([4, 0, 0])).current, 0);
  assert.equal(streaks(days([4, 0, 5])).current, 1);
});

test('weeklyTotals sums each run of seven days', () => {
  const w = weeklyTotals(days([1, 1, 1, 1, 1, 1, 1, 2, 2]));
  assert.deepEqual(w.map((x) => x.count), [7, 4]);
  assert.equal(w[1].start, '2026-01-08');
});

test('busiestDay picks the highest count', () => {
  assert.equal(busiestDay(days([1, 9, 3])).count, 9);
});

test('isAiPaired reads Co-Authored-By trailers only', () => {
  assert.ok(isAiPaired('Fix it\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'));
  assert.ok(isAiPaired('Fix\n\nco-authored-by: Codex <codex@openai.com>'));
  assert.ok(!isAiPaired('Ask Claude about the bug'));
  assert.ok(!isAiPaired('Pair\n\nCo-Authored-By: Maria <maria@example.com>'));
});

test('localParts uses Bangkok time', () => {
  // 17:30 UTC on a Sunday is 00:30 on Monday in Bangkok (UTC+7)
  assert.deepEqual(localParts('2026-11-15T17:30:00Z'), { hour: 0, weekday: 0 });
});

test('languageMix weights each repo by my commits there', () => {
  const mix = languageMix([
    { commits: 90, languages: [{ name: 'TypeScript', size: 100 }] },
    { commits: 10, languages: [{ name: 'HTML', size: 1e6 }] },
  ]);
  assert.equal(mix[0].name, 'TypeScript');
  assert.ok(Math.abs(mix[0].share - 0.9) < 1e-9);
});

test('languageMix folds the tail into Other', () => {
  const langs = ['A', 'B', 'C', 'D'].map((name) => ({ name, size: 1 }));
  const mix = languageMix([{ commits: 1, languages: langs }], { top: 2 });
  assert.deepEqual(mix.map((l) => l.name), ['A', 'B', 'Other']);
});

test('rhythmLabel compares bands by their hourly rate', () => {
  const hours = Array(24).fill(0);
  hours[23] = 5;
  hours[1] = 5;
  hours[14] = 6;
  assert.equal(rhythmLabel(hours).name, 'late nights');
});
