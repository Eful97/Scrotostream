const guardahd = require('./guardahd/index');
const guardaserie = require('./guardaserie/index');
const guardoserie = require('./guardoserie/index');
const streamingcommunity = require('./streamingcommunity/index');
const animeunity = require('./animeunity/index');
const animeworld = require('./animeworld/index');
const animesaturn = require('./animesaturn/index');
const cinemacity = require('./cinemacity/index');
const { createTimeoutSignal, CONTEXT_TIMEOUT } = require('./fetch_helper.js');
const { getCachedTmdbId, setCachedTmdbId } = require('./utils/cache.js');

const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
const MAX_STREAMS = 5;
const STREAM_CACHE = new Map();
const STREAM_CACHE_TTL = 10 * 60 * 1000;

function normalizeUrl(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        urlObj.search = '';
        urlObj.hash = '';
        return urlObj.toString().toLowerCase();
    } catch {
        return url.toLowerCase();
    }
}

function deduplicateStreams(streams) {
    const seen = new Map();
    const uniqueStreams = [];

    for (const stream of streams) {
        if (!stream || !stream.url) continue;

        const normalizedUrl = normalizeUrl(stream.url);
        if (!normalizedUrl) continue;

        const quality = stream.quality || 'Unknown';
        const key = `${normalizedUrl}::${quality}`;

        if (!seen.has(key)) {
            seen.set(key, true);
            uniqueStreams.push(stream);
        }
    }

    return uniqueStreams;
}

function getQualityScore(quality) {
    if (!quality) return 0;
    const q = quality.toLowerCase();
    if (q.includes('4k') || q.includes('2160')) return 400;
    if (q.includes('1440') || q.includes('2k')) return 300;
    if (q.includes('1080') || q.includes('fhd')) return 200;
    if (q.includes('720') || q.includes('hd')) return 100;
    if (q.includes('480') || q.includes('sd')) return 50;
    if (q.includes('360')) return 25;
    if (q.includes('240')) return 10;
    return 0;
}

function sortByQuality(streams) {
    return [...streams].sort((a, b) => getQualityScore(b.quality) - getQualityScore(a.quality));
}

async function fetchJsonWithTimeout(url, timeoutMs = CONTEXT_TIMEOUT) {
    if (typeof fetch === 'undefined') return null;

    const timeoutConfig = createTimeoutSignal(timeoutMs);

    try {
        const response = await fetch(url, { signal: timeoutConfig.signal });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    } finally {
        if (typeof timeoutConfig.cleanup === "function") {
            timeoutConfig.cleanup();
        }
    }
}

async function fetchTmdbIdFromImdb(imdbId, normalizedType) {
    if (!TMDB_API_KEY || !imdbId) return null;

    const cached = getCachedTmdbId(imdbId, normalizedType);
    if (cached) return cached;

    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const payload = await fetchJsonWithTimeout(url);
    if (!payload || typeof payload !== 'object') return null;

    let tmdbId = null;
    if (normalizedType === 'movie') {
        if (Array.isArray(payload.movie_results) && payload.movie_results.length > 0) {
            tmdbId = payload.movie_results[0].id;
        }
        if (!tmdbId && Array.isArray(payload.tv_results) && payload.tv_results.length > 0) {
            tmdbId = payload.tv_results[0].id;
        }
    } else {
        if (Array.isArray(payload.tv_results) && payload.tv_results.length > 0) {
            tmdbId = payload.tv_results[0].id;
        }
        if (!tmdbId && Array.isArray(payload.movie_results) && payload.movie_results.length > 0) {
            tmdbId = payload.movie_results[0].id;
        }
    }

    if (tmdbId) {
        setCachedTmdbId(imdbId, normalizedType, String(tmdbId));
    }

    return tmdbId;
}

async function resolveProviderRequestContext(id, type, season, seasonProvided = false) {
    const parsedSeason = Number.parseInt(season, 10);
    const normalizedRequestedSeason =
        Number.isInteger(parsedSeason) && parsedSeason >= 0
            ? parsedSeason
            : null;

    const context = {
        idType: 'raw',
        providerId: String(id || ''),
        requestedSeason: normalizedRequestedSeason,
        seasonProvided: seasonProvided === true,
        kitsuId: null,
        tmdbId: null,
        imdbId: null,
        canonicalSeason: normalizedRequestedSeason
    };

    let rawId = String(id || '');
    try {
        rawId = decodeURIComponent(rawId);
    } catch {
        // keep raw id
    }
    const idStr = rawId.trim();

    try {
        if (idStr.startsWith('tmdb:')) {
            context.idType = 'tmdb';
            const parts = idStr.split(':');
            if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
                context.tmdbId = parts[1];
            }
        } else if (idStr.startsWith('kitsu:')) {
            context.idType = 'kitsu';
            const parts = idStr.split(':');
            if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
                context.kitsuId = parts[1];
            }
        } else if (/^tt\d+$/i.test(idStr)) {
            context.idType = 'imdb';
            context.imdbId = idStr;
            const fallbackTmdbId = await fetchTmdbIdFromImdb(idStr, String(type || '').toLowerCase());
            if (fallbackTmdbId !== null && fallbackTmdbId !== undefined) {
                context.tmdbId = String(fallbackTmdbId);
            }
        } else if (/^\d+$/.test(idStr)) {
            context.idType = 'tmdb-numeric';
            context.tmdbId = idStr;
        }
    } catch {
        // Keep partial context.
    }

    return context;
}

function isLikelyAnimeRequest(type) {
    const normalizedType = String(type || '').toLowerCase();
    return normalizedType === 'anime';
}

function buildProviderRequestContext(context) {
    if (!context) return null;
    return {
        __requestContext: true,
        idType: context.idType,
        providerId: context.providerId,
        requestedSeason: context.requestedSeason,
        seasonProvided: context.seasonProvided === true,
        kitsuId: context.kitsuId,
        tmdbId: context.tmdbId,
        imdbId: context.imdbId
    };
}

async function getStreams(id, type, season, episode) {
    const normalizedType = String(type || '').toLowerCase();
    const parsedNormalizedSeason = Number.parseInt(season, 10);
    const normalizedSeason =
        Number.isInteger(parsedNormalizedSeason) && parsedNormalizedSeason >= 0
            ? parsedNormalizedSeason
            : null;
    const normalizedEpisode = Number.isInteger(episode) ? episode : (Number.parseInt(episode, 10) || 1);

    const cacheKey = `${id}:${normalizedType}:${normalizedSeason}:${normalizedEpisode}`;
    const cached = STREAM_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
        return cached.streams;
    }

    const providerContext = await resolveProviderRequestContext(id, normalizedType, normalizedSeason, false);
    const parsedCanonicalSeason = Number.parseInt(providerContext?.canonicalSeason, 10);
    const effectiveSeason =
        Number.isInteger(parsedCanonicalSeason) && parsedCanonicalSeason >= 0
            ? parsedCanonicalSeason
            : 1;
    const sharedContext = buildProviderRequestContext(providerContext);
    const promises = [];
    const likelyAnime = isLikelyAnimeRequest(normalizedType);

    const isKitsuRequest =
        String(providerContext?.idType || '').toLowerCase() === 'kitsu' ||
        /^kitsu:\d+$/i.test(String(id || '').trim());
    const isImdbRequest =
        String(providerContext?.idType || '').toLowerCase() === 'imdb' ||
        /^tt\d+$/i.test(String(id || '').trim()) ||
        !!(providerContext && providerContext.imdbId && /^tt\d+$/i.test(providerContext.imdbId));
    const selectedProviders = [];
    if (normalizedType === 'movie') {
        if (likelyAnime || isKitsuRequest) {
            selectedProviders.push('animeunity', 'animeworld', 'animesaturn', 'guardoserie', 'streamingcommunity', 'guardahd');
        } else {
            selectedProviders.push('streamingcommunity', 'guardahd', 'guardoserie', 'cinemacity');
        }
    } else if (normalizedType === 'anime') {
        selectedProviders.push('animeunity', 'animeworld', 'animesaturn', 'guardaserie', 'guardoserie');
    } else if (normalizedType === 'tv' || normalizedType === 'series') {
        if (likelyAnime) {
            selectedProviders.push('animeunity', 'animeworld', 'animesaturn', 'guardaserie', 'guardoserie');
        } else {
            if (isImdbRequest) {
                selectedProviders.push('streamingcommunity', 'guardaserie', 'guardoserie', 'cinemacity');
            } else {
                selectedProviders.push('streamingcommunity', 'guardaserie', 'guardoserie', 'animeunity', 'animeworld', 'animesaturn');
            }
        }
    } else {
        selectedProviders.push('streamingcommunity', 'guardahd', 'guardoserie', 'cinemacity');
    }

    for (const providerName of [...new Set(selectedProviders)]) {
        if (providerName === 'streamingcommunity') {
            promises.push(
                streamingcommunity.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'StreamingCommunity', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'StreamingCommunity', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'guardahd') {
            promises.push(
                guardahd.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode)
                    .then(s => ({ provider: 'GuardaHD', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'GuardaHD', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'guardaserie') {
            promises.push(
                guardaserie.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'Guardaserie', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'Guardaserie', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'animeunity') {
            promises.push(
                animeunity.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'AnimeUnity', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'AnimeUnity', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'animeworld') {
            promises.push(
                animeworld.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'AnimeWorld', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'AnimeWorld', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'animesaturn') {
            promises.push(
                animesaturn.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'AnimeSaturn', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'AnimeSaturn', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'guardoserie') {
            promises.push(
                guardoserie.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'Guardoserie', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'Guardoserie', error: e, status: 'rejected' }))
            );
        }
        if (providerName === 'cinemacity') {
            promises.push(
                cinemacity.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'CinemaCity', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'CinemaCity', error: e, status: 'rejected' }))
            );
        }
    }

    const results = await Promise.all(promises);
    const streams = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.streams) {
            streams.push(...result.streams);
        }
    }

    const deduplicated = deduplicateStreams(streams);
    const sorted = sortByQuality(deduplicated);
    const limited = sorted.slice(0, MAX_STREAMS);

    STREAM_CACHE.set(cacheKey, { streams: limited, timestamp: Date.now() });

    if (STREAM_CACHE.size > 100) {
        const firstKey = STREAM_CACHE.keys().next().value;
        STREAM_CACHE.delete(firstKey);
    }

    return limited;
}

module.exports = { getStreams };
