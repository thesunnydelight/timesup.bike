// @ts-ignore - Deno/Edge runtime URL import, not resolvable by Node TypeScript
import type { Context } from "https://edge.netlify.com/";
import { CACHE_TTL_OPERATING, CACHE_TTL_MAX, CACHE_TTL_STALE_MAX_AGE } from '../../src/lib/config.ts';
import { calculateExpiration } from '../../src/lib/scheduleUtils.ts';

// Google Apps Script API endpoint
const GOOGLE_API_URL = 'https://script.google.com/macros/s/AKfycbzhGL1Zdvz5UBrqvFL3JAkCDNisd8wha3HCfK9cN1dfUwxu1zXIgX-vqGDHPMJr7U2h/exec';

// Cache key for storing the response (edge function in-memory cache)
const CACHE_KEY = 'chart-data-cache';

// In-memory cache with TTL
let cache: {
  data: any;
  expiration: number;
} | null = null;


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
