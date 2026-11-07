declare module "#nitro/virtual/polyfills" {}

declare module "#nitro/virtual/public-assets" {
  export function isPublicAssetURL(id?: string): boolean;
}

