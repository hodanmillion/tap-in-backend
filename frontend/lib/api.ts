/**
 * API Configuration
 *
 * The backend URL is automatically configured:
 * - In development: Read from EXPO_PUBLIC_BACKEND_URL (set by ngrok script)
 * - In production: Use your deployed API URL
 */

// Get the backend URL from environment variables
// Production: https://tap-in-backend.onrender.com (set in eas.json)
// Development: ngrok URL (set by backend dev:tunnel script)
import { supabase } from './supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tap-in-backend.onrender.com';

/**
 * Simple fetch wrapper for API calls
 */
export async function apiRequest<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;

  // Get current session for Auth header
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'Bypass-Tunnel-Reminder': 'true',
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || errorMessage;
    } catch (e) {
      // Ignore if body is not JSON
    }
    throw new Error(`API request failed: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Example usage:
 *
 * import { apiRequest } from '@/lib/api';
 *
 * const data = await apiRequest('/users');
 */

export { BACKEND_URL };
