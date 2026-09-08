/**
 * Helper to canonicalize platform display and user inputs.
 * Normalizes 'Facebook Marketplace' to 'Facebook' while preserving other platforms.
 */
export function normalizePlatform(platform?: string | null): string {
  if (!platform) return '';
  const trimmed = platform.trim();
  if (trimmed.toLowerCase() === 'facebook marketplace') {
    return 'Facebook';
  }
  return trimmed;
}

export function formatPlatformDisplay(platform?: string | null, fallback = 'N/A'): string {
  const normalized = normalizePlatform(platform);
  return normalized || fallback;
}
