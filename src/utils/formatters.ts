/**
 * ZIMRAH 2026 - Formatting Utilities
 * Standard string, date, and chest number formatting
 */

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

/**
 * Format chest numbers to preserve display standards while maintaining string type
 * ADR-005: Chest numbers must remain strings to preserve leading zeros
 */
export function formatChestNumber(chestNumber: string | null | undefined): string {
  if (!chestNumber) return '—';
  return String(chestNumber).trim();
}

/**
 * Format score/points to 2 decimal places or clean integer if exact
 */
export function formatScore(points: number | string | null | undefined): string {
  if (points === null || points === undefined) return '0.00';
  const num = typeof points === 'string' ? parseFloat(points) : points;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
