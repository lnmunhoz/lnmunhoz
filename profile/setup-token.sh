#!/usr/bin/env bash
# Saves the PROFILE_TOKEN secret the cards need, with as little clicking as GitHub allows.
#
# GitHub has no API or CLI that creates personal access tokens: they can only be
# made on github.com. This script does everything around that one step.
#
#   profile/setup-token.sh            one click: a read-only token that never expires
#   profile/setup-token.sh --gh       no clicks: reuse your `gh` login token (full access, see below)
set -euo pipefail

repo="${PROFILE_REPO:-lnmunhoz/lnmunhoz}"

if [[ "${1:-}" == "--gh" ]]; then
  # The gh login token can write to every repo you own. It stays in this repo's
  # Actions secrets, which only workflows on this repo can read, and it stops
  # working if you run `gh auth logout` or `gh auth refresh`.
  gh auth token | gh secret set PROFILE_TOKEN --repo "$repo"
else
  url="https://github.com/settings/personal-access-tokens/new?name=Profile+cards&description=Reads+my+repos+for+the+cards+on+my+GitHub+profile&expires_in=none&contents=read&metadata=read"
  echo "Opening GitHub with the token form filled in (read-only, no expiry)."
  echo "Under Repository access choose 'All repositories', then click 'Generate token' and copy it."
  open "$url" 2>/dev/null || xdg-open "$url" 2>/dev/null || echo "$url"
  read -rsp "Paste the token here: " token
  echo
  printf '%s' "$token" | gh secret set PROFILE_TOKEN --repo "$repo"
fi

echo "Saved PROFILE_TOKEN on $repo."
gh workflow run profile.yml --repo "$repo" >/dev/null 2>&1 && echo "Started a refresh of the cards." || true
