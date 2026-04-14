---
name: adopt-upstream-pr
description: 'Adopt an existing upstream PR into the philips branch. Use when: cherry-picking an open upstream PR for early deployment, bringing an existing PR branch into the fork, fast-tracking a PR that is pending upstream review.'
---

# Adopt Upstream PR

Bring an existing upstream PR into the `philips` branch for immediate internal use, without waiting for upstream to merge it.

## When to Use

- An upstream PR is open but not yet merged, and you need the change now
- The PR branch already exists (on upstream, a personal fork, or the Philips fork)
- You want to deploy the change internally while it continues through upstream review

## Prerequisites

- An open upstream PR number (e.g. `github-aws-runners/terraform-aws-github-runner#5031`)
- The PR branch must be accessible (public repo or you have access)

## Procedure

Given an upstream PR URL like `https://github.com/github-aws-runners/terraform-aws-github-runner/pull/5031`:

1. **Extract PR metadata:**
   ```bash
   # Get the PR branch, title, and head repo
   gh pr view 5031 --repo github-aws-runners/terraform-aws-github-runner \
     --json headRefName,title,headRepository,headRepositoryOwner,commits
   ```

2. **Fetch the PR branch into the fork:**
   ```bash
   cd <fork-clone>
   git fetch origin philips
   git checkout philips
   git pull origin philips

   # If PR is on the same repo (upstream):
   git fetch upstream <branch-name>

   # If PR is on a personal fork (e.g. your own):
   git fetch https://github.com/<owner>/terraform-aws-github-runner.git <branch-name>
   ```

3. **Cherry-pick or rebase the PR commits onto philips:**
   ```bash
   # Option A: Single commit — cherry-pick
   git cherry-pick <commit-sha>

   # Option B: Multiple commits — cherry-pick range
   git cherry-pick <first-commit>^..<last-commit>

   # Option C: Squash into one commit
   git merge --squash FETCH_HEAD
   git commit -s -m "feat: <PR title>

   Upstream-PR: github-aws-runners/terraform-aws-github-runner#<number>"
   ```

   **The `Upstream-PR:` trailer is mandatory.** This marks the commit as temporary — it will be removed once the upstream PR is merged.

4. **Verify the philips branch:**
   ```bash
   git log --oneline origin/main..philips
   ```
   Should show infrastructure commits + the new upstream-bound commit.

5. **Push:**
   ```bash
   git push origin philips --force-with-lease
   ```

6. **Tag a release if needed:**
   ```bash
   # Determine the base upstream version
   git describe --tags --abbrev=0 origin/main   # e.g. v7.5.0
   git tag philips-v7.5.0 philips
   git push origin philips-v7.5.0
   ```
   The release workflow triggers automatically.

## Quick Reference

```bash
# Full one-liner for a single-commit PR from your own fork:
PR_NUM=5031
PR_URL="https://github.com/github-aws-runners/terraform-aws-github-runner/pull/${PR_NUM}"
BRANCH=$(gh pr view "$PR_NUM" --repo github-aws-runners/terraform-aws-github-runner --json headRefName -q .headRefName)
OWNER=$(gh pr view "$PR_NUM" --repo github-aws-runners/terraform-aws-github-runner --json headRepositoryOwner -q .headRepositoryOwner.login)

git checkout philips && git pull origin philips
git fetch "https://github.com/${OWNER}/terraform-aws-github-runner.git" "$BRANCH"
git merge --squash FETCH_HEAD
git commit -s -m "feat: $(gh pr view "$PR_NUM" --repo github-aws-runners/terraform-aws-github-runner --json title -q .title)

Upstream-PR: github-aws-runners/terraform-aws-github-runner#${PR_NUM}"
git push origin philips --force-with-lease
```

## After Upstream Merges

Once the PR lands in upstream `main`, follow the `/upstream-pr-merged` skill to drop the commit from `philips`.
