// FlixRate v1.51 — reliable per-episode IMDb lookup through OMDb.
var omdbKey = '';
try {
  importScripts('config.js');
  omdbKey = typeof OMDB_API_KEY === 'string' ? OMDB_API_KEY : '';
} catch (error) {
  console.warn('[FlixRate] config.js not found. Add your OMDb key from config.example.js.');
}

const OMDB_ENDPOINT = 'https://www.omdbapi.com/';
const SUCCESS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheKeyFor({ title, season, episode }) {
  return `flixrate:${normalizeTitle(title)}:${season ?? 'none'}:${episode ?? 'none'}`;
}

async function getCached(key) {
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key];
  if (!entry) return null;
  const ttl = entry.ok ? SUCCESS_CACHE_TTL_MS : FAILURE_CACHE_TTL_MS;
  if (Date.now() - entry.ts >= ttl) return null;
  return entry.data;
}

async function setCached(key, data, ok) {
  await chrome.storage.local.set({ [key]: { ts: Date.now(), ok, data } });
}

function noRating(error, extra = {}) {
  return {
    rating: null,
    votes: 0,
    imdbID: null,
    error: error || 'No rating data',
    ...extra,
  };
}

function parseEpisodeResult(json, extra = {}) {
  if (!json || json.Response !== 'True') {
    return noRating(json?.Error || 'OMDb returned no result', extra);
  }

  const rating = json.imdbRating && json.imdbRating !== 'N/A'
    ? Number.parseFloat(json.imdbRating)
    : null;
  const votes = json.imdbVotes && json.imdbVotes !== 'N/A'
    ? Number.parseInt(String(json.imdbVotes).replace(/,/g, ''), 10)
    : 0;

  return {
    rating: Number.isFinite(rating) ? rating : null,
    votes: Number.isFinite(votes) ? votes : 0,
    imdbID: json.imdbID || null,
    title: json.Title || extra.title || null,
    season: json.Season ? Number.parseInt(json.Season, 10) : extra.season ?? null,
    episode: json.Episode ? Number.parseInt(json.Episode, 10) : extra.episode ?? null,
    error: null,
    source: 'OMDb',
  };
}

async function omdb(params) {
  const url = new URL(OMDB_ENDPOINT);
  url.search = new URLSearchParams({ apikey: omdbKey, r: 'json', ...params }).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OMDb HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function findSeriesId(title) {
  const json = await omdb({ s: title, type: 'series', page: '1' });
  const results = Array.isArray(json.Search) ? json.Search : [];
  if (json.Response !== 'True' || !results.length) return null;

  const wanted = normalizeTitle(title);
  const exact = results.find((item) => normalizeTitle(item.Title) === wanted);
  return (exact || results[0])?.imdbID || null;
}

async function fetchRating({ title, season, episode }) {
  if (!title) return noRating('No Netflix title');
  if (season == null || episode == null) return noRating('No season/episode detected');
  if (!omdbKey || omdbKey === 'YOUR_OMDB_API_KEY_HERE') {
    return noRating('Missing OMDb API key — check config.js');
  }

  const key = cacheKeyFor({ title, season, episode });
  const cached = await getCached(key);
  if (cached) return cached;

  let lastError = null;

  try {
    const json = await omdb({ t: title, Season: String(season), Episode: String(episode) });
    const result = parseEpisodeResult(json, { title, season, episode });
    if (result.rating != null || result.imdbID != null) {
      await setCached(key, result, true);
      return result;
    }
    lastError = new Error(result.error || 'Direct episode lookup failed');
  } catch (error) {
    lastError = error;
  }

  try {
    const seriesId = await findSeriesId(title);
    if (seriesId) {
      const json = await omdb({ i: seriesId, Season: String(season), Episode: String(episode) });
      const result = parseEpisodeResult(json, { title, season, episode });
      if (result.rating != null || result.imdbID != null) {
        await setCached(key, result, true);
        return result;
      }
      lastError = new Error(result.error || 'IMDb-ID episode lookup failed');
    } else {
      lastError = new Error('Series not found on OMDb');
    }
  } catch (error) {
    lastError = error;
  }

  const failure = noRating(lastError?.message || 'Episode not found', { title, season, episode });
  await setCached(key, failure, false);
  return failure;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'FLIXRATE_FETCH_RATING') return;
  fetchRating(message.payload || {})
    .then(sendResponse)
    .catch((error) => sendResponse(noRating(String(error))));
  return true;
});
