const axios = require('axios');

module.exports = async (req, res) => {
  console.log('---- FETCH NAMESPACES API CALLED ----');
  console.log('Request method:', req.method);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
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
    let tokenType = 'personal';
    
    if (!gitlabUrl || !token) {
      console.log('Missing required parameters:', {
        gitlabUrl: !!gitlabUrl,
        token: !!token
      });
      return res.status(400).json({ error: 'GitLab URL and Personal Access Token are required' });
    }
    
    try {
      const cleanGitlabUrl = new URL(gitlabUrl).origin;
      console.log('Cleaned GitLab URL:', cleanGitlabUrl);
      
      // Fetch user's groups
      const headers = { 'PRIVATE-TOKEN': token };
      const requestUrl = `${cleanGitlabUrl}/api/v4/groups`;
      const requestParams = {
        min_access_level: 20, // Reporter level or higher
        per_page: 100
      };
      
      console.log('Sending request to:', requestUrl);
      console.log('With params:', JSON.stringify(requestParams));
      console.log('With headers:', JSON.stringify({ 'PRIVATE-TOKEN': 'MASKED' }));
      
      const groupsResponse = await axios.get(requestUrl, {
        headers,
        params: requestParams
      });
      
      console.log('Response status:', groupsResponse.status);
      console.log('Response headers:', JSON.stringify(groupsResponse.headers, null, 2));
      console.log('Response data type:', typeof groupsResponse.data);
      console.log('Response is array:', Array.isArray(groupsResponse.data));
      
      if (Array.isArray(groupsResponse.data)) {
        console.log('Number of groups found:', groupsResponse.data.length);
        console.log('First group (if any):', 
          groupsResponse.data.length > 0 ? 
          JSON.stringify(groupsResponse.data[0], null, 2) : 'None');
      } else {
        console.log('Response data preview:', JSON.stringify(groupsResponse.data).substring(0, 200) + '...');
      }
      
      // Skip user namespace and just return groups
      const groups = Array.isArray(groupsResponse.data) ? groupsResponse.data : [];
      
      // Convert to our format
      const namespaces = groups.map(group => ({ 
        id: group.id, 
        name: group.name, 
        path: group.path,
        kind: 'group',
        full_path: group.full_path
      }));
      
      console.log('Formatted namespaces:', JSON.stringify(namespaces, null, 2));
      console.log('Sending successful response');
      
      res.json(namespaces);
    } catch (error) {
      console.error('Error fetching groups from GitLab API:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error status:', error.response.status);
        console.error('Error headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received. Request details:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error details:', error);
      }
      console.error('Error config:', JSON.stringify(error.config, null, 2));
      
      res.status(500).json({ 
        error: 'Failed to fetch groups', 
        details: error.response?.data || error.message,
        code: error.code,
        isAxiosError: error.isAxiosError || false
      });
    }
  } catch (error) {
    console.error('General error in fetch-namespaces handler:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Failed to fetch namespaces',
      details: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};