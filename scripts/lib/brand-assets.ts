export const BRAND_ASSET_PATHS = {
  productionMacIconComposer: "assets/prod/black-macos.icon", // kept for future Icon Composer support
  // New canonical single source of truth (1024 master)
  productionMacIconPng: "assets/prod/new-logo.png",
  productionMacLegacyIconPng: "assets/prod/new-logo.png",
  productionLinuxIconPng: "assets/prod/new-logo.png",
  productionWindowsIconIco: "assets/prod/new-logo-windows.ico",
  // Web assets generated from the same master
  productionWebFaviconIco: "assets/prod/new-logo-web-favicon.ico",
  productionWebFavicon16Png: "assets/prod/new-logo-web-favicon-16x16.png",
  productionWebFavicon32Png: "assets/prod/new-logo-web-favicon-32x32.png",
  productionWebAppleTouchIconPng: "assets/prod/new-logo-web-apple-touch-180.png",
  // Dev overrides now point at the new prod web assets for brand consistency during development
  developmentWindowsIconIco: "assets/prod/new-logo-windows.ico",
  developmentWebFaviconIco: "assets/prod/new-logo-web-favicon.ico",
  developmentWebFavicon16Png: "assets/prod/new-logo-web-favicon-16x16.png",
  developmentWebFavicon32Png: "assets/prod/new-logo-web-favicon-32x32.png",
  developmentWebAppleTouchIconPng: "assets/prod/new-logo-web-apple-touch-180.png",
} as const;

export interface IconOverride {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
}

export const DEVELOPMENT_ICON_OVERRIDES: ReadonlyArray<IconOverride> = [
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFaviconIco,
    targetRelativePath: "dist/client/favicon.ico",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFavicon16Png,
    targetRelativePath: "dist/client/favicon-16x16.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFavicon32Png,
    targetRelativePath: "dist/client/favicon-32x32.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebAppleTouchIconPng,
    targetRelativePath: "dist/client/apple-touch-icon.png",
  },
];

export const PUBLISH_ICON_OVERRIDES: ReadonlyArray<IconOverride> = [
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFaviconIco,
    targetRelativePath: "dist/client/favicon.ico",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFavicon16Png,
    targetRelativePath: "dist/client/favicon-16x16.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFavicon32Png,
    targetRelativePath: "dist/client/favicon-32x32.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebAppleTouchIconPng,
    targetRelativePath: "dist/client/apple-touch-icon.png",
  },
];
