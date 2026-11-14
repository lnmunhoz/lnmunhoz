// Minimal GitHub GraphQL client: no dependencies, retries on transient errors.

import { execFileSync } from 'node:child_process';

export function resolveToken() {
  const token = process.env.PROFILE_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) return token;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No GitHub token: set PROFILE_TOKEN or GITHUB_TOKEN, or sign in with `gh auth login`.');
  }
}

export function createClient(token) {
  return async function graphql(query, variables = {}, attempt = 1) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        authorization: `bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'profile-cards',
      },
      body: JSON.stringify({ query, variables }),
    });
    if ((res.status >= 500 || res.status === 403) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      return graphql(query, variables, attempt + 1);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.errors?.length) {
      const detail = body.errors?.map((e) => e.message).join('; ') || res.statusText;
      throw new Error(`GitHub GraphQL ${res.status}: ${detail}`);
    }
    return body.data;
  };
}
