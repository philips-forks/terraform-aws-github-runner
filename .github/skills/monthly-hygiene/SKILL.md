---
name: monthly-hygiene
description: 'Monthly review of the philips branch. Use when: auditing upstream-bound commits, checking for stale PRs, periodic fork maintenance, reviewing philips branch diff against main.'
---

# Monthly Hygiene Review

Periodic review of the `philips` branch to ensure upstream-bound commits are cleaned up and the fork stays thin.

## When to Use

- Monthly scheduled review (recommend first week of each month)
- When you suspect upstream-bound commits have accumulated

## Procedure

1. List all commits on `philips` that are not on `main`:
   ```bash
   git fetch origin
   git log --oneline origin/main..origin/philips
   ```

2. For each commit, categorize it:
   - **Infrastructure commit** (no `Upstream-PR:` trailer) → permanent, nothing to do
   - **Upstream-bound commit** (has `Upstream-PR:` trailer) → check if the PR has been merged

3. Check each upstream-bound commit's PR status:
   ```bash
   # Extract PR references
   git log origin/main..origin/philips --format='%s %b' | grep -oP 'Upstream-PR: \K.*'
   # For each PR, check status
   gh pr view <number> --repo github-aws-runners/terraform-aws-github-runner --json state -q '.state'
   ```

4. For merged PRs → follow the `/upstream-pr-merged` procedure to drop them.

5. For PRs open longer than **3 months** → escalate:
   - Comment on the upstream PR asking for review timeline
   - If no response after 2 weeks, consider whether the change should become a permanent infrastructure commit (requires team decision)

6. Verify the branch is clean:
   ```bash
   # Count remaining commits
   git rev-list --count origin/main..origin/philips
   ```
   The fewer commits, the healthier the fork.

## Health Indicators

| Metric | Healthy | Warning | Action Needed |
|--------|---------|---------|---------------|
| Total commits on `philips` | < 5 | 5–10 | > 10 — review urgently |
| Oldest upstream-bound commit | < 1 month | 1–3 months | > 3 months — escalate |
| PRs with no upstream equivalent | 0 | — | Any — policy violation |
