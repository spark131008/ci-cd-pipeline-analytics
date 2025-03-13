// src/utils/api.js
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3000/api';

// Constants for API Request
const REQUEST_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 2;

/**
 * Makes a fetch request to the API with appropriate headers and error handling
 * 
 * @param {string} endpoint - API endpoint path (without /api prefix)
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<any>} - API response data
 */
/**
 * Enhanced API request function with retry logic, improved error handling, and timeout management
 */
export const apiRequest = async (endpoint, options = {}, retryCount = 0) => {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
  };
  
  const fetchOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {}),
    },
  };
  
  try {
    // Add request debugging
    console.log(`Making API request to: ${url}`);
    
    // Safely log request payload without tokens
    if (fetchOptions.body) {
      try {
        const bodyObj = JSON.parse(fetchOptions.body);
        const sanitized = {...bodyObj};
        
        // Hide sensitive values
        if (sanitized.personalAccessToken) {
          sanitized.personalAccessToken = '[MASKED]';
        }
        console.log('Request payload:', sanitized);
      } catch (e) {
        // Not JSON or can't be parsed, just skip
      }
    }
    
    // Set a timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.indexOf('application/json') !== -1) {
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.status}`);
      }
      
      return data;
    } else {
      // Handle non-JSON response
      const text = await response.text();
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${text}`);
      }
      
      return { text };
    }
  } catch (error) {
    // Handle abort errors more gracefully
    if (error.name === 'AbortError') {
      console.warn(`Request timeout for ${url}`);
      
      // Attempt retry for timeout errors
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying request to ${url} (Attempt ${retryCount + 1} of ${MAX_RETRIES})`);
        return apiRequest(endpoint, options, retryCount + 1);
      }
      
      throw new Error(`Request timeout after ${retryCount + 1} attempts - the server took too long to respond`);
    }
    
    // Network errors might also benefit from retries
    if (error.message.includes('network') && retryCount < MAX_RETRIES) {
      console.log(`Network error, retrying request to ${url} (Attempt ${retryCount + 1} of ${MAX_RETRIES})`);
      // Add a small delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return apiRequest(endpoint, options, retryCount + 1);
    }
    
    console.error(`API Request Failed (${url}):`, error);
    throw error;
  }
};

// GitLab API specific methods
export const gitlabApi = {
  fetchNamespaces: (data) => 
    apiRequest('/gitlab/fetch-namespaces', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  fetchCIMetrics: (data) => 
    apiRequest('/gitlab/fetch-ci-metrics', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Auth API methods
export const authApi = {
  getSamlAuthStatus: () => 
    apiRequest('/saml-auth-status'),
};

export default {
  apiRequest,
  gitlabApi,
  authApi,
};
