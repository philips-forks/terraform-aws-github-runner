---
name: upstream-pr-merged
description: 'Clean up philips branch after an upstream PR is merged. Use when: a Philips-contributed PR lands in upstream main, removing a temporary upstream-bound commit, rebasing philips after upstream merge, dropping redundant commits.'
---

# Upstream PR Merged — Cleanup

Remove an upstream-bound commit from `philips` after the corresponding upstream PR has been merged into `upstream/main`.

## When to Use

- A PR with an `Upstream-PR:` trailer has been merged into upstream `main`
- The daily sync has updated `origin/main` to include the merged change (or you trigger it manually)

## Procedure

1. Ensure `main` is up-to-date (wait for daily sync or trigger manually):
   ```bash
   gh workflow run sync-upstream.yml
   # Wait for completion, then:
   git fetch origin
   ```

2. Rebase `philips` onto the updated `main`:
   ```bash
   git checkout philips
   git rebase origin/main
   ```

3. The commit that was merged upstream will conflict with itself. **Drop it**:
   ```bash
   git rebase --skip
   ```
   Repeat for each upstream-bound commit that was merged.

4. Verify the remaining commits:
   ```bash
   git log --oneline origin/main..philips
   ```
   Only infrastructure commits and other not-yet-merged upstream-bound commits should remain. Each upstream-bound commit should still have a valid `Upstream-PR:` trailer pointing to an open PR.

5. Force-push the cleaned branch:
   ```bash
   git push origin philips --force-with-lease
   ```

6. Tag a new release on the rebased branch:
   ```bash
   # Determine the upstream version main is now at
   git describe --tags --abbrev=0 origin/main
   # Tag accordingly
   git tag philips-vX.Y.Z philips
   git push origin philips-vX.Y.Z
   ```

## Verification Checklist

- [ ] `git log --oneline origin/main..philips` shows no commits for the merged upstream PR
- [ ] No `Upstream-PR:` trailers reference merged/closed PRs
- [ ] `philips` branch has linear history (no merge commits)
- [ ] New `philips-vX.Y.Z` tag has been pushed and release workflow triggered
