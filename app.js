// File: app.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const moment = require('moment');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Import GitLab utility functions
const { 
  calculateDateRange, 
  fetchProjects, 
  fetchPipelinesForProjects, 
  processCIMetrics,
  makeGitLabRequest
} = require('./utils/gitlab');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
let sessionConfig = {
  secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 } // 1 hour
};

// For Vercel's serverless environment, always use in-memory session storage
if (process.env.VERCEL) {
  console.log('Running in Vercel environment, using memory session store');
  app.use(session(sessionConfig));
} else if (process.env.REDIS_URL) {
  // Only try to use Redis in non-Vercel environments with REDIS_URL
  try {
    const redisClient = createClient({
      url: process.env.REDIS_URL
    });
    
    // Connect to Redis
    redisClient.connect().catch(err => {
      console.warn('Redis connection failed:', err.message);
      console.warn('Falling back to memory session store');
      app.use(session(sessionConfig));
    });
    
    // Wait for connection before setting up the session store
    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
      sessionConfig.store = new RedisStore({ client: redisClient });
      app.use(session(sessionConfig));
    });
    
    // Handle Redis errors
    redisClient.on('error', err => {
      console.warn('Redis error:', err.message);
    });
  } catch (error) {
    console.warn('Failed to initialize Redis:', error.message);
    console.warn('Using memory session store');
    app.use(session(sessionConfig));
  }
} else {
  console.log('No REDIS_URL provided, using memory session store');
  app.use(session(sessionConfig));
}

// Store active SAML sessions
const samlSessions = new Map();

// Route to initiate SAML auth
app.get('/api/saml-auth-init', (req, res) => {
  const { gitlabUrl } = req.query;
  
  if (!gitlabUrl) {
    return res.status(400).send('GitLab URL is required');
  }
  
  // Create a session ID to track this authentication attempt
  const sessionId = uuidv4();
  req.session.samlAuthSessionId = sessionId;
  
  // Store session data
  samlSessions.set(sessionId, {
    id: sessionId,
    authenticated: false,
    gitlabUrl,
    username: null,
    token: null,
    created: new Date()
  });
  
  // Redirect to GitLab's SAML login page
  res.redirect(`${gitlabUrl}/users/auth/saml`);
});

// Route to check SAML auth status
app.get('/api/saml-auth-status', (req, res) => {
  const sessionId = req.session.samlAuthSessionId;
  
  if (!sessionId || !samlSessions.has(sessionId)) {
    return res.json({ authenticated: false });
  }
  
  const session = samlSessions.get(sessionId);
  
  // In a real implementation, you would check if the user completed the SAML flow
  // For this example, we'll simulate success after a delay
  if (session.created && (new Date() - session.created > 10000)) {
    session.authenticated = true;
    session.username = 'saml_user@example.com';
    session.token = 'saml_authenticated_token';
  }
  
  return res.json({
    authenticated: session.authenticated,
    username: session.username,
    session: session.authenticated ? { id: session.id } : null
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Import API handlers to maintain compatibility with npm start
const fetchCIMetricsHandler = require('./api/gitlab/fetch-ci-metrics');
const fetchNamespacesHandler = require('./api/fetch-namespaces');
const samlAuthInitHandler = require('./api/auth/saml-auth-init');
const samlAuthStatusHandler = require('./api/auth/saml-auth-status');

// Register API routes for Express app
app.post('/api/fetch-ci-metrics', fetchCIMetricsHandler);
app.post('/api/fetch-namespaces', fetchNamespacesHandler);
app.get('/api/saml-auth-init', samlAuthInitHandler);
app.get('/api/saml-auth-status', samlAuthStatusHandler);

// Replace your current /api/get-gitlab-token endpoint
app.post('/api/get-gitlab-token', async (req, res) => {
  try {
    const { gitlabUrl } = req.body;
    
    if (!gitlabUrl) {
      return res.status(400).json({ error: 'GitLab URL is required' });
    }
    
    // Create a session for OAuth
    const sessionId = uuidv4();
    
    // Now we'll prompt the user to go through the OAuth flow
    const oauthConfig = {
      clientId: process.env.GITLAB_OAUTH_CLIENT_ID || 'your-client-id',
      redirectUri: `${req.protocol}://${req.get('host')}/api/oauth-callback`,
      scope: 'api read_api read_repository'
    };
    
    // Create a placeholder session that will be updated after OAuth completes
    samlSessions.set(sessionId, {
      id: sessionId,
      authenticated: false,
      gitlabUrl,
      oauthPending: true,
      created: new Date()
    });
    
    // Store the session ID in the user's session
    req.session.samlAuthSessionId = sessionId;
    
    // Generate the OAuth URL
    const oauthUrl = `${gitlabUrl}/oauth/authorize?client_id=${oauthConfig.clientId}&redirect_uri=${encodeURIComponent(oauthConfig.redirectUri)}&response_type=code&scope=${oauthConfig.scope}&state=${sessionId}`;
    
    // Instead of redirecting, we'll send back the OAuth URL for the frontend to use
    res.json({
      success: true,
      oauthUrl,
      session: {
        id: sessionId,
        requiresOAuth: true
      }
    });
    
  } catch (error) {
    console.error('Error preparing OAuth flow:', error);
    res.status(500).json({
      error: 'Failed to initialize OAuth flow',
      details: error.message
    });
  }
});

// Add a new endpoint to handle OAuth callbacks
app.get('/api/oauth-callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state || !samlSessions.has(state)) {
    return res.status(400).send('Invalid OAuth callback');
  }
  
  const session = samlSessions.get(state);
  const gitlabUrl = session.gitlabUrl;
  
  try {
    // Exchange the code for an access token
    const tokenResponse = await axios.post(`${gitlabUrl}/oauth/token`, {
      client_id: process.env.GITLAB_OAUTH_CLIENT_ID || 'your-client-id',
      client_secret: process.env.GITLAB_OAUTH_CLIENT_SECRET || 'your-client-secret',
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${req.protocol}://${req.get('host')}/api/oauth-callback`
    });
    
    // Update the session with the token
    session.authenticated = true;
    session.token = tokenResponse.data.access_token;
    session.refreshToken = tokenResponse.data.refresh_token;
    session.tokenExpiry = new Date(Date.now() + (tokenResponse.data.expires_in * 1000));
    session.oauthPending = false;
    
    // Get the user information
    const userResponse = await axios.get(`${gitlabUrl}/api/v4/user`, {
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });
    
    session.username = userResponse.data.username;
    
    // Send back a page that communicates with the opener window
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Complete</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
          .success { color: green; }
        </style>
      </head>
      <body>
        <h1 class="success">Authentication Complete!</h1>
        <p>You can now close this window and return to the GitLab CI Analytics app.</p>
        <script>
          // Send message to parent window that auth is complete
          window.opener.postMessage({
            type: 'oauth_complete',
            success: true,
            username: "${session.username}"
          }, "*");
          
          // Close this window after a short delay
          setTimeout(() => window.close(), 2000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error during OAuth token exchange:', error);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1 class="error">Authentication Failed</h1>
        <p>There was an error authenticating with GitLab. Please try again.</p>
        <p>Error: ${error.message}</p>
        <script>
          window.opener.postMessage({
            type: 'oauth_complete',
            success: false,
            error: "${error.message.replace(/"/g, '\\"')}"
          }, "*");
        </script>
      </body>
      </html>
    `);
  }
});

// Export route handlers for serverless functions
module.exports = {
  fetchCIMetrics: async (req, res) => {
    try {
      let { gitlabUrl, authMethod, personalAccessToken, timeRange, namespace } = req.body;
      
      // Focus only on PAT auth for now
      if (authMethod !== 'pat') {
        return res.status(400).json({ 
          error: 'Only Personal Access Token authentication is supported' 
        });
      }

      let token = personalAccessToken;
      
      // Clean up the GitLab URL to ensure it doesn't have paths
      if (gitlabUrl) {
        const urlObj = new URL(gitlabUrl);
        gitlabUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
      
      if (!gitlabUrl || !token) {
        return res.status(400).json({ error: 'GitLab URL and Personal Access Token are required' });
      }

      // Calculate date range based on the selected time range
      const dateRange = calculateDateRange(timeRange);
      
      // Fetch projects data
      const projects = await fetchProjects(gitlabUrl, token, namespace);
      const projectsArray = Array.isArray(projects) ? projects : [];
      
      if (projectsArray.length === 0) {
        return res.status(404).json({ error: 'No projects found. Check your GitLab URL and Personal Access Token.' });
      }
      
      // Fetch pipelines data for each project
      const pipelinesData = await fetchPipelinesForProjects(
        gitlabUrl, 
        token, 
        projectsArray, 
        dateRange.startDate, 
        dateRange.endDate
      );
      
      // Process and aggregate the CI metrics
      const metrics = processCIMetrics(pipelinesData, timeRange);
      
      res.json(metrics);
    } catch (error) {
      console.error('Error in fetchCIMetrics handler:', error);
      res.status(500).json({ 
        error: 'Failed to fetch CI metrics', 
        details: error.response?.data || error.message 
      });
    }
  },
  
  fetchNamespaces: async (req, res) => {
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
  }
};

// Keep the local server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}