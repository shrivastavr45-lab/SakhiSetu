export function isPublicAssetURL(id?: string): boolean {
  if (!id) return false;
  return (
    id.startsWith("/assets/") ||
    id === "/robots.txt" ||
    id === "/favicon.ico"
  );
}

