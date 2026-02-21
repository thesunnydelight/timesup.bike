import { getCachedData, setCachedData, isCacheValid, CACHE_TIMESTAMP_KEY } from './cache';
import { isOperatingHours } from './cache';
import { showToast, createMultiClickHandler } from './toast';

// Retry configuration for API failures
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // 1s, 3s, 10s exponential backoff

// Track if background refresh is in progress
let isBackgroundRefreshing = false;

// API endpoint
const API_URL = 'https://script.google.com/macros/s/AKfycbzhGL1Zdvz5UBrqvFL3JAkCDNisd8wha3HCfK9cN1dfUwxu1zXIgX-vqGDHPMJr7U2h/exec';

// Extract shift_1 through shift_20 values
function getShiftData(dataMap: Record<string, any>, prefix: string): number[] {
	const values: number[] = [];
	for (let i = 1; i <= 20; i++) {
		const key = `${prefix}_${i}`;
		values.push(Number(dataMap[key]) || 0);
	}
	return values;
}

// Format date from ISO string to "Sunday - Feb 1" format
function formatDate(dateString: string): string {
	if (!dateString) return '';
	try {
		const date = new Date(dateString);
		const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
		const month = date.toLocaleDateString('en-US', { month: 'short' });
		const day = date.getDate();
		return `${dayName} - ${month} ${day}`;
	} catch (error) {
		console.error('Error formatting date:', error);
		return dateString;
	}
}

// Check if a date string is today
function isToday(dateString: string): boolean {
	if (!dateString) return false;
	try {
		const date = new Date(dateString);
		const today = new Date();
		return date.toDateString() === today.toDateString();
	} catch (error) {
		console.error('Error checking if date is today:', error);
		return false;
	}
}

interface ChartData {
	date: string;
	shiftData: number[];
	users: number;
	volunteers: number;
}

// Render a single chart
export function renderChart(chartId: string, data: ChartData, testOperatingHours: boolean = false): void {
	const { date, shiftData, users, volunteers } = data;

	// Calculate total
	const total = users + volunteers;

	// Get elements
	const headerEl = document.getElementById(`${chartId}-chart-header`);
	const iconsEl = document.getElementById(`${chartId}-chart-icons`);
	const barsEl = document.getElementById(`${chartId}-chart-bars`);

	// Check if content is actually changing (to avoid unnecessary animations)
	const newHeaderText = formatDate(date) || 'Loading...';
	const headerChanged = headerEl && headerEl.textContent !== newHeaderText;
	const iconsChanged = iconsEl && !iconsEl.textContent.includes(`${users}`);

	// Render header with formatted date
	if (headerEl) {
		if (headerChanged) {
			headerEl.classList.add('updating');
			setTimeout(() => {
				headerEl.textContent = newHeaderText;
				headerEl.classList.remove('updating');
			}, 100);
		} else {
			headerEl.textContent = newHeaderText;
		}
	}

	// Render icons row
	if (iconsEl) {
		const newIconsHTML = `
			<span>${users} 🤷‍♂️</span>
			<span>${volunteers} 🛠️</span>
			<span>${total}🧍</span>
		`;
		if (iconsChanged) {
			iconsEl.classList.add('updating');
			setTimeout(() => {
				iconsEl.innerHTML = newIconsHTML;
				iconsEl.classList.remove('updating');
			}, 100);
		} else {
			iconsEl.innerHTML = newIconsHTML;
		}
	}

	// Render bars
	if (barsEl) {
		const maxValue = Math.max(...shiftData);
		const isActive = chartId === 'curr' && (testOperatingHours || (isOperatingHours() && isToday(date)));

		// Get existing bars or create new ones
		let barElements = barsEl.querySelectorAll('.chart-bar');

		// If no bars exist or wrong count, create them
		if (barElements.length !== shiftData.length) {
			const bars = shiftData.map(() => {
				return `<div class="chart-bar" style="height: 0%"></div>`;
			}).join('');
			barsEl.innerHTML = bars;
			barElements = barsEl.querySelectorAll('.chart-bar');
		}

		// Update existing bars (this triggers CSS transitions)
		barElements.forEach((bar, index) => {
			const value = shiftData[index];
			const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
			const isPeak = value === maxValue && value > 0;

			// Update height (this will animate due to CSS transition)
			(bar as HTMLElement).style.height = `${height}%`;

			// Update classes
			bar.className = 'chart-bar';
			if (isPeak) bar.classList.add('peak');
			if (isActive) bar.classList.add('active');
		});
	}
}

// Animate a number counter from start to end
function animateCounter(element: HTMLElement, start: number, end: number, duration: number = 500, suffix: string = ''): void {
	if (start === end) return;

	const startTime = performance.now();
	const difference = end - start;

	function update(currentTime: number) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);

		// Easing function (ease-out)
		const easeOut = 1 - Math.pow(1 - progress, 3);
		const current = Math.floor(start + (difference * easeOut));

		element.textContent = current + suffix;

		if (progress < 1) {
			requestAnimationFrame(update);
		} else {
			element.textContent = end + suffix;
		}
	}

	requestAnimationFrame(update);
}

// Update footer slogan
export function updateFooterSlogan(dataMap: Record<string, any>): void {
	const footerSlogan = document.getElementById('footer-slogan');
	const numBikesFixed = Number(dataMap.customers);
	const numVolunteers = Number(dataMap.volunteers);
	const numVisits = Number(dataMap.visits);
	const daysOfData = dataMap.days_of_data;
	const mvpVolStr = dataMap.mvp_vol_str;

	// Get last updated timestamp for tooltip
	const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
	let lastUpdated = 'Unknown';
	if (timestamp) {
		const date = new Date(parseInt(timestamp));
		const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
		const shortDate = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
		const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
		lastUpdated = `${dayOfWeek} ${shortDate} at ${time}`;
	}

	const tooltipText = `Last updated on ${lastUpdated}.\nData from ${daysOfData}`;
	const toastVolText = `${mvpVolStr}\n\n${tooltipText}`;
	
	const toastDuration = 5000;
	const toastLongDuration = toastDuration * 3;
	const toastRefreshText = "📡  Refreshing data";

	if (footerSlogan && numBikesFixed && numVolunteers && numVisits) {
		const totalBikes = numBikesFixed + numVolunteers;
		
		// Check if pills already exist
		let repairsPill = footerSlogan.querySelector('.stat-pill-red strong') as HTMLElement | null;
		let visitsPill = footerSlogan.querySelector('.stat-pill-blue strong') as HTMLElement | null;
		const isFirstLoad = !repairsPill || !visitsPill;

		// If pills don't exist, create them with actual values
		if (isFirstLoad) {
			footerSlogan.innerHTML = `
				<span class="stat-pill stat-pill-red"><strong>${totalBikes}+</strong>&nbsp;repairs</span>&nbsp;
				<span class="stat-pill stat-pill-blue" title="${tooltipText}"><strong>${numVisits}</strong>&nbsp;visits</span>
			`;
			repairsPill = footerSlogan.querySelector('.stat-pill-red strong');
			visitsPill = footerSlogan.querySelector('.stat-pill-blue strong');

			// Add triple-click handler to red pill for mobile tooltip
			const redPill = footerSlogan.querySelector('.stat-pill-red');
			if (redPill) {
				createMultiClickHandler(redPill as HTMLElement, 3, () => {
					showToast(toastVolText, toastLongDuration);
				});
			}

			// Add triple-click handler to blue pill to force refresh data
			const bluePill = footerSlogan.querySelector('.stat-pill-blue');
			if (bluePill) {
				createMultiClickHandler(bluePill as HTMLElement, 3, () => {
					showToast(toastRefreshText, toastDuration);
					fetchAndRenderCharts(true);
				});
			}
		}

		// Only animate if this is not the first load
		if (!isFirstLoad && repairsPill && visitsPill) {
			// Update tooltip with latest timestamp
			const visitsPillParent = visitsPill.parentElement;
			const repairsPillParent = repairsPill.parentElement;

			if (visitsPillParent) {
				visitsPillParent.setAttribute('title', tooltipText);

				// Update the triple-click handler on blue pill for force refresh
				// Remove old handler if exists
				const oldBlueHandler = (visitsPillParent as any).__tripleClickCleanup;
				if (oldBlueHandler) {
					oldBlueHandler();
				}

				// Add new handler for force refresh
				const blueCleanup = createMultiClickHandler(visitsPillParent, 3, () => {
					showToast(toastRefreshText, toastDuration);
					fetchAndRenderCharts(true);
				});
				(visitsPillParent as any).__tripleClickCleanup = blueCleanup;
			}

			// Update the triple-click handler on red pill with new tooltip text
			if (repairsPillParent) {
				// Remove old handler if exists
				const oldHandler = (repairsPillParent as any).__tripleClickCleanup;
				if (oldHandler) {
					oldHandler();
				}

				// Add new handler with updated text
				const cleanup = createMultiClickHandler(repairsPillParent, 3, () => {
					showToast(toastVolText, toastLongDuration);
				});
				(repairsPillParent as any).__tripleClickCleanup = cleanup;
			}

			// Get current values
			const currentRepairs = parseInt(repairsPill.textContent || '0') || 0;
			const currentVisits = parseInt(visitsPill.textContent || '0') || 0;

			// Animate to new values if they changed
			if (currentRepairs !== totalBikes) {
				repairsPill.parentElement?.classList.add('updating');
				animateCounter(repairsPill, currentRepairs, totalBikes, 600, '+');
				setTimeout(() => repairsPill?.parentElement?.classList.remove('updating'), 650);
			}

			if (currentVisits !== numVisits) {
				visitsPill.parentElement?.classList.add('updating');
				animateCounter(visitsPill, currentVisits, numVisits, 600, '');
				setTimeout(() => visitsPill?.parentElement?.classList.remove('updating'), 650);
			}
		}
	}
}

// Fetch and render charts and footer slogan
export async function fetchAndRenderCharts(forceRefresh: boolean = false, testOperatingHours: boolean = false, buildTimeData: any = null): Promise<void> {
	try {
		let data;

		// Check for build-time data first (for instant initial load)
		if (buildTimeData && !getCachedData()) {
			data = buildTimeData;
			// Use setCachedData to ensure all cache keys are set (including expiration)
			setCachedData(data, testOperatingHours);
		}
		// Check cache - use if valid and not forcing refresh
		else if (isCacheValid() && !forceRefresh) {
			data = getCachedData();
		}
		// SWR: Use stale cache while revalidating in background
		else if (!isCacheValid() && !forceRefresh) {
			const staleData = getCachedData();
			if (staleData && !isBackgroundRefreshing) {
				console.log('Using stale cache while revalidating...');
				data = staleData;
				// Fetch fresh data in background
				isBackgroundRefreshing = true;
				fetchAndRenderCharts(true, testOperatingHours).finally(() => {
					isBackgroundRefreshing = false;
				});
			}
		}

		// Fetch fresh data if needed (cache miss, invalid, or force refresh)
		if (!data || forceRefresh) {
			try {
				const response = await fetch(API_URL);

				if (!response.ok) {
					throw new Error(`API returned ${response.status}`);
				}

				data = await response.json();
				setCachedData(data, testOperatingHours);
				retryCount = 0; // Reset retry count on success
			} catch (fetchError) {
				console.error('Error fetching fresh data:', fetchError);

				// Try to use stale cache as fallback
				const staleData = getCachedData();
				if (staleData) {
					console.warn('Using stale cache due to fetch error');
					data = staleData;
				} else if (retryCount < MAX_RETRIES) {
					// Schedule retry with exponential backoff
					const delay = RETRY_DELAYS[retryCount];
					console.log(`Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
					retryCount++;
					setTimeout(() => fetchAndRenderCharts(false, testOperatingHours), delay);
					return; // Exit early, retry will call this function again
				} else {
					// All retries failed, show error to user
					console.error('Failed to fetch data after all retries');
					document.querySelectorAll('.chart-loading').forEach(el => {
						el.textContent = 'Failed to load data';
					});
					return;
				}
			}
		}

		// Parse data into a map for easier access
		const dataMap: Record<string, any> = {};
		data.forEach((item: any) => {
			dataMap[item.Param] = item.Value;
		});

		// Render previous shift chart
		renderChart('prev', {
			date: dataMap.prev_shift_date,
			shiftData: getShiftData(dataMap, 'prev_shift'),
			users: Number(dataMap.prev_shift_users) || 0,
			volunteers: Number(dataMap.prev_shift_volunteers) || 0
		}, testOperatingHours);

		// Render current shift chart
		renderChart('curr', {
			date: dataMap.curr_shift_date,
			shiftData: getShiftData(dataMap, 'curr_shift'),
			users: Number(dataMap.curr_shift_users) || 0,
			volunteers: Number(dataMap.curr_shift_volunteers) || 0
		}, testOperatingHours);

		// Update footer slogan
		updateFooterSlogan(dataMap);

		// Hide loading indicators
		document.querySelectorAll('.chart-loading').forEach(el => {
			el.classList.add('hidden');
		});

	} catch (error) {
		console.error('Error fetching chart data:', error);
	}
}

// Set up automatic polling based on operating hours
export function startPolling(testOperatingHours: boolean = false): void {
	// Set up interval to check and refresh cache
	setInterval(async () => {
		if (!isCacheValid()) {
			await fetchAndRenderCharts(false, testOperatingHours);
		}
	}, 60000); // Check every minute

	// Also check when page becomes visible (tab switching)
	document.addEventListener('visibilitychange', async () => {
		if (!document.hidden && !isCacheValid()) {
			await fetchAndRenderCharts(false, testOperatingHours);
		}
	});
}
