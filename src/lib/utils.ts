import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind CSS class names with clsx and resolves conflicts with tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats points safely as 2-decimal string (e.g. 10 -> "10.00").
 */
export function formatPoints(points: number | string | null | undefined): string {
  if (points === null || points === undefined || points === '') {
    return '0.00';
  }
  const num = typeof points === 'number' ? points : parseFloat(points);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}
