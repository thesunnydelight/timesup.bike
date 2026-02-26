// Operating schedule
export const OPERATING_DAYS = [0, 3]; // 0 = Sunday, 3 = Wednesday
export const OPERATING_HOUR_START = 17; // 5pm ET
export const OPERATING_HOUR_END = 20;   // 8pm ET
export const TIMEZONE = 'America/New_York';

// Check if current time is during operating hours (Sun/Wed 5pm-8pm Eastern Time)
export function isOperatingHours(): boolean {
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
	const nyTime = new Date(nyTimeString);
	const day = nyTime.getDay();
	const hour = nyTime.getHours();
	return OPERATING_DAYS.includes(day) && hour >= OPERATING_HOUR_START && hour < OPERATING_HOUR_END;
}

// Cache TTLs (in milliseconds unless noted)
export const CACHE_TTL_OPERATING = 1 * 60 * 1000;    // 1 minute during shifts
export const CACHE_TTL_MAX = 24 * 60 * 60 * 1000;    // 24 hours outside shifts
export const CACHE_TTL_STALE_MAX_AGE = 300;           // 5 minutes (seconds) for stale data headers
export const TEST_MODE_TTL = 60 * 1000;               // 1 minute for testing

// Polling & retry
export const POLLING_INTERVAL = 10000;                // 10 seconds
export const MAX_RETRIES = 3;
export const RETRY_DELAYS = [1000, 3000, 10000];      // 1s, 3s, 10s exponential backoff

// UI
export const COUNTER_ANIMATION_DURATION = 600;        // ms
export const TOAST_DURATION = 5000;                   // 5 seconds
export const TOAST_LONG_DURATION = TOAST_DURATION * 3; // 15 seconds
