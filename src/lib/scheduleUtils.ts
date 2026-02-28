import {
	OPERATING_DAYS,
	OPERATING_HOUR_START,
	OPERATING_HOUR_END,
	TIMEZONE,
	CACHE_TTL_OPERATING,
	CACHE_TTL_MAX,
} from './config.ts';

// Check if current time is during operating hours (Sun/Wed 5pm-8pm ET)
export function isOperatingHours(): boolean {
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
	const nyTime = new Date(nyTimeString);
	const day = nyTime.getDay();
	const hour = nyTime.getHours();
	return OPERATING_DAYS.includes(day) && hour >= OPERATING_HOUR_START && hour < OPERATING_HOUR_END;
}

// Check if it's an operating day between midnight and closing time
export function isOperatingDayBeforeClose(): boolean {
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
	const nyTime = new Date(nyTimeString);
	return OPERATING_DAYS.includes(nyTime.getDay()) && nyTime.getHours() < OPERATING_HOUR_END;
}

// Check if there is an active announcement
export function hasActiveAnnouncement(data: any): boolean {
	if (!Array.isArray(data)) return false;
	return !!data.find((r: any) => r.Param === 'announcement')?.Value;
}

// Calculate the next shift midnight (returns UTC timestamp)
export function getNextShiftStart(): number {
	const now = new Date();
	const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
	const nyTime = new Date(nyTimeString);

	const currentDay = nyTime.getDay();
	const currentHour = nyTime.getHours();

	// Find days until the next operating day midnight.
	// Today counts only if we haven't passed closing time yet.
	let daysToAdd = 0;
	for (let i = 0; i <= 7; i++) {
		const checkDay = (currentDay + i) % 7;
		if (!OPERATING_DAYS.includes(checkDay)) continue;
		if (i === 0 && currentHour >= OPERATING_HOUR_END) continue;
		daysToAdd = i;
		break;
	}

	const nextShift = new Date(now);
	nextShift.setDate(nextShift.getDate() + daysToAdd);

	// Get the date string for the target day in NY timezone
	const targetDateString = nextShift.toLocaleString('en-US', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
	const [m, d, y] = targetDateString.split(/[\/,\s]+/).map(s => s.trim());

	// Find the UTC hour that corresponds to midnight NY time (EST=05:00, EDT=04:00 UTC)
	for (let utcHour = 3; utcHour <= 6; utcHour++) {
		const testDate = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), utcHour, 0, 0));
		const testNYHour = testDate.toLocaleString('en-US', { timeZone: TIMEZONE, hour: '2-digit', hour12: false });
		if (testNYHour === '00') {
			return testDate.getTime();
		}
	}

	return now.getTime() + CACHE_TTL_MAX;
}

// Calculate cache expiration timestamp
export function calculateExpiration(data?: any): number {
	if (isOperatingDayBeforeClose() || hasActiveAnnouncement(data)) {
		return Date.now() + CACHE_TTL_OPERATING;
	}
	return Math.min(Date.now() + CACHE_TTL_MAX, getNextShiftStart());
}
