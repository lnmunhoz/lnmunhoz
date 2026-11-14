# How the profile cards work

A GitHub Action ([profile.yml](../.github/workflows/profile.yml)) rebuilds the cards on my profile every six hours, and whenever this folder changes.

1. **[collect.mjs](collect.mjs)** asks the GitHub GraphQL API for my activity and saves it to [data/stats.json](../data/stats.json):
   - the contribution calendar for every year since I joined (it already counts private work as totals),
   - my commits on the default branch of every repo I pushed to in the past year, private and organisation repos included: when each commit was written, and whether it credits an AI co-author (a `Co-Authored-By:` trailer naming Claude, Codex, Copilot, Cursor and similar),
   - the language mix of those repos, weighted by how many commits I made in each,
   - my public repos, for the "Lately in public" list.
2. **[render.mjs](render.mjs)** draws each card as a light and a dark SVG in [assets/](../assets), and refreshes the generated parts of the README (between the `<!-- name:start -->` and `<!-- name:end -->` markers). Everything else in the README is hand-written.

No dependencies: plain Node 22.

## Privacy

Private repositories only ever leave the API as totals. No private repo name, commit message, file or path is written to `stats.json` or the cards. Commit messages are read only to look for the AI co-author trailer.

## The token

The commit and language cards need to read my private repos, which the Actions `GITHUB_TOKEN` cannot. They use the `PROFILE_TOKEN` repository secret: a classic personal access token with the `repo` scope (it also covers organisation repos I contribute to). A fine-grained token with read-only **Contents** and **Metadata** on all my repositories works too, but it only sees repos I own.

Without `PROFILE_TOKEN` the job still refreshes the public parts and keeps the last saved commit totals.

GitHub has no API that creates tokens, so [setup-token.sh](setup-token.sh) does the rest around that one step: it opens the token form already filled in (read-only, no expiry), takes the token you paste and saves the secret. `setup-token.sh --gh` skips the form and reuses your `gh` login token instead, which works but can write to all your repos.

## Run it locally

```sh
npm run build   # collect + render, using `gh auth token` when no token is set
npm test        # the pure helpers in stats.mjs
```

Times are in `Asia/Bangkok`; change `TIME_ZONE` in [stats.mjs](stats.mjs) if I move.
