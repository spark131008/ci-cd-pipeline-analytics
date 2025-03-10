// Debug version of fetch-ci-metrics.js
const axios = require('axios');

module.exports = async (req, res) => {
  console.log('DEBUG CI metrics endpoint called');
  console.log('Request method:', req.method);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    let { gitlabUrl, authMethod, personalAccessToken, timeRange, namespace } = req.body;
    
    console.log('GitLab URL:', gitlabUrl);
    console.log('Auth method:', authMethod);
    console.log('PAT provided:', personalAccessToken ? 'Yes (masked)' : 'No');
    console.log('Time Range:', timeRange);
    console.log('Namespace:', namespace);
    
    // Just return a mocked response for debugging
    return res.json({ 
      debug: true,
      message: 'Debug version of CI metrics endpoint',
      receivedParams: {
        gitlabUrl,
        authMethod,
        patProvided: !!personalAccessToken,
        timeRange,
        namespace
      }
    });
  } catch (error) {
    console.error('Error in debug CI metrics handler:', error);
    return res.status(500).json({ 
      error: 'Failed to process request', 
      details: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};
