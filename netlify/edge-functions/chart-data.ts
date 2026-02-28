// @ts-ignore - Deno/Edge runtime URL import, not resolvable by Node TypeScript
import type { Context } from "https://edge.netlify.com/";
import {
  OPERATING_DAYS,
  OPERATING_HOUR_START,
  OPERATING_HOUR_END,
  TIMEZONE,
  CACHE_TTL_OPERATING,
  CACHE_TTL_MAX,
  CACHE_TTL_STALE_MAX_AGE,
} from '../../src/lib/config.ts';

// Google Apps Script API endpoint
const GOOGLE_API_URL = 'https://script.google.com/macros/s/AKfycbzhGL1Zdvz5UBrqvFL3JAkCDNisd8wha3HCfK9cN1dfUwxu1zXIgX-vqGDHPMJr7U2h/exec';

// Cache key for storing the response (edge function in-memory cache)
const CACHE_KEY = 'chart-data-cache';

// In-memory cache with TTL
let cache: {
  data: any;
  expiration: number;
} | null = null;

// Helper to check if we're in operating hours (Sun/Wed 5pm-8pm ET)
function isOperatingHours(): boolean {
  const now = new Date();
  const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const nyTime = new Date(nyTimeString);

  const day = nyTime.getDay();
  const hour = nyTime.getHours();

  const isOperatingDay = OPERATING_DAYS.includes(day);
  const isOperatingTime = hour >= OPERATING_HOUR_START && hour < OPERATING_HOUR_END;

  return isOperatingDay && isOperatingTime;
}

// Calculate next shift start time
function getNextShiftStart(): number {
  const now = new Date();
  const nyTimeString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const nyTime = new Date(nyTimeString);

  const currentDay = nyTime.getDay();
  const currentHour = nyTime.getHours();

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

  const nextShift = new Date(now);
  nextShift.setDate(nextShift.getDate() + daysToAdd);

  const targetDateNY = new Date(nextShift);
  const targetDateString = targetDateNY.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [m, d, y] = targetDateString.split(/[\/,\s]+/).map(s => s.trim());

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

  return now.getTime() + CACHE_TTL_MAX;
}

// Check if it's an operating day between midnight and closing time
function isOperatingDayBeforeClose(): boolean {
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

// Calculate cache expiration
function calculateExpiration(data?: any): number {
  if (isOperatingDayBeforeClose() || hasActiveAnnouncement(data)) {
    return Date.now() + CACHE_TTL_OPERATING;
  } else {
    // Non-operating hours: minimum of 24 hours or time until next shift
    const twentyFourHours = Date.now() + CACHE_TTL_MAX;
    const nextShiftStart = getNextShiftStart();
    return Math.min(twentyFourHours, nextShiftStart);
  }
}

export default async (request: Request, context: Context) => {
  try {
    // Check if we have valid cached data
    const now = Date.now();

    if (cache && cache.expiration > now) {
      console.log('Serving from edge cache');

      // Calculate Cache-Control max-age based on remaining TTL
      const remainingTTL = Math.floor((cache.expiration - now) / 1000);

      return new Response(JSON.stringify(cache.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${remainingTTL}`,
          'X-Cache': 'HIT',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Cache miss or expired - fetch fresh data
    console.log('Fetching fresh data from Google API');

    const response = await fetch(GOOGLE_API_URL);

    if (!response.ok) {
      throw new Error(`Google API returned ${response.status}`);
    }

    const data = await response.json();

    // Update cache
    const expiration = calculateExpiration(data);
    cache = {
      data,
      expiration,
    };

    // Calculate Cache-Control max-age
    const maxAge = Math.floor((expiration - now) / 1000);

    console.log(`Cached until: ${new Date(expiration).toISOString()}`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${maxAge}`,
        'X-Cache': 'MISS',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);

    // If we have stale cache, serve it with a warning
    if (cache) {
      console.log('Serving stale cache due to error');
      return new Response(JSON.stringify(cache.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL_STALE_MAX_AGE}`,
          'X-Cache': 'STALE',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to fetch chart data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const config = {
  path: "/api/chart-data",
};
