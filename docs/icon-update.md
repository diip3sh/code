# Updating the DP Code App Icon

This document explains the current icon architecture and the exact steps required to update the app icon across desktop, web, and marketing surfaces.

## Current Architecture (as of 2026)

DP Code maintains **three icon systems** that must stay visually consistent:

1. **Desktop (Electron)** — primary app icon shown in Dock, Finder, taskbar, installers, and DMG.
2. **Web app** — browser tab favicon, PWA icons, boot splash, and empty-state hero (the web UI runs inside the desktop shell).
3. **Marketing site** — public website favicons + small nav brand icon.

### Canonical Source Assets (as of June 2026)

All production icons are now derived from a **single master**:

```
assets/prod/new-logo.png          # The one 1024×1024 source of truth (new logo)
```

Derived files generated from it:

- `new-logo-windows.ico` (proper 6-size for desktop)
- `new-logo-web-favicon-*.png` + `.ico`
- `new-logo-web-apple-touch-180.png`
- `new-logo-dpcode.png` / `new-logo-hero-160.png` (for web splash & hero)
- Plus copies placed into `apps/desktop/resources/`, `apps/web/public/`, and `apps/marketing/public/`

The old duplicated `black-macos-*`, `black-universal-*`, `t3-black-*` masters have been removed (see implementation plan for this change).

Development now re-uses the new prod web assets via updated paths in `scripts/lib/brand-assets.ts`.

### Desktop Build Process

Release artifacts are produced by:

- `scripts/build-desktop-artifact.ts`
  - `stageMacIcons()` — resizes the modern PNG to 512×512 (`icon.png`) and runs the legacy PNG through `sips` + `iconutil` to produce a proper multi-size `.icns`.
  - `stageLinuxIcons()` / `stageWindowsIcons()` — simple copies.
- `scripts/lib/desktop-platform-build-config.ts` — tells electron-builder which icon file to use per platform and whether to invoke the `afterPack` hook.
- `apps/desktop/scripts/electron-builder-after-pack.cjs` — restores a classic `icon.icns` + `CFBundleIconFile` entry when using the modern Icon Composer (`.icon`) asset for macOS 26+.

**Critical:** macOS icon generation (`sips` / `iconutil`) only works on macOS hosts.

### Web & Marketing Injection

- `scripts/lib/brand-assets.ts` defines `PUBLISH_ICON_OVERRIDES` and `DEVELOPMENT_ICON_OVERRIDES`.
- `apps/server/scripts/cli.ts` (`applyPublishIconOverrides` / `applyDevelopmentIconOverrides`) copies the prod/dev assets into `apps/server/dist/client/` (and the Vite `public/` baseline) during `bun run build` / dev flows.
- `apps/web/public/` contains the source files served by the Vite dev server (boot splash, hero, favicons).
- `apps/marketing/public/` serves the marketing site.

### Runtime Icon Resolution (Desktop)

- `apps/desktop/src/main.ts`:
  - `resolveIconPath()` → `icon.{icns,ico,png}`
  - `resolveNotificationIconPath()` → `dpcode.png` on Windows/Linux (macOS uses the bundle icon for notifications).
  - `getIconOption()` skips the icon on darwin (the `.icns` in the app bundle is authoritative).

- Dev macOS launcher (`apps/desktop/scripts/electron-launcher.mjs`) patches a custom `icon.icns` into the Electron helper bundle.

## Recommended Update Workflow

### 0. Prepare the New Artwork

You will need (minimum):

- A clean **1024×1024 PNG** (RGBA, no interlacing) of the final icon design. This is the single most important file.
- A "legacy" variant of the same artwork if the iconutil pipeline produces unacceptable results on older macOS (rare — test after the first build).
- A properly generated **Windows .ico** containing at least these sizes: 16, 32, 48, 128, 256 (PNG-compressed inside the ICO is fine).

Optional but recommended for modern macOS (26+/Tahoe+):

- An **Icon Composer `.icon`** asset exported from Xcode's Icon Composer tool.

Example commands for the Windows .ico (ImageMagick):

```bash
# From a 1024 PNG
convert new-icon-1024.png \
  -define icon:auto-resize=256,128,64,48,32,16 \
  dpcode-windows.ico
```

### 1. Update the Canonical Masters

Replace (or add alongside during transition) the following in `assets/prod/`:

| Target file                        | Source you provide                 |
| ---------------------------------- | ---------------------------------- |
| `black-macos-1024.png`             | Your new 1024 PNG (primary)        |
| `black-macos-legacy-1024.png`      | Legacy treatment of the new design |
| `black-universal-1024.png`         | Same (or universal crop)           |
| `t3-black-windows.ico`             | Freshly generated .ico             |
| `t3-black-web-favicon.ico`         | Multi-size web favicon             |
| `t3-black-web-favicon-16x16.png`   | 16×16                              |
| `t3-black-web-favicon-32x32.png`   | 32×32                              |
| `t3-black-web-apple-touch-180.png` | 180×180                            |

Also update the parallel files in `assets/dev/` (blueprint-\*) so local dev stays on-brand.

### 2. Sync Packaged Desktop Resources (optional but helpful)

After a release build the files in `apps/desktop/resources/` are authoritative for that build. For local `electron-builder` testing you can manually place:

- `icon.icns`
- `icon.ico`
- `icon.png` (512×512 is what the build produces)
- `dpcode.png` (used for Win/Linux notifications)

These will be overwritten on the next proper release build.

### 3. Update Web Public Assets

Replace in `apps/web/public/`:

- `dpcode.png` — full new icon (used for boot splash + `SplashScreen` component). The UI applies `rounded-[26px]` / `border-radius: 26px`.
- `dpcode-hero.png` — 160×160 (or 112×112) version optimized for the empty-state hero (`ChatEmptyStateHero.tsx` uses `object-contain` + `rounded-lg`).
- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`

### 4. Update Marketing Site

Replace in `apps/marketing/public/`:

- `icon.png` (1024×1024 nav brand)
- All favicon + apple-touch files

### 5. Code/Config Changes (Usually Minimal)

Under the current architecture (Approach B in the 2026 icon plan), you normally only need to edit code if you **rename** any keys in `BRAND_ASSET_PATHS`.

Files that may need light updates (mostly comments):

- `scripts/lib/brand-assets.ts`
- `scripts/build-desktop-artifact.ts` (the three `Production*Source` constants)

No changes are required to:

- `desktop-platform-build-config.ts`
- `electron-builder-after-pack.cjs`
- `apps/desktop/src/main.ts` icon resolution
- `apps/desktop/scripts/electron-launcher.mjs`

### 6. Verification Checklist

**Desktop (requires macOS for full fidelity):**

- Run a desktop artifact build (or at least the staging phase) and inspect the generated `stage-resources/` icons.
- Build a DMG and visually confirm the icon in:
  - Finder (icon view + Get Info)
  - Dock
  - Launchpad / Spotlight
- On an older macOS VM or by checking the final .app bundle, confirm the legacy `.icns` fallback is present.
- Test Windows/Linux notification icon (`dpcode.png`).

**Web:**

- `bun run dev` (web) — boot splash, tab favicon, empty-state hero all show the new design.
- Theme both light and dark; the new icon has a baked dark background — ensure it doesn't look broken in light mode.

**Marketing:**

- Run the Astro dev server and confirm nav icon + favicons.

**Tests:**

- Existing tests (especially `scripts/build-desktop-artifact-mac-config.test.ts`) must continue to pass. The icon update should not change the shape of the generated electron-builder config.

## Long-Term Improvement (Recommended Future Work)

The current system duplicates nearly identical 1024 PNGs across mac/linux/web + a pre-baked .ico. After the next icon change stabilizes, consider introducing:

- A single `assets/prod/dpcode-icon-1024.png` as the canonical source.
- A small generator script (`scripts/lib/generate-brand-assets.ts`) that produces all the `black-*`, `t3-black-*`, and web variants (plus the 512/180/32/16 derivatives).
- Update `BRAND_ASSET_PATHS` and the build script to consume the generator output.

This would eliminate the duplication smell noted in AGENTS.md.

## Quick Reference — Who Owns What

| Surface         | Key files / scripts                                   | Regeneration tool          |
| --------------- | ----------------------------------------------------- | -------------------------- |
| Desktop macOS   | `stageMacIcons` + `generateMacIconSet`                | sips + iconutil (mac only) |
| Desktop Windows | `stageWindowsIcons`                                   | Manual .ico export         |
| Desktop Linux   | `stageLinuxIcons`                                     | Simple copy                |
| Web client      | `apply*IconOverrides` in `apps/server/scripts/cli.ts` | Copy from assets/prod      |
| Vite dev server | `apps/web/public/`                                    | Manual or generator        |
| Marketing       | `apps/marketing/public/`                              | Manual or generator        |

---

**Last updated:** 2026 (as part of the new logo introduction).  
**Owner:** Whoever performs the next icon update should also update this document with any new gotchas discovered.
