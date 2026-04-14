---
name: sync-upstream
description: 'Sync the fork with upstream and rebase the philips branch. Use when: upstream sync failed, rebase conflict, manual sync needed, automated rebase opened an issue, resolving merge conflicts on philips branch.'
---

# Sync Upstream

Synchronize `main` with upstream and rebase the `philips` branch on top.

## When to Use

- The daily automated sync failed and opened a GitHub issue
- You need to manually trigger a sync before the next scheduled run
- A rebase conflict needs manual resolution

## Automated Flow

The `sync-upstream.yml` workflow runs daily and on `workflow_dispatch`. It:

1. Fetches `upstream/main` and force-pushes to `origin/main`
2. Syncs upstream `v*` tags to the fork
3. Rebases `philips` onto the updated `main`
4. If rebase succeeds → force-pushes `philips`
5. If rebase fails → opens a GitHub issue with conflict details

## Manual Conflict Resolution

When the workflow opens an issue because the rebase failed:

1. Fetch the latest state:
   ```bash
   git fetch origin
   git checkout philips
   git rebase origin/main
   ```

2. Resolve conflicts file by file. For each conflicting file:
   ```bash
   # Edit the file to resolve conflicts
   git add <file>
   git rebase --continue
   ```

3. If the conflict is from an upstream-bound commit that was already merged upstream, **drop it**:
   ```bash
   git rebase --skip
   ```

4. Verify the remaining commits are correct:
   ```bash
   git log --oneline origin/main..philips
   ```
   Only infrastructure commits and not-yet-merged upstream-bound commits should remain.

5. Force-push the rebased branch:
   ```bash
   git push origin philips --force-with-lease
   ```

6. Close the GitHub issue.

## Triggering Manually

```bash
gh workflow run sync-upstream.yml
```

Or via the GitHub Actions UI → `sync-upstream` → `Run workflow`.
