export const PerfMarks = {
  APP_START: 'app_start',
  AUTH_CHECK: 'auth_check',
  FIRST_RENDER: 'first_render',
} as const;

const marks: Record<string, number> = {};

export function mark(name: string): void {
  marks[name] = performance.now();
}

export function measure(name: string, startMark: string, endMark?: string): number {
  const start = marks[startMark];
  const end = endMark ? marks[endMark] : performance.now();
  const duration = end - start;
  return duration;
}
