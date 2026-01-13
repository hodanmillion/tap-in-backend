/**
 * API Configuration
 *
 * The backend URL is automatically configured:
 * - In development: Read from EXPO_PUBLIC_BACKEND_URL (set by ngrok script)
 * - In production: Use your deployed API URL
 */

// Get the backend URL from environment variables
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3002';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1s
const FETCH_TIMEOUT = 10000; // 10s

/**
 * Simple fetch wrapper with retry logic and timeout for stability on the move
 */
export async function apiRequest<T = any>(
  endpoint: string, 
  options?: RequestInit,
  retryCount = 0
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;

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

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorBody.message || errorMessage;
      } catch (e) {
        // Ignore if body is not JSON
      }

      // Retry on 5xx errors or 429
      if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return apiRequest(endpoint, options, retryCount + 1);
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Categories of network errors that are worth retrying
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
