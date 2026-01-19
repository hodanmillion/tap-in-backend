export const PerfMarks = {
  APP_START: 'app_start',
  AUTH_CHECK: 'auth_check',
  FIRST_RENDER: 'first_render',
} as const;

const marks: Record<string, number> = {};

function getTimestamp(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function mark(name: string): void {
  marks[name] = getTimestamp();
}

export function measure(name: string, startMark?: string, endMark?: string): number {
  const start = marks[startMark ?? name] ?? 0;
  const end = endMark ? marks[endMark] : getTimestamp();
  const duration = end - start;
  return duration;
}
