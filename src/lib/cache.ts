import {
	isOperatingHours,
	getNextShiftStart,
	calculateExpiration,
} from './scheduleUtils';
export { isOperatingHours, getNextShiftStart, calculateExpiration };

// Cache configuration
export const CACHE_KEY = 'timesup_chart_data';
export const CACHE_TIMESTAMP_KEY = 'timesup_chart_data_timestamp';
export const CACHE_EXPIRATION_KEY = 'timesup_chart_data_expiration';
export const CACHE_DEPLOY_KEY = 'timesup_deploy_id';

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
export function setCachedData(data: any): void {
	try {
		const now = Date.now();
		const expiration = calculateExpiration(data);
		localStorage.setItem(CACHE_KEY, JSON.stringify(data));
		localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
		localStorage.setItem(CACHE_EXPIRATION_KEY, expiration.toString());
	} catch (error) {
		console.error('Failed to cache data:', error);
	}
}
