const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { gitlabUrl, authMethod, personalAccessToken } = req.body;
    
    // Focus only on PAT auth for now
    if (authMethod !== 'pat') {
      return res.status(400).json({ 
        error: 'Only Personal Access Token authentication is supported' 
      });
    }
    
    let token = personalAccessToken;
    let tokenType = 'personal';
    
    if (!gitlabUrl || !token) {
      return res.status(400).json({ error: 'GitLab URL and Personal Access Token are required' });
    }
    
    const cleanGitlabUrl = new URL(gitlabUrl).origin;
    
    // Fetch user's groups
    const headers = { 'PRIVATE-TOKEN': token };
    
    const groupsResponse = await axios.get(`${cleanGitlabUrl}/api/v4/groups`, {
      headers,
      params: {
        min_access_level: 20, // Reporter level or higher
        per_page: 100
      }
    });
    
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
    
    res.json(namespaces);
  } catch (error) {
    console.error('Error in fetchNamespaces handler:', error);
    res.status(500).json({ 
      error: 'Failed to fetch namespaces', 
      details: error.response?.data || error.message 
    });
  }
};