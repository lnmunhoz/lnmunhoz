// Collects my GitHub activity into data/stats.json.
//
// Public data (contribution calendar, public repos) works with any token,
// including the Actions GITHUB_TOKEN. Commit times and the language mix need
// a token that can read my private repos (PROFILE_TOKEN). Without one, the
// last saved private totals are kept as they were.
//
// Privacy: private repositories only ever appear here as totals. No private
// repo name or path is written to the output file, and commit messages are never read.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, resolveToken } from './github.mjs';
import { busiestDay, languageMix, localParts, streaks, TIME_ZONE, weeklyTotals } from './stats.mjs';

const LOGIN = process.env.PROFILE_LOGIN || 'lnmunhoz';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'stats.json');
// Languages that are build output or markup noise rather than code I write.
// Public repos left out of the "Lately in public" list.
// How much recent activity the cards show: whole calendar weeks, one building each.
const RECENT_WEEKS = 26; // about six months
const HIDDEN_PUBLIC_REPOS = ['skills', 'macros-dashboard-site', 'disgit'];
const IGNORED_LANGUAGES = ['Dockerfile', 'Makefile', 'Procfile', 'Batchfile', 'PowerShell', 'Jupyter Notebook'];

const graphql = createClient(resolveToken());

async function main() {
  const previous = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{}'));
  const user = await fetchUser();
  const calendar = await fetchCalendar(user);
  const publicRepos = await fetchPublicRepos();
  const activity = (await canReadPrivate()) ? await fetchActivity(user.id, calendar.recent.since) : null;
  if (!activity) console.log('No private access: keeping the previous commit and language totals.');

  const stats = {
    generatedAt: new Date().toISOString(),
    timeZone: TIME_ZONE,
    login: LOGIN,
    name: user.name,
    joined: user.createdAt,
    followers: user.followers.totalCount,
    ...calendar,
    public: publicRepos,
    activity: activity ?? previous.activity ?? null,
  };
  // Keep the old timestamp when nothing else changed, so a quiet day makes no commit.
  const same = (x) => JSON.stringify({ ...x, generatedAt: null });
  if (previous.generatedAt && same(previous) === same(stats)) stats.generatedAt = previous.generatedAt;
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(stats, null, 2) + '\n');
  console.log(
    `Saved ${OUT}: ${stats.recent.total} contributions in the last ${RECENT_WEEKS} weeks, ` +
      `${stats.activity?.commits ?? '?'} commits read, streak ${stats.recent.streak.current} days.`,
  );
}

async function fetchUser() {
  const data = await graphql(
    `query($login: String!) { user(login: $login) { id name createdAt followers { totalCount } } }`,
    { login: LOGIN },
  );
  return data.user;
}

async function canReadPrivate() {
  try {
    const data = await graphql(`{ viewer { login } }`);
    return data.viewer.login.toLowerCase() === LOGIN.toLowerCase();
  } catch {
    return false; // the Actions token has no viewer user
  }
}

// Every contribution day since the account was created, one year per alias.
async function fetchCalendar(user) {
  const first = new Date(user.createdAt).getUTCFullYear();
  const now = new Date();
  const years = [];
  for (let y = first; y <= now.getUTCFullYear(); y += 1) years.push(y);
  const fields = `contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }`;
  const aliases = years
    .map((y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { ${fields} }`)
    .join('\n');
  const data = await graphql(
    `query($login: String!) { user(login: $login) {
      lastYear: contributionsCollection { ${fields} }
      ${aliases}
    } }`,
    { login: LOGIN },
  );
  const u = data.user;
  const toDays = (cal) => cal.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));

  const byDate = new Map();
  for (const y of years) for (const d of toDays(u[`y${y}`].contributionCalendar)) byDate.set(d.date, d);
  const allDays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const lastYearDays = toDays(u.lastYear.contributionCalendar);
  // The last RECENT_WEEKS calendar weeks (weeks start on the calendar's first day, a Sunday).
  const recentDays = lastYearDays.slice(Math.max(0, Math.ceil(lastYearDays.length / 7) - RECENT_WEEKS) * 7);

  return {
    years: years.map((y) => ({ year: y, total: u[`y${y}`].contributionCalendar.totalContributions })),
    lifetime: {
      total: allDays.reduce((s, d) => s + d.count, 0),
      activeDays: allDays.filter((d) => d.count > 0).length,
      longestStreak: streaks(allDays).longest,
      busiestDay: busiestDay(allDays),
    },
    recent: {
      since: `${recentDays[0].date}T00:00:00Z`,
      total: recentDays.reduce((sum, d) => sum + d.count, 0),
      activeDays: recentDays.filter((d) => d.count > 0).length,
      // the streak runs over the whole last year, so a long one is not cut at the window
      streak: streaks(lastYearDays),
      busiestDay: busiestDay(recentDays),
      weeks: weeklyTotals(recentDays),
    },
  };
}

async function fetchPublicRepos() {
  const repos = [];
  let after = null;
  do {
    const data = await graphql(
      `query($login: String!, $after: String) { user(login: $login) {
        repositories(first: 100, after: $after, privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false,
                     orderBy: { field: PUSHED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes { name description url homepageUrl stargazerCount pushedAt isArchived primaryLanguage { name } }
        } } }`,
      { login: LOGIN, after },
    );
    const page = data.user.repositories;
    repos.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  const skip = new Set([LOGIN, ...HIDDEN_PUBLIC_REPOS].map((n) => n.toLowerCase()));
  return {
    repos: repos.length,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    recent: repos
      .filter((r) => !skip.has(r.name.toLowerCase()) && !r.isArchived)
      .slice(0, 5)
      .map((r) => ({ name: r.name, description: r.description, url: r.url, stars: r.stargazerCount, pushedAt: r.pushedAt, language: r.primaryLanguage?.name ?? null })),
    mostStarred: [...repos]
      .sort((a, b) => b.stargazerCount - a.stargazerCount)
      .slice(0, 3)
      .map((r) => ({ name: r.name, description: r.description, url: r.url, stars: r.stargazerCount })),
  };
}

// My commits on the default branch of every repo I pushed to since `since`,
// private and organisation repos included, reduced to totals.
async function fetchActivity(userId, since) {
  const hours = Array(24).fill(0);
  const weekdays = Array(7).fill(0);
  const repoTotals = [];
  let commits = 0;

  const historyFields = `history(first: 100, since: $since, author: { id: $uid }, after: $cursor) {
    totalCount pageInfo { hasNextPage endCursor } nodes { authoredDate } }`;

  const count = (node) => {
    const { hour, weekday } = localParts(node.authoredDate);
    hours[hour] += 1;
    weekdays[weekday] += 1;
    commits += 1;
  };

  let after = null;
  let done = false;
  while (!done) {
    const data = await graphql(
      `query($after: String, $since: GitTimestamp!, $uid: ID!, $cursor: String) { viewer {
        repositories(first: 20, after: $after, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER],
                     ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER],
                     orderBy: { field: PUSHED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id nameWithOwner isPrivate pushedAt
            languages(first: 12, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
            defaultBranchRef { target { ... on Commit { ${historyFields} } } }
          }
        } } }`,
      { after, since, uid: userId, cursor: null },
    );
    const page = data.viewer.repositories;
    for (const repo of page.nodes) {
      if (repo.pushedAt < since) {
        done = true;
        break;
      }
      let history = repo.defaultBranchRef?.target?.history;
      if (!history || history.totalCount === 0) continue;
      history.nodes.forEach(count);
      while (history.pageInfo.hasNextPage) {
        const more = await graphql(
          `query($id: ID!, $since: GitTimestamp!, $uid: ID!, $cursor: String) { node(id: $id) { ... on Repository {
            defaultBranchRef { target { ... on Commit { ${historyFields} } } } } } }`,
          { id: repo.id, since, uid: userId, cursor: history.pageInfo.endCursor },
        );
        history = more.node.defaultBranchRef.target.history;
        history.nodes.forEach(count);
      }
      repoTotals.push({
        private: repo.isPrivate,
        commits: history.totalCount,
        languages: repo.languages.edges.map((e) => ({ name: e.node.name, size: e.size })),
      });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    if (!after) done = true;
  }

  return {
    since,
    commits,
    repos: repoTotals.length,
    privateRepos: repoTotals.filter((r) => r.private).length,
    hours,
    weekdays,
    languages: languageMix(repoTotals, { top: 6, ignore: IGNORED_LANGUAGES }),
  };
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
