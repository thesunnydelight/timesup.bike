import type { Context } from "https://edge.netlify.com/";

// Google Apps Script API endpoint
const GOOGLE_API_URL = 'https://script.google.com/macros/s/AKfycbzhGL1Zdvz5UBrqvFL3JAkCDNisd8wha3HCfK9cN1dfUwxu1zXIgX-vqGDHPMJr7U2h/exec';

// Cache key for storing the response
const CACHE_KEY = 'chart-data-cache';

// In-memory cache with TTL
let cache: {
  data: any;
  expiration: number;
} | null = null;

// Helper to check if we're in operating hours (Sun/Wed 5pm-8pm ET)
function isOperatingHours(): boolean {
  const now = new Date();
  const nyTimeString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const nyTime = new Date(nyTimeString);

  const day = nyTime.getDay(); // 0 = Sunday, 3 = Wednesday
  const hour = nyTime.getHours();

  const isOperatingDay = day === 0 || day === 3;
  const isOperatingTime = hour >= 17 && hour < 20;

  return isOperatingDay && isOperatingTime;
}

// Calculate next shift start time
function getNextShiftStart(): number {
  const now = new Date();
  const nyTimeString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const nyTime = new Date(nyTimeString);

  const currentDay = nyTime.getDay();
  const currentHour = nyTime.getHours();
  const shiftStartHour = 17;

  let daysToAdd = 0;

  if (currentDay === 0) {
    daysToAdd = currentHour < shiftStartHour ? 0 : 3;
  } else if (currentDay < 3) {
    daysToAdd = 3 - currentDay;
  } else if (currentDay === 3) {
    daysToAdd = currentHour < shiftStartHour ? 0 : 4;
  } else {
    daysToAdd = 7 - currentDay;
  }

  const nextShift = new Date(now);
  nextShift.setDate(nextShift.getDate() + daysToAdd);

  const targetDateNY = new Date(nextShift);
  const targetDateString = targetDateNY.toLocaleString('en-US', {
    timeZone: 'America/New_York',
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
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false
    });

    if (testNYTime.includes('17')) {
      return testDate.getTime();
    }
  }

  return now.getTime() + (24 * 60 * 60 * 1000);
}

// Calculate cache expiration
function calculateExpiration(): number {
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
    const expiration = calculateExpiration();
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
          'Cache-Control': 'public, max-age=300', // 5 minutes for stale data
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
