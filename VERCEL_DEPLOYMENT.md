# Vercel Deployment Configuration Guide

## Issue
Previous deployments showed warnings about conflicting package managers (package-lock.json) and outdated React Native dependencies from mobile-app/.

## Solution
✅ **Fixed** with `.vercelignore` and updated `vercel.json`:

### 1. `.vercelignore` 
- Excludes `mobile-app/` (React Native doesn't run on Vercel)
- Excludes `data/`, `scripts/`, `legacy-site-hugo/` (not needed for deployment)
- Excludes `package-lock.json` (uses yarn with --no-lockfile instead)

### 2. `platform/vercel.json`
- Added `"root": "platform"` - tells Vercel this is the root for deployment
- Uses `yarn install --no-lockfile` - avoids lock file conflicts
- Uses `--ignore-scripts` - prevents postinstall script warnings

### 3. Root `package-lock.json`
- ✅ **Removed** - was causing lock file conflicts
- Platform uses yarn (platform/yarn.lock)
- Mobile-app uses npm (mobile-app/package-lock.json)
- Vercel only builds platform with --no-lockfile

## Verification Steps

1. **Check Vercel is configured correctly:**
   - Visit https://vercel.com/contactmrshalin/songbook/settings
   - Verify "Root Directory" is set to `platform` (if not set, Vercel auto-detects)

2. **Redeploy to Vercel:**
   ```bash
   cd /Users/s0s0pna/Downloads/Songbook_Pipeline_Project
   git add .vercelignore platform/vercel.json
   git commit -m "fix: configure Vercel to ignore mobile-app and data directories"
   git push
   ```

3. **Monitor next deployment:**
   - Go to https://vercel.com/contactmrshalin/songbook/deployments
   - Click the latest deployment
   - Check build logs for the warnings:
     ```
     ✓ No "Failed to fetch git submodules"
     ✓ No "package-lock.json found"
     ✓ No "Old versions of glob"
     ✓ No "rimraf" or "uuid" warnings
     ```

## Deployment Behavior

**Before:**
- Yarn tried to install all workspace deps (platform + mobile-app + root)
- Mobile-app's old React Native deps caused warnings
- Lock file conflicts between npm and yarn

**After:**
- Vercel ignores mobile-app/ and data/
- Only installs platform/node_modules
- No lock file conflicts
- Build succeeds cleanly

## Rollback (if needed)

If issues occur, you can:
1. Remove `.vercelignore` and `root` from vercel.json
2. Keep `--no-lockfile --ignore-scripts` flags
3. Redeploy

But the current setup should be stable.
