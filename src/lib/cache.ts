import {
	OPERATING_DAYS,
	OPERATING_HOUR_START,
	OPERATING_HOUR_END,
	TIMEZONE,
	CACHE_TTL_OPERATING,
	CACHE_TTL_MAX,
	TEST_MODE_TTL,
} from './config';

// Cache configuration
export const CACHE_KEY = 'timesup_chart_data';
export const CACHE_TIMESTAMP_KEY = 'timesup_chart_data_timestamp';
export const CACHE_EXPIRATION_KEY = 'timesup_chart_data_expiration';
export const CACHE_DEPLOY_KEY = 'timesup_deploy_id';
export { TEST_MODE_TTL };

// Clear all cached data
export function clearCache(): void {
	try {
		localStorage.removeItem(CACHE_KEY);
		localStorage.removeItem(CACHE_TIMESTAMP_KEY);
		localStorage.removeItem(CACHE_EXPIRATION_KEY);
	} catch (error) {
		console.error('Failed to clear cache:', error);
	}
}

// Check if current time is during operating hours (Sun/Wed 5pm-8pm Eastern Time)
export function isOperatingHours(): boolean {
	// Get current time in New York timezone
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
	const nyTime = new Date(nyTimeString);

	const day = nyTime.getDay();
	const hour = nyTime.getHours();

	const isOperatingDay = OPERATING_DAYS.includes(day);
	const isOperatingTime = hour >= OPERATING_HOUR_START && hour < OPERATING_HOUR_END;

	return isOperatingDay && isOperatingTime;
}

// Calculate the next shift start time (returns UTC timestamp)
export function getNextShiftStart(): number {
	// Get current time in New York timezone (using same pattern as isOperatingHours)
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
	const nyTime = new Date(nyTimeString);

	const currentDay = nyTime.getDay();
	const currentHour = nyTime.getHours();

	// Calculate days to add to get to next shift
	let daysToAdd = 0;

	if (currentDay === OPERATING_DAYS[0]) {
		// First operating day: shift is today if before start, otherwise jump to second operating day
		daysToAdd = currentHour < OPERATING_HOUR_START ? 0 : OPERATING_DAYS[1] - OPERATING_DAYS[0];
	} else if (currentDay < OPERATING_DAYS[1]) {
		// Between first and second operating day: next shift is the second operating day
		daysToAdd = OPERATING_DAYS[1] - currentDay;
	} else if (currentDay === OPERATING_DAYS[1]) {
		// Second operating day: shift is today if before start, otherwise jump to first operating day next week
		daysToAdd = currentHour < OPERATING_HOUR_START ? 0 : 7 - (OPERATING_DAYS[1] + OPERATING_DAYS[0]);
	} else {
		// After second operating day: next shift is first operating day next week
		daysToAdd = 7 + OPERATING_DAYS[0] - currentDay;
	}

	// Create next shift date by adding days to the actual current time
	// (not the NY-time-parsed-as-local which is offset)
	const nextShift = new Date(now);
	nextShift.setDate(nextShift.getDate() + daysToAdd);

	// Set to 5pm NY time by determining what UTC hour that is
	// NY is UTC-5 (EST) or UTC-4 (EDT), so 5pm NY is either 22:00 or 21:00 UTC
	// We'll format the target date in NY timezone to find the right hour
	const targetDateNY = new Date(nextShift);

	// Get midnight of target day in NY timezone
	const targetDateString = targetDateNY.toLocaleString('en-US', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const [m, d, y] = targetDateString.split(/[\/,\s]+/).map(s => s.trim());

	// Try different UTC hours to find which one gives us 5pm NY time
	for (let utcHour = 20; utcHour <= 23; utcHour++) {
		const testDate = new Date(Date.UTC(
			parseInt(y),
			parseInt(m) - 1,
			parseInt(d),
			utcHour,
			0,
			0
		));

		const testNYTime = testDate.toLocaleString('en-US', {
			timeZone: TIMEZONE,
			hour: '2-digit',
			hour12: false
		});

		if (testNYTime.includes(String(OPERATING_HOUR_START))) {
			return testDate.getTime();
		}
	}

	// Fallback (shouldn't reach here, but just in case)
	return now.getTime() + CACHE_TTL_MAX;
}

// Check if it's an operating day between midnight and closing time
export function isOperatingDayBeforeClose(): boolean {
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
	const nyTime = new Date(nyTimeString);
	return OPERATING_DAYS.includes(nyTime.getDay()) && nyTime.getHours() < OPERATING_HOUR_END;
}

// Check if there is an active announcement
function hasActiveAnnouncement(data: any): boolean {
	if (!Array.isArray(data)) return false;
	return !!data.find((r: any) => r.Param === 'announcement')?.Value;
}

// Calculate cache expiration datetime
export function calculateExpiration(testOperatingHours: boolean = false, data?: any): number {
	if (testOperatingHours) {
		return Date.now() + TEST_MODE_TTL;
	}

	if (isOperatingDayBeforeClose() || hasActiveAnnouncement(data)) {
		return Date.now() + CACHE_TTL_OPERATING;
	} else {
		// Non-operating hours: minimum of 24 hours or time until next shift
		const twentyFourHours = Date.now() + CACHE_TTL_MAX;
		const nextShiftStart = getNextShiftStart();
		return Math.min(twentyFourHours, nextShiftStart);
	}
}

// Check if cached data is still valid
export function isCacheValid(): boolean {
	try {
		const expiration = localStorage.getItem(CACHE_EXPIRATION_KEY);
		if (!expiration) return false;

		const expirationTime = parseInt(expiration);
		return Date.now() < expirationTime;
	} catch (error) {
		return false;
	}
}

// Get cached data
export function getCachedData(): any {
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		return cached ? JSON.parse(cached) : null;
	} catch (error) {
		return null;
	}
}

// Save data to cache
export function setCachedData(data: any, testOperatingHours: boolean = false): void {
	try {
		const now = Date.now();
		const expiration = calculateExpiration(testOperatingHours, data);
		localStorage.setItem(CACHE_KEY, JSON.stringify(data));
		localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
		localStorage.setItem(CACHE_EXPIRATION_KEY, expiration.toString());
	} catch (error) {
		console.error('Failed to cache data:', error);
	}
}
