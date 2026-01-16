import { logApiCall } from './perf';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3002';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1500;
const FETCH_TIMEOUT = 15000;

let lastRequestStatus: { endpoint: string; status: number | 'error'; timestamp: number } | null = null;

export function getLastRequestStatus() {
  return lastRequestStatus;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options?: RequestInit,
  retryCount = 0
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  const method = options?.method || 'GET';
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Bypass-Tunnel-Reminder': 'true',
        ...options?.headers,
      },
    });

    clearTimeout(timeoutId);
      const duration = performance.now() - startTime;

      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (e) {
          try {
            const textBody = await response.text();
            if (textBody && textBody.length < 100) errorMessage = textBody;
          } catch {
          }
        }

      logApiCall(endpoint, method, duration, response.status);
      lastRequestStatus = { endpoint, status: response.status, timestamp: Date.now() };

      if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return apiRequest(endpoint, options, retryCount + 1);
      }

      throw new Error(errorMessage);
    }

    logApiCall(endpoint, method, duration, response.status);
    lastRequestStatus = { endpoint, status: response.status, timestamp: Date.now() };

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    const duration = performance.now() - startTime;

    const isNetworkError = 
      error.name === 'AbortError' || 
      error.message === 'Network request failed' ||
      error.name === 'TypeError';

    if (isNetworkError && retryCount < MAX_RETRIES) {
      console.log(`Retrying API call (${retryCount + 1}/${MAX_RETRIES}) for ${endpoint}...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return apiRequest(endpoint, options, retryCount + 1);
    }

    const finalMessage = error.name === 'AbortError'
      ? 'Connection timed out. Please check your signal.'
      : error.message || 'Unknown network error';

    logApiCall(endpoint, method, duration, 'error');
    lastRequestStatus = { endpoint, status: 'error', timestamp: Date.now() };

    throw new Error(finalMessage);
  }
}

/**
 * Example usage:
 *
 * import { apiRequest } from '@/lib/api';
 *
 * const data = await apiRequest('/users');
 */

export { BACKEND_URL };
