/**
 * Helper to ensure internal links and static assets are prefixed
 * with the base URL configured in astro.config.mjs.
 * 
 * Works seamlessly both on GitHub Pages subpaths (e.g. /mrt/)
 * and on root custom domains (e.g. mrt.ro/).
 */
export function getRelativePath(path: string): string {
  if (!path) return '';
  
  // Don't modify external links, protocols, or anchor jumps
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:') ||
    path.startsWith('#') ||
    path.startsWith('data:')
  ) {
    return path;
  }

  // Astro's import.meta.env.BASE_URL is guaranteed to end with '/' (e.g. '/mrt/' or '/')
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If base is empty (i.e. root domain '/'), return cleanPath directly
  if (!base) {
    return cleanPath;
  }

  // Avoid duplicate base prefix
  if (cleanPath === base || cleanPath.startsWith(`${base}/`)) {
    return cleanPath;
  }

  return `${base}${cleanPath}`;
}
