// src/utils/api.js
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3000/api';

/**
 * Makes a fetch request to the API with appropriate headers and error handling
 * 
 * @param {string} endpoint - API endpoint path (without /api prefix)
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<any>} - API response data
 */
export const apiRequest = async (endpoint, options = {}) => {
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
    if (fetchOptions.body) {
      console.log('Request payload:', JSON.parse(fetchOptions.body));
    }
    
    const response = await fetch(url, fetchOptions);
    
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
