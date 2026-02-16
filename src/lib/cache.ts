// Cache configuration
export const CACHE_KEY = 'timesup_chart_data';
export const CACHE_TIMESTAMP_KEY = 'timesup_chart_data_timestamp';
export const CACHE_EXPIRATION_KEY = 'timesup_chart_data_expiration';
export const TEST_MODE_TTL = 60 * 1000; // 1 minute (for testing)

// Check if current time is during operating hours (Sun/Wed 5pm-8pm Eastern Time)
export function isOperatingHours(): boolean {
	// Get current time in New York timezone
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
	const nyTime = new Date(nyTimeString);

	const day = nyTime.getDay(); // 0 = Sunday, 3 = Wednesday
	const hour = nyTime.getHours();

	// Check if it's Sunday (0) or Wednesday (3)
	const isOperatingDay = day === 0 || day === 3;
	// Check if time is between 5pm (17) and 8pm (20)
	const isOperatingTime = hour >= 17 && hour < 20;

	return isOperatingDay && isOperatingTime;
}

// Calculate the next shift start time (returns UTC timestamp)
export function getNextShiftStart(): number {
	// Get current time in New York timezone (using same pattern as isOperatingHours)
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
	const nyTime = new Date(nyTimeString);

	const currentDay = nyTime.getDay(); // 0 = Sunday, 3 = Wednesday
	const currentHour = nyTime.getHours();
	const shiftStartHour = 17; // 5pm

	// Calculate days to add to get to next shift
	let daysToAdd = 0;

	if (currentDay === 0) {
		// Sunday: if before 5pm, shift is today; otherwise Wednesday (3 days)
		daysToAdd = currentHour < shiftStartHour ? 0 : 3;
	} else if (currentDay < 3) {
		// Monday or Tuesday: next shift is this Wednesday
		daysToAdd = 3 - currentDay;
	} else if (currentDay === 3) {
		// Wednesday: if before 5pm, shift is today; otherwise Sunday (4 days)
		daysToAdd = currentHour < shiftStartHour ? 0 : 4;
	} else {
		// Thursday, Friday, Saturday: next shift is Sunday
		daysToAdd = 7 - currentDay;
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
		timeZone: 'America/New_York',
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
			timeZone: 'America/New_York',
			hour: '2-digit',
			hour12: false
		});

		if (testNYTime.includes('17')) {
			return testDate.getTime();
		}
	}

	// Fallback (shouldn't reach here, but just in case)
	return now.getTime() + (24 * 60 * 60 * 1000);
}

// Calculate cache expiration datetime
export function calculateExpiration(testOperatingHours: boolean = false): number {
	if (testOperatingHours) {
		return Date.now() + TEST_MODE_TTL;
	}

	if (isOperatingHours()) {
		// During operating hours: 1 minute expiration
		return Date.now() + (1 * 60 * 1000);
	} else {
		// Non-operating hours: minimum of 24 hours or time until next shift
		const twentyFourHours = Date.now() + (24 * 60 * 60 * 1000);
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
		const expiration = calculateExpiration(testOperatingHours);
		localStorage.setItem(CACHE_KEY, JSON.stringify(data));
		localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
		localStorage.setItem(CACHE_EXPIRATION_KEY, expiration.toString());
	} catch (error) {
		console.error('Failed to cache data:', error);
	}
}
