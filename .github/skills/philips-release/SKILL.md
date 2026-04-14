---
name: philips-release
description: 'Create a Philips fork release. Use when: tagging a new philips-vX.Y.Z release, publishing Lambda zips and Terraform module to Artifactory, releasing after an urgent fix, releasing after upstream version bump.'
---

# Philips Release

Tag and publish a release from the `philips` branch.

## When to Use

- After syncing with a new upstream release to create a matching `philips-vX.Y.Z`
- After merging an urgent fix into `philips` that needs immediate deployment
- After cleaning up upstream-bound commits (re-releasing on the same upstream base)

## Procedure

1. Ensure `philips` is up-to-date and rebased on `main`:
   ```bash
   git fetch origin
   git checkout philips
   git log --oneline origin/main..philips
   ```
   Verify the commit list looks correct.

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

4. The `philips-release.yml` workflow triggers automatically and will:
   - Build all Lambda zips (`yarn install --frozen-lockfile && yarn test && yarn dist`)
   - Create a GitHub Release with the tag
   - Upload Lambda assets: `runners.zip`, `webhook.zip`, `ami-housekeeper.zip`, `termination-watcher.zip`, `runner-binaries-syncer.tar.gz`
   - Generate sigstore attestation for all artifacts
   - Publish the Terraform module to Artifactory (`dl-innersource-terraform-local`)

5. Verify the release:
   ```bash
   gh release view philips-v7.5.0
   gh at verify runners.zip --repo philips-forks/terraform-aws-github-runner
   ```

## Tag Naming

- Always use `philips-vX.Y.Z` where `X.Y.Z` matches the upstream version `main` is based on
- Never use the upstream `vX.Y.Z` format
- If releasing a patch on the same upstream base (e.g. second fix on top of `v7.5.0`), increment the patch: `philips-v7.5.0`, `philips-v7.5.0-1`, etc. (needs team decision on convention)
