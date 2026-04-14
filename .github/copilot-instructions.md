# Philips Fork — Repository Guidelines

This is a **thin fork** of [github-aws-runners/terraform-aws-github-runner](https://github.com/github-aws-runners/terraform-aws-github-runner), maintained under a rebase-on-top strategy.

## Branch Model

- **`main`** — exact mirror of upstream `main`. Reset daily via automated sync. **Never commit Philips-specific changes to `main`.**
- **`philips`** — minimal set of commits on top of `main`. This is the deployment branch.

## Commit Rules for `philips`

- **Linear history only.** No merge commits. All changes are rebased.
- Every commit must be exactly one of two categories:
  1. **Infrastructure commit** — permanent, scoped to fork operation (sync workflows, release workflows, Artifactory publishing, copilot instructions/skills). No `Upstream-PR:` trailer.
  2. **Upstream-bound commit** — temporary fix or feature that has a corresponding PR open against upstream. **Must** include a trailer:
     ```
     Upstream-PR: github-aws-runners/terraform-aws-github-runner#<number>
     ```
     These commits are removed from `philips` once the upstream PR is merged.
- An upstream-bound commit **cannot** be merged to `philips` without a corresponding upstream PR. No exceptions.

## Tagging

- Release tags use the format `philips-vX.Y.Z`, where `X.Y.Z` matches the upstream version the `philips` branch is based on.
- Never create tags in the upstream `vX.Y.Z` format on this fork.

## Workflows

- `sync-upstream.yml` — daily sync of `main` from upstream + rebase of `philips`. Opens a GitHub issue on conflict.
- `philips-release.yml` — triggered on `philips-v*` tags. Builds Lambda zips, creates a GitHub Release with attestation, publishes to Artifactory.
- Upstream's `release.yml` is left untouched but will not trigger (GITHUB_TOKEN pushes don't trigger workflows; missing App secrets would fail it anyway).

## Skills

Use `/sync-upstream`, `/philips-release`, `/urgent-fix`, `/upstream-pr-merged`, or `/monthly-hygiene` in Copilot chat for step-by-step procedures.
