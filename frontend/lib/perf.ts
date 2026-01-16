type PerfMark = {
  name: string;
  startTime: number;
};

type PerfMeasure = {
  name: string;
  duration: number;
  timestamp: number;
};

type ApiCallLog = {
  endpoint: string;
  method: string;
  duration: number;
  status: number | 'error';
  timestamp: number;
};

const marks: Map<string, PerfMark> = new Map();
const measures: PerfMeasure[] = [];
const apiCalls: ApiCallLog[] = [];

const MAX_HISTORY = 50;

export function mark(name: string): void {
  marks.set(name, {
    name,
    startTime: performance.now(),
  });
}

export function measure(name: string): number | null {
  const startMark = marks.get(name);
  if (!startMark) {
    console.warn(`[Perf] No mark found for "${name}"`);
    return null;
  }

  const duration = performance.now() - startMark.startTime;
  const measurement: PerfMeasure = {
    name,
    duration,
    timestamp: Date.now(),
  };

  measures.push(measurement);
  if (measures.length > MAX_HISTORY) {
    measures.shift();
  }

  marks.delete(name);

  if (__DEV__) {
    console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`);
  }

  return duration;
}

export function logApiCall(
  endpoint: string,
  method: string,
  duration: number,
  status: number | 'error'
): void {
  const log: ApiCallLog = {
    endpoint,
    method,
    duration,
    status,
    timestamp: Date.now(),
  };

  apiCalls.push(log);
  if (apiCalls.length > MAX_HISTORY) {
    apiCalls.shift();
  }

  if (__DEV__) {
    const statusColor = status === 'error' || (typeof status === 'number' && status >= 400) ? '31' : '32';
    console.log(`[API] \x1b[${statusColor}m${method} ${endpoint}\x1b[0m - ${duration.toFixed(0)}ms (${status})`);
  }
}

export function getMeasures(): PerfMeasure[] {
  return [...measures];
}

export function getApiCalls(): ApiCallLog[] {
  return [...apiCalls];
}

export function getLatestTimings(): Record<string, number | null> {
  const latest: Record<string, number | null> = {};
  const keys = ['app_start', 'tab_switch', 'chat_open', 'messages_loaded', 'message_sent'];

  for (const key of keys) {
    const match = [...measures].reverse().find((m) => m.name.startsWith(key));
    latest[key] = match?.duration ?? null;
  }

  return latest;
}

export function clearPerfData(): void {
  marks.clear();
  measures.length = 0;
  apiCalls.length = 0;
}

export function clearApiLogs(): void {
  apiCalls.length = 0;
}

export function getPerformanceTimings(): Record<string, number> {
  const timings: Record<string, number> = {};
  for (const m of measures) {
    timings[m.name] = m.duration;
  }
  return timings;
}

export function getApiLogs(): Array<{
  url: string;
  method: string;
  status: number | 'error';
  duration: number;
  timestamp: number;
}> {
  return apiCalls.map((c) => ({
    url: c.endpoint,
    method: c.method,
    status: c.status,
    duration: c.duration,
    timestamp: c.timestamp,
  }));
}

export const PerfMarks = {
  APP_START: 'app_start',
  TAB_SWITCH: 'tab_switch',
  CHAT_OPEN: 'chat_open',
  MESSAGES_LOADED: 'messages_loaded',
  MESSAGE_SENT: 'message_sent',
  DATA_LOADED: 'data_loaded',
} as const;
