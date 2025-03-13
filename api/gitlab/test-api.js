const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const { url, token } = req.query;
    
    if (!url || !token) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Both url and token query parameters are required'
      });
    }
    
    // Basic validation
    if (!url.startsWith('http')) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'URL must start with http:// or https://'
      });
    }
    
    const cleanUrl = url.trim().replace(/\/$/, '');
    const apiUrl = `${cleanUrl}/api/v4/version`;
    
    console.log(`Testing GitLab API connection to: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, {
      headers: { 'PRIVATE-TOKEN': token },
      timeout: 5000
    });
    
    return res.status(200).json({
      success: true,
      gitlab_version: response.data,
      message: 'Successfully connected to GitLab API'
    });
  } catch (error) {
    console.error('GitLab API test error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'GitLab API error',
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      return res.status(504).json({
        error: 'Connection error',
        message: error.code === 'ECONNABORTED' 
          ? 'Connection timeout' 
          : 'No response from server',
        code: error.code
      });
    } else {
      return res.status(500).json({
        error: 'Request setup error',
        message: error.message
      });
    }
  }
};