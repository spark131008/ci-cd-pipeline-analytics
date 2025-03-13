const axios = require('axios');

// Create an axios instance with default configuration
const createGitLabClient = (baseURL, token, timeout = 10000) => {
  return axios.create({
    baseURL,
    timeout,
    headers: { 'PRIVATE-TOKEN': token }
  });
};

// Simple in-memory cache with 10-minute TTL
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Check if URL is accessible with a quick health check
const checkGitLabAccess = async (client) => {
  try {
    const start = Date.now();
    const response = await client.get('/api/v4/version');
    const duration = Date.now() - start;
    
    console.log(`GitLab version check completed in ${duration}ms`);
    console.log(`GitLab version: ${response.data.version}`);
    
    return {
      accessible: true,
      version: response.data.version,
      responseTime: duration
    };
  } catch (error) {
    console.error('GitLab version check failed:', error.message);
    return {
      accessible: false,
      error: error.message
    };
  }
};

// Faster fetch with parallel requests and early return capability
module.exports = async (req, res) => {
  console.log('---- FETCH NAMESPACES API CALLED ----');
  const startTime = Date.now();
  
  // Set a timeout to ensure we send at least partial results if available
  let responseTimeout;
  let hasResponded = false;
  const MAX_EXECUTION_TIME = 25000; // 25 seconds max execution time
  
  responseTimeout = setTimeout(() => {
    if (!hasResponded && cache.has('partial_results')) {
      const partialData = cache.get('partial_results');
      console.log(`Returning partial results after ${MAX_EXECUTION_TIME}ms (${partialData.length} groups)`);
      
      hasResponded = true;
      res.status(206).json({
        namespaces: partialData,
        complete: false,
        message: 'Partial results returned due to timeout',
        timestamp: new Date().toISOString()
      });
    }
  }, MAX_EXECUTION_TIME);
  
  // Ensure we clean up the timeout
  const cleanupTimeout = () => {
    if (responseTimeout) {
      clearTimeout(responseTimeout);
      responseTimeout = null;
    }
  };
  
  // Handle initial validation
  if (req.method !== 'POST') {
    cleanupTimeout();
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { gitlabUrl, authMethod, personalAccessToken, forceRefresh } = req.body;
    
    // Validate required fields
    if (!gitlabUrl || !personalAccessToken) {
      cleanupTimeout();
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['gitlabUrl', 'personalAccessToken']
      });
    }
    
    // Check if we have a cached response
    const cacheKey = `${gitlabUrl}_${personalAccessToken.substring(0, 8)}`;
    if (!forceRefresh && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      const now = Date.now();
      
      if (now - cachedData.timestamp < CACHE_TTL) {
        console.log(`Using cached response (${cachedData.data.length} groups)`);
        cleanupTimeout();
        
        return res.json({
          namespaces: cachedData.data,
          fromCache: true,
          timestamp: new Date(cachedData.timestamp).toISOString()
        });
      }
    }
    
    // Prepare cleaned URL
    const cleanGitlabUrl = gitlabUrl.trim().replace(/\/$/, '');
    if (!cleanGitlabUrl.startsWith('http')) {
      cleanupTimeout();
      return res.status(400).json({ error: 'GitLab URL must start with http:// or https://' });
    }
    
    // Create client
    const client = createGitLabClient(cleanGitlabUrl, personalAccessToken, 10000);
    
    // Do a quick health check first to fail fast if GitLab is inaccessible
    const healthCheck = await checkGitLabAccess(client);
    if (!healthCheck.accessible) {
      cleanupTimeout();
      return res.status(503).json({
        error: 'GitLab API is not accessible',
        details: healthCheck.error,
        suggestion: 'Please check your GitLab URL and token'
      });
    }
    
    // We'll use this to collect groups as they come in
    let allGroups = [];
    
    // Store partial results in cache as we fetch them
    const storePartialResults = (groups) => {
      if (groups && groups.length > 0) {
        allGroups = [...allGroups, ...groups];
        cache.set('partial_results', allGroups.map(group => ({
          id: group.id,
          name: group.name,
          path: group.path,
          kind: 'group',
          full_path: group.full_path || `${group.path}`
        })));
      }
    };
    
    try {
      // Fetch first page to get pagination info
      console.log('Fetching first page of groups...');
      const firstPageResponse = await client.get('/api/v4/groups', {
        params: {
          min_access_level: 20,
          per_page: 100,
          page: 1,
          simple: true
        }
      });
      
      const firstPageGroups = firstPageResponse.data;
      storePartialResults(firstPageGroups);
      
      const totalPages = parseInt(firstPageResponse.headers['x-total-pages'] || '1', 10);
      const totalItems = parseInt(firstPageResponse.headers['x-total'] || firstPageGroups.length, 10);
      
      console.log(`Found ${totalItems} total groups across ${totalPages} pages`);
      
      // If we only have one page, we're done
      if (totalPages <= 1) {
        console.log('Only one page of results, finishing early');
        const namespaces = allGroups.map(group => ({
          id: group.id,
          name: group.name,
          path: group.path,
          kind: 'group',
          full_path: group.full_path || `${group.path}`
        }));
        
        // Store in cache
        cache.set(cacheKey, {
          data: namespaces,
          timestamp: Date.now()
        });
        
        cleanupTimeout();
        return res.json({
          namespaces,
          fromCache: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // For multiple pages, fetch remaining pages in parallel with limit
      const MAX_CONCURRENT = 3; // Limit concurrent requests
      const MAX_PAGES = Math.min(totalPages, 10); // Cap at 10 pages max
      
      console.log(`Fetching ${MAX_PAGES-1} more pages with max ${MAX_CONCURRENT} concurrent requests`);
      
      // Create batches of pages to fetch
      const remainingPages = Array.from({ length: MAX_PAGES - 1 }, (_, i) => i + 2);
      const batches = [];
      
      for (let i = 0; i < remainingPages.length; i += MAX_CONCURRENT) {
        batches.push(remainingPages.slice(i, i + MAX_CONCURRENT));
      }
      
      // Process batches sequentially, but pages within a batch in parallel
      for (const batch of batches) {
        const batchPromises = batch.map(page => {
          return client.get('/api/v4/groups', {
            params: {
              min_access_level: 20,
              per_page: 100,
              page,
              simple: true
            }
          }).then(response => {
            console.log(`Fetched page ${page} with ${response.data.length} groups`);
            storePartialResults(response.data);
            return response.data;
          }).catch(error => {
            console.error(`Error fetching page ${page}:`, error.message);
            return []; // Return empty array on error to continue processing
          });
        });
        
        await Promise.all(batchPromises);
      }
      
      // Final processing of all groups
      console.log(`Successfully fetched ${allGroups.length} groups total`);
      
      const namespaces = allGroups.map(group => ({
        id: group.id,
        name: group.name,
        path: group.path,
        kind: 'group',
        full_path: group.full_path || `${group.path}`
      }));
      
      // Store complete results in cache
      cache.set(cacheKey, {
        data: namespaces,
        timestamp: Date.now()
      });
      
      // Only respond if we haven't sent a partial response yet
      if (!hasResponded) {
        cleanupTimeout();
        const duration = Date.now() - startTime;
        console.log(`Completed in ${duration}ms with ${namespaces.length} groups`);
        
        return res.json({
          namespaces,
          fromCache: false,
          complete: true,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error fetching groups:', error.message);
      
      // If we have partial results and haven't responded yet, return them
      if (!hasResponded && cache.has('partial_results')) {
        const partialData = cache.get('partial_results');
        if (partialData && partialData.length > 0) {
          hasResponded = true;
          cleanupTimeout();
          
          return res.status(206).json({
            namespaces: partialData,
            complete: false,
            error: error.message,
            message: 'Partial results returned due to error',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // If we don't have partial results or already responded, return error
      if (!hasResponded) {
        cleanupTimeout();
        
        // Format error response based on type
        if (error.response) {
          return res.status(error.response.status).json({
            error: 'GitLab API error',
            status: error.response.status,
            message: error.response.data?.message || error.message
          });
        } else if (error.code === 'ECONNABORTED') {
          return res.status(504).json({
            error: 'Connection timeout',
            message: 'The GitLab server is taking too long to respond',
            suggestion: 'Try again later or check your GitLab instance'
          });
        } else {
          return res.status(500).json({
            error: 'Failed to fetch groups',
            message: error.message
          });
        }
      }
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error('Unexpected error in fetch-namespaces handler:', error.message);
    
    if (!hasResponded) {
      cleanupTimeout();
      res.status(500).json({
        error: 'Server error',
        message: error.message
      });
    }
  }
};