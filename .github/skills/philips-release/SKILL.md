---
name: philips-release
description: 'Create a Philips fork release. Use when: tagging a new philips-vX.Y.Z release, publishing Lambda zips, releasing after an urgent fix, releasing after upstream version bump.'
---

# Philips Release

Tag and publish a release from the `philips` branch.

## Release Types

There are two types of fork releases:

- **`upstream-vX.Y.Z`** — Clean tracking release. Created **automatically** by the sync workflow when a new upstream release tag is detected. Points to the same commit as `vX.Y.Z` on `main`. No manual action needed.
- **`philips-vX.Y.Z`** — Manual hotfix release. Created by a maintainer when the `philips` branch contains upstream-bound fixes that need to ship before the next upstream release.

Both trigger the same `philips-release.yml` workflow → build, GitHub Release, attestation. No Artifactory publish step is needed; consumers source the Terraform module directly from this GitHub repo and Lambda zips from GitHub Releases.

## When to Use This Skill

- After merging an urgent fix into `philips` that needs immediate deployment
- After cleaning up upstream-bound commits and needing a re-release
- **Not** for upstream tracking releases — those are auto-created by the sync workflow

## Procedure (manual `philips-v*` release)

1. Ensure `philips` is up-to-date and rebased on `main`:
   ```bash
   git fetch origin
   git checkout philips
   git log --oneline origin/main..philips
   ```
   Verify the commit list looks correct — should include infrastructure commits plus the hotfix(es).

2. Determine the upstream version that `main` is based on:
   ```bash
   git describe --tags --abbrev=0 origin/main
   ```
   This gives you the upstream version (e.g. `v7.5.0`).

3. Tag the release on `philips`:
   ```bash
   git tag philips-v7.5.0 philips
   git push origin philips-v7.5.0
   ```

4. The release workflow triggers automatically and will:
   - Build all Lambda zips (`yarn install --frozen-lockfile && yarn test && yarn dist`)
   - Create a GitHub Release with the tag
   - Upload Lambda assets: `runners.zip`, `webhook.zip`, `ami-housekeeper.zip`, `termination-watcher.zip`, `runner-binaries-syncer.tar.gz`
   - Generate sigstore attestation for all artifacts

5. Verify the release:
   ```bash
   gh release view philips-v7.5.0
   gh at verify runners.zip --repo philips-forks/terraform-aws-github-runner
   ```

## Tag Naming

| Prefix | Source | Created by | Contains Philips patches? |
|--------|--------|------------|---------------------------|
| `upstream-vX.Y.Z` | `main` (same commit as upstream `vX.Y.Z`) | Sync workflow (auto) | No |
| `philips-vX.Y.Z` | `philips` branch HEAD | Maintainer (manual) | Yes |

- Never create tags in the upstream `vX.Y.Z` format on this fork
- `upstream-v*` tags always point to `main`; `philips-v*` tags always point to `philips`
