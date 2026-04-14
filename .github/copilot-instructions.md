# Philips Fork — Repository Guidelines

This is a **thin fork** of [github-aws-runners/terraform-aws-github-runner](https://github.com/github-aws-runners/terraform-aws-github-runner), maintained under a rebase-on-top strategy.

## Branch Model

- **`main`** — exact mirror of upstream `main`. Reset daily via automated sync. **Never commit Philips-specific changes to `main`.**
- **`philips`** — minimal set of commits on top of `main`. This is the deployment branch and the **default branch** of the fork (required for `workflow_dispatch` to work on fork-only workflows).

## Commit Rules for `philips`

- **Linear history only.** No merge commits. All changes are rebased.
- Every commit must be exactly one of two categories:
  1. **Infrastructure commit** — permanent, scoped to fork operation (sync workflows, release workflows, copilot instructions/skills). No `Upstream-PR:` trailer.
  2. **Upstream-bound commit** — temporary fix or feature that has a corresponding PR open against upstream. **Must** include a trailer:
     ```
     Upstream-PR: github-aws-runners/terraform-aws-github-runner#<number>
     ```
     These commits are removed from `philips` once the upstream PR is merged.
- An upstream-bound commit **cannot** be merged to `philips` without a corresponding upstream PR. No exceptions.

## Tagging

Two tag prefixes, each with a distinct purpose:

- **`upstream-vX.Y.Z`** — clean tracking release of upstream `vX.Y.Z`. Created automatically by the sync workflow when a new upstream release is detected. Points to the same commit as the upstream tag on `main`. Contains no Philips-specific changes.
- **`philips-vX.Y.Z`** — manual release from the `philips` branch. Created by a maintainer when the branch contains upstream-bound fixes that need to ship before the next upstream release. May include hotfixes not yet merged upstream.

Never create tags in the upstream `vX.Y.Z` format on this fork.

## Workflows

- `sync-upstream.yml` — daily sync of `main` from upstream + rebase of `philips`. Auto-tags `upstream-v*` for new upstream releases. Opens a GitHub issue on rebase conflict.
- `philips-release.yml` — triggered on `upstream-v*` and `philips-v*` tags. Builds Lambda zips, creates a GitHub Release with attestation. No Artifactory publish; consumers source the module directly from this GitHub repo.
- Upstream's `release.yml` is left untouched but will not trigger (GITHUB_TOKEN pushes don't trigger workflows; missing App secrets would fail it anyway).

## Skills

Use `/sync-upstream`, `/philips-release`, `/urgent-fix`, `/adopt-upstream-pr`, `/upstream-pr-merged`, or `/monthly-hygiene` in Copilot chat for step-by-step procedures.
