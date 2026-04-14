---
name: urgent-fix
description: 'Apply an urgent fix to the fork and submit upstream. Use when: deploying a hotfix before upstream releases it, creating a dual-PR (fork + upstream), adding a temporary upstream-bound commit to philips branch.'
---

# Urgent Fix (Dual-PR Workflow)

Apply an urgent fix to the `philips` branch for immediate internal use while simultaneously submitting it upstream.

## When to Use

- A bug or feature needs to ship internally before upstream merges it
- You have a fix ready and want it on both the fork and upstream

## Prerequisites

- The fix must have a corresponding upstream PR (or you must create one). No exceptions.
- You must know the upstream PR number for the `Upstream-PR:` trailer.

## Procedure

1. Create a fix branch from `philips`:
   ```bash
   git checkout philips
   git pull origin philips
   git checkout -b fix/description
   ```

2. Implement the fix and commit with the upstream PR trailer:
   ```bash
   git commit -s -m "fix: description of the fix

   Upstream-PR: github-aws-runners/terraform-aws-github-runner#<number>"
   ```
   If the upstream PR doesn't exist yet, create the PR first, then amend the commit:
   ```bash
   git commit --amend -m "fix: description of the fix

   Upstream-PR: github-aws-runners/terraform-aws-github-runner#1234"
   ```

3. Push the branch to the fork:
   ```bash
   git push origin fix/description
   ```

4. Open **two PRs** from this single branch:
   - **Fork PR** → `philips` branch in `philips-forks/terraform-aws-github-runner`
   - **Upstream PR** → `main` in `github-aws-runners/terraform-aws-github-runner` (cross-fork PR)

5. After the fork PR is merged into `philips`, tag a release if needed:
   ```bash
   git checkout philips
   git pull origin philips
   git tag philips-vX.Y.Z
   git push origin philips-vX.Y.Z
   ```

## Important

- The `Upstream-PR:` trailer is **mandatory** for every upstream-bound commit.
- This commit is **temporary** — it will be removed from `philips` once the upstream PR is merged. See the `/upstream-pr-merged` skill.
- Keep the fix minimal and self-contained to reduce future rebase conflicts.
