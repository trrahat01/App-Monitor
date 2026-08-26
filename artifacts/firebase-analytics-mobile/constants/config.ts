/**
 * App-wide configuration.
 *
 * The mobile app talks to the analytics backend. For local testing on the same
 * Wi-Fi, point `API_BASE_URL` at your laptop's LAN IP, e.g.
 *   export const API_BASE_URL = 'http://192.168.8.102:3000/api';
 *
 * For production it's your deployed Render server, e.g.
 *   export const API_BASE_URL = 'https://your-app.onrender.com/api';
 *
 * NOTE: `EXPO_PUBLIC_API_URL` (set at build/start time) always wins over this
 * value, so you can override it without editing this file.
 *
 * When no backend is reachable the app shows an empty "No data yet / Connect
 * your backend" state (no fake/demo numbers are ever shown).
 */

const LOCAL_DEFAULT = 'https://app-monitor-1.onrender.com/api';
const LAN_ALTERNATE = 'http://192.168.8.116:3995/api';

export const API_BASE_URL: string =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  LOCAL_DEFAULT;

/** Backend URL (without trailing slash). */
export const BACKEND_URL = API_BASE_URL.replace(/\/+$/, '');

/** Whether the app should try to fetch from a real backend at all. */
export const HAS_BACKEND = Boolean(BACKEND_URL);

/** If the phone can't reach the primary IP, it can fall back to this one. */
export const ALTERNATE_BACKEND_URL = LAN_ALTERNATE;