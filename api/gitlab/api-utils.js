/**
 * Utility functions for GitLab API interactions
 */

// Simple in-memory cache
const apiCache = new Map();

/**
 * Get or set cached data with TTL support
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttlMs - Time to live in milliseconds
 * @param {boolean} forceRefresh - Force refresh ignoring cache
 * @returns {Promise<*>} - Cached or fresh data
 */
exports.getOrSetCache = async (key, fetchFn, ttlMs = 300000, forceRefresh = false) => {
  const now = Date.now();
  const cached = apiCache.get(key);
  
  // Return cached item if valid and not forcing refresh
  if (!forceRefresh && cached && cached.timestamp > (now - ttlMs)) {
    console.log(`Cache hit for key: ${key}`);
    return {
      data: cached.data,
      fromCache: true,
      cachedAt: new Date(cached.timestamp).toISOString()
    };
  }
  
  // Fetch fresh data
  console.log(`Cache miss or refresh forced for key: ${key}`);
  const data = await fetchFn();
  
  // Store in cache
  apiCache.set(key, {
    data,
    timestamp: now
  });
  
  return {
    data,
    fromCache: false,
    cachedAt: new Date(now).toISOString()
  };
};

/**
 * Clear all cached data or specific key
 * @param {string} [key] - Optional specific key to clear
 */
exports.clearCache = (key) => {
  if (key) {
    apiCache.delete(key);
    console.log(`Cleared cache for key: ${key}`);
  } else {
    apiCache.clear();
    console.log('Cleared all cache');
  }
};

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
exports.getCacheStats = () => {
  const stats = {
    size: apiCache.size,
    keys: [],
    totalSizeBytes: 0
  };
  
  apiCache.forEach((value, key) => {
    // Estimate size in bytes (very rough approximation)
    const size = JSON.stringify(value.data).length;
    stats.totalSizeBytes += size;
    
    stats.keys.push({
      key,
      age: Date.now() - value.timestamp,
      sizeBytes: size
    });
  });
  
  return stats;
};

/**
 * Retries a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<*>} - Function result
 */
exports.withRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    factor = 2,
    retryCondition = (error) => true
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (!retryCondition(error)) {
        throw error;
      }
      
      // Last attempt, don't wait
      if (attempt >= maxRetries - 1) {
        throw error;
      }
      
      // Calculate backoff delay
      const delay = Math.min(
        initialDelayMs * Math.pow(factor, attempt),
        maxDelayMs
      );
      
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};