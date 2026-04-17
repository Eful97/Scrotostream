const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

class SimpleCache {
    constructor(ttl = CACHE_TTL, maxSize = MAX_CACHE_SIZE) {
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            value,
            expires: Date.now() + this.ttl
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    clear() {
        this.cache.clear();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expires) {
                this.cache.delete(key);
            }
        }
    }
}

const tmdbCache = new SimpleCache(30 * 60 * 1000, 200);
const streamUrlCache = new SimpleCache(10 * 60 * 1000, 300);
const metadataCache = new SimpleCache(20 * 60 * 1000, 200);

setInterval(() => {
    tmdbCache.cleanup();
    streamUrlCache.cleanup();
    metadataCache.cleanup();
}, 5 * 60 * 1000);

function getCachedTmdbId(imdbId, type) {
    const key = `tmdb:${imdbId}:${type}`;
    return tmdbCache.get(key);
}

function setCachedTmdbId(imdbId, type, tmdbId) {
    const key = `tmdb:${imdbId}:${type}`;
    tmdbCache.set(key, tmdbId);
}

function getCachedStreamUrl(key) {
    return streamUrlCache.get(key);
}

function setCachedStreamUrl(key, url) {
    streamUrlCache.set(key, url);
}

function getCachedMetadata(key) {
    return metadataCache.get(key);
}

function setCachedMetadata(key, metadata) {
    metadataCache.set(key, metadata);
}

module.exports = {
    SimpleCache,
    tmdbCache,
    streamUrlCache,
    metadataCache,
    getCachedTmdbId,
    setCachedTmdbId,
    getCachedStreamUrl,
    setCachedStreamUrl,
    getCachedMetadata,
    setCachedMetadata
};