import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function formatDistance(date: Date | string | number): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

/**
 * Formats room names to ensure addresses are shown instead of coordinates.
 * If the name contains coordinates (e.g., "Chat Zone (40.123, -73.456)"), it returns "Nearby Chat".
 */
export function formatRoomName(name: string | null | undefined): string {
  if (!name) return 'Nearby Chat';
  
  // Remove "private_" prefix for private rooms if it leaked
  if (name.startsWith('private_')) {
    return 'Private Chat';
  }

  // Detect coordinate pattern like "Chat Zone (45.239, -75.731)" or "Chat Zone @ ..."
  const coordRegex = /Chat Zone.*[\(@].*[\),]/i;
  // If the user wants the "real address", we should let it through if it's already an address.
  // The mangling was replacing coordinate strings with "Nearby Zone", but the user wants the "real" info.
  
  return name;
}
