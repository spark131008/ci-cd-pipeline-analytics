const axios = require('axios');

module.exports = async (req, res) => {
  console.log('---- FETCH NAMESPACES API CALLED ----');
  console.log('Request method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create a sanitized copy of the request body for logging
    const sanitizedBody = {...req.body};
    if (sanitizedBody.personalAccessToken) {
      sanitizedBody.personalAccessToken = '[MASKED]';
    }
    console.log('Request body:', JSON.stringify(sanitizedBody, null, 2));
    
    let { gitlabUrl, authMethod, personalAccessToken } = req.body;
    
    // Focus only on PAT auth for now
    if (authMethod !== 'pat') {
      console.log('Auth method not supported:', authMethod);
      return res.status(400).json({ 
        error: 'Only Personal Access Token authentication is supported' 
      });
    }
    
    let token = personalAccessToken;
    
    if (!gitlabUrl || !token) {
      console.log('Missing required parameters:', {
        gitlabUrl: !!gitlabUrl,
        token: !!token
      });
      return res.status(400).json({ error: 'GitLab URL and Personal Access Token are required' });
    }
    
    try {
      // Clean up the URL
      const cleanGitlabUrl = gitlabUrl.trim().replace(/\/$/, '');
      if (!cleanGitlabUrl.startsWith('http')) {
        return res.status(400).json({ error: 'GitLab URL must start with http:// or https://' });
      }
      
      console.log('Cleaned GitLab URL:', cleanGitlabUrl);
      
      // Fetch user's groups with timeout and optimize the request
      const headers = { 'PRIVATE-TOKEN': token };
      const requestUrl = `${cleanGitlabUrl}/api/v4/groups`;
      
      // Initial page of results
      const requestParams = {
        min_access_level: 20, // Reporter level or higher
        per_page: 20,         // Limit to fewer groups to prevent timeout
        page: 1,
        simple: true,         // Simple version of groups for faster response
        top_level_only: true  // Only fetch top-level groups first for better performance
      };
      
      console.log('Sending request to:', requestUrl);
      
      // Set a timeout config for axios
      const axiosConfig = {
        headers,
        params: requestParams,
        timeout: 8000 // 8 second timeout
      };
      
      let allGroups = [];
      let currentPage = 1;
      let hasMorePages = true;
      const MAX_PAGES = 3; // Limit pages to prevent timeouts
      
      // Fetch with pagination, limited to MAX_PAGES to prevent timeouts
      while (hasMorePages && currentPage <= MAX_PAGES) {
        console.log(`Fetching page ${currentPage} of groups...`);
        
        try {
          axiosConfig.params.page = currentPage;
          const response = await axios.get(requestUrl, axiosConfig);
          
          if (Array.isArray(response.data) && response.data.length > 0) {
            console.log(`Found ${response.data.length} groups on page ${currentPage}`);
            allGroups = [...allGroups, ...response.data];
            
            // Check if we have more pages
            const totalPages = response.headers['x-total-pages'];
            if (totalPages && currentPage < parseInt(totalPages)) {
              currentPage++;
            } else {
              hasMorePages = false;
            }
          } else {
            // No more results
            hasMorePages = false;
          }
        } catch (err) {
          // If we get an error on additional pages, we'll just use what we have
          console.error(`Error fetching page ${currentPage}:`, err.message);
          hasMorePages = false;
        }
      }
      
      console.log('Total groups found:', allGroups.length);
      
      // Convert to our format (with minimal data)
      const namespaces = allGroups.map(group => ({ 
        id: group.id, 
        name: group.name, 
        path: group.path,
        kind: 'group',
        full_path: group.full_path
      }));
      
      console.log('Formatted namespaces count:', namespaces.length);
      
      res.json(namespaces);
    } catch (error) {
      console.error('Error fetching groups from GitLab API:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error status:', error.response.status);
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        
        // Return specific GitLab API errors
        return res.status(error.response.status).json({ 
          error: 'GitLab API error', 
          details: error.response.data?.message || error.response.data,
          status: error.response.status
        });
      } else if (error.request) {
        // Handle timeouts and connection errors
        const errorMessage = error.code === 'ECONNABORTED' 
          ? 'Connection timeout when connecting to GitLab API'
          : 'Failed to connect to GitLab API';
          
        return res.status(504).json({ 
          error: errorMessage,
          code: error.code
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        return res.status(500).json({ 
          error: 'Error setting up GitLab API request', 
          details: error.message
        });
      }
    }
  } catch (error) {
    console.error('General error in fetch-namespaces handler:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    res.status(500).json({ 
      error: 'Server error processing request',
      details: error.message
    });
  }
};