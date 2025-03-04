// File: app.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const moment = require('moment');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 } // 1 hour
}));

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

// API to fetch CI build data
app.post('/api/fetch-ci-metrics', async (req, res) => {
  try {
    let { gitlabUrl, authMethod, personalAccessToken, samlSessionId, timeRange, namespace } = req.body;

    // Determine what token to use based on auth method
    let token = personalAccessToken;

    if (authMethod === 'saml') {
      if (!samlSessionId || !samlSessions.has(samlSessionId)) {
        return res.status(401).json({ error: 'Invalid SAML session. Please authenticate again.' });
      }

      const session = samlSessions.get(samlSessionId);
      if (!session.authenticated) {
        return res.status(401).json({ error: 'SAML authentication incomplete. Please authenticate again.' });
      }

      token = session.token;
    }

    // Clean up the GitLab URL to ensure it doesn't have paths
    if (gitlabUrl) {
      // Extract just the base URL (domain and protocol)
      const urlObj = new URL(gitlabUrl);
      gitlabUrl = `${urlObj.protocol}//${urlObj.host}`;
    }

    console.log("Request body received:", { 
      gitlabUrl, 
      personalAccessToken: personalAccessToken ? `${personalAccessToken.substring(0, 4)}...` : undefined, 
      timeRange,
      namespace
    });
    
    if (!gitlabUrl || !token) {
      return res.status(400).json({ error: 'GitLab URL and Personal Access Token are required' });
    }

    // Calculate date range based on the selected time range
    const dateRange = calculateDateRange(timeRange);
    console.log("Date range:", dateRange);
    
    try {
      // Fetch projects data
      console.log("Fetching projects from:", `${gitlabUrl}/api/v4/projects`);
      const projects = await fetchProjects(gitlabUrl, token, namespace);
      
      // Debug what projects contains
      console.log("Projects type:", typeof projects);
      console.log("Is projects an array?", Array.isArray(projects));
      console.log("Projects data:", JSON.stringify(projects).substring(0, 200) + "...");
      
      // Ensure projects is an array before proceeding
      const projectsArray = Array.isArray(projects) ? projects : [];
      console.log("Projects array length:", projectsArray.length);
      
      if (projectsArray.length === 0) {
        return res.status(404).json({ error: 'No projects found. Check your GitLab URL and Personal Access Token.' });
      }
      
      try {
        // Fetch pipelines data for each project
        const pipelinesData = await fetchPipelinesForProjects(
          gitlabUrl, 
          token, 
          projectsArray, 
          dateRange.startDate, 
          dateRange.endDate
        );
        
        console.log("Pipelines data fetched successfully:", pipelinesData ? pipelinesData.length : 0);
        
        // Process and aggregate the CI metrics
        const metrics = processCIMetrics(pipelinesData, timeRange);
        
        res.json(metrics);
      } catch (pipelinesError) {
        console.error("Error in fetchPipelinesForProjects:", pipelinesError);
        res.status(500).json({ 
          error: 'Failed to fetch pipeline data', 
          details: pipelinesError.message 
        });
      }
    } catch (projectsError) {
      console.error("Error in fetchProjects:", projectsError);
      res.status(500).json({ 
        error: 'Failed to fetch projects data', 
        details: projectsError.message 
      });
    }
  } catch (error) {
    console.error('Error in main request handler:', error);
    res.status(500).json({ 
      error: 'Failed to fetch CI metrics', 
      details: error.response?.data || error.message 
    });
  }
});

// API endpoint to fetch namespaces
app.post('/api/fetch-namespaces', async (req, res) => {
  try {
    let { gitlabUrl, authMethod, personalAccessToken, samlSessionId } = req.body;
    
    // Determine what token to use based on auth method
    let token, tokenType;
    
    if (authMethod === 'pat') {
      token = personalAccessToken;
      tokenType = 'personal';
    } else if (authMethod === 'saml') {
      if (!samlSessionId || !samlSessions.has(samlSessionId)) {
        return res.status(401).json({ error: 'Invalid session. Please authenticate again.' });
      }

      const session = samlSessions.get(samlSessionId);
      if (!session.authenticated) {
        return res.status(401).json({ error: 'Authentication incomplete. Please authenticate again.' });
      }

      token = session.token;
      tokenType = session.tokenType || 'personal';  // Default to personal if not specified
    }
    
    if (!gitlabUrl || !token) {
      return res.status(400).json({ error: 'GitLab URL and authentication credentials are required' });
    }
    
    const cleanGitlabUrl = new URL(gitlabUrl).origin;
    
    try {
      // Fetch user's groups (namespaces they belong to)
      const headers = tokenType === 'oauth' 
        ? { 'Authorization': `Bearer ${token}` }
        : { 'PRIVATE-TOKEN': token };
      
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
      console.error('Error fetching groups:', error);
      res.status(500).json({ 
        error: 'Failed to fetch groups', 
        details: error.response?.data || error.message 
      });
    }
  } catch (error) {
    console.error('Error in group request handler:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

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

// Helper function to calculate date range based on selected time range
function calculateDateRange(timeRange) {
  const endDate = moment();
  let startDate;
  
  switch (timeRange) {
    case 'day':
      startDate = moment().subtract(1, 'days');
      break;
    case 'week':
      startDate = moment().subtract(1, 'weeks');
      break;
    case 'month':
      startDate = moment().subtract(1, 'months');
      break;
    case 'year':
      startDate = moment().subtract(1, 'years');
      break;
    default:
      startDate = moment().subtract(1, 'months');
  }
  
  return {
    startDate: startDate.format('YYYY-MM-DD'),
    endDate: endDate.format('YYYY-MM-DD')
  };
}

// Function to fetch projects from GitLab
async function fetchProjects(gitlabUrl, token, namespace = '', tokenType = 'personal') {
  try {
    let params = {
      membership: true,
      per_page: 100
    };
    
    // If namespace is provided, add it to the query
    if (namespace) {
      params.namespace = namespace;
    }
    
    console.log(`Making request to: ${gitlabUrl}/api/v4/projects with params:`, params);
    
    const headers = tokenType === 'oauth' 
      ? { 'Authorization': `Bearer ${token}` }
      : { 'PRIVATE-TOKEN': token };
    
    const response = await axios.get(`${gitlabUrl}/api/v4/projects`, {
      headers,
      params
    });
    
    // Make sure we're returning an array
    if (!Array.isArray(response.data)) {
      console.log('Projects response is not an array:', response.data);
      return Array.isArray(response.data.projects) ? response.data.projects : [];
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
}

// Function to fetch pipelines for multiple projects
async function fetchPipelinesForProjects(gitlabUrl, token, projects, startDate, endDate) {
  // Ensure projects is an array and has content
  if (!Array.isArray(projects)) {
    console.error('Projects is not an array:', typeof projects, projects);
    return [];
  }
  
  // Make a safe copy of the projects array and ensure each item has an id
  const validProjects = projects.filter(project => project && project.id);
  
  console.log(`Processing ${validProjects.length} valid projects out of ${projects.length} total`);
  
  if (validProjects.length === 0) {
    console.error('No valid projects with IDs found');
    return [];
  }
  
  const pipelinesPromises = validProjects.map(project => 
    fetchPipelinesForProject(gitlabUrl, token, project.id, startDate, endDate)
  );
  
  return Promise.all(pipelinesPromises);
}

// Function to fetch pipelines for a single project
async function fetchPipelinesForProject(gitlabUrl, token, projectId, startDate, endDate) {
  try {
    console.log(`Fetching pipelines for project ${projectId}`);
    
    // First, get the project details to get the name
    const projectResponse = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}`, {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });
    
    const projectName = projectResponse.data.name || `Project ${projectId}`;
    
    const response = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}/pipelines`, {
      headers: {
        'PRIVATE-TOKEN': token
      },
      params: {
        updated_after: startDate,
        updated_before: endDate,
        per_page: 100
      }
    });
    
    // Get details for each pipeline to calculate duration
    const pipelineDetails = await Promise.all(
      response.data.map(pipeline => 
        fetchPipelineDetails(gitlabUrl, token, projectId, pipeline.id)
      )
    );
    
    // Filter out null values (failed requests)
    const validPipelines = pipelineDetails.filter(p => p !== null);
    
    return {
      projectId,
      projectName,
      pipelines: validPipelines
    };
  } catch (error) {
    console.error(`Error fetching pipelines for project ${projectId}:`, error);
    return {
      projectId,
      projectName: `Project ${projectId}`,
      pipelines: []
    };
  }
}

// Function to fetch details for a single pipeline
async function fetchPipelineDetails(gitlabUrl, token, projectId, pipelineId) {
  try {
    const response = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}/pipelines/${pipelineId}`, {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });
    
    // Fetch the jobs for this pipeline to calculate total CI minutes
    const jobsResponse = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`, {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });
    
    // Calculate the total duration of all jobs
    const totalDurationMinutes = jobsResponse.data.reduce((total, job) => {
      // Duration is in seconds, convert to minutes
      return total + (job.duration ? job.duration / 60 : 0);
    }, 0);
    
    return {
      ...response.data,
      totalDurationMinutes
    };
  } catch (error) {
    console.error(`Error fetching details for pipeline ${pipelineId}:`, error);
    return null;
  }
}

// Function to process and aggregate CI metrics
function processCIMetrics(pipelinesData, timeRange) {
  // Initialize metrics object
  const metrics = {
    totalBuilds: 0,
    totalMinutes: 0,
    buildsPerProject: [],
    minutesPerProject: [],
    buildsByStatus: {
      success: 0,
      failed: 0,
      canceled: 0,
      running: 0,
      pending: 0,
      other: 0
    },
    timeSeriesData: []
  };
  
  // Process data for each project
  pipelinesData.forEach(projectData => {
    if (!projectData.pipelines || projectData.pipelines.length === 0) {
      return;
    }
    
    // Store the project name from the first pipeline if available
    const projectName = projectData.projectName || `Project ${projectData.projectId}`;
    
    const projectMetrics = {
      projectId: projectData.projectId,
      projectName: projectName,
      buildCount: 0,
      totalMinutes: 0
    };
    
    // Process each pipeline
    projectData.pipelines.forEach(pipeline => {
      if (!pipeline) return;
      
      metrics.totalBuilds++;
      projectMetrics.buildCount++;
      
      // Add duration to total minutes
      const durationMinutes = pipeline.totalDurationMinutes || 0;
      metrics.totalMinutes += durationMinutes;
      projectMetrics.totalMinutes += durationMinutes;
      
      // Count builds by status
      const status = pipeline.status || 'other';
      if (metrics.buildsByStatus[status] !== undefined) {
        metrics.buildsByStatus[status]++;
      } else {
        metrics.buildsByStatus.other++;
      }
      
      // Add to time series data
      const pipelineDate = moment(pipeline.created_at).format('YYYY-MM-DD');
      const existingDateEntry = metrics.timeSeriesData.find(entry => entry.date === pipelineDate);
      
      if (existingDateEntry) {
        existingDateEntry.buildCount++;
        existingDateEntry.minutes += durationMinutes;
      } else {
        metrics.timeSeriesData.push({
          date: pipelineDate,
          buildCount: 1,
          minutes: durationMinutes
        });
      }
    });
    
    // Add project metrics to the overall metrics
    metrics.buildsPerProject.push({
      projectId: projectData.projectId,
      projectName: projectMetrics.projectName,
      buildCount: projectMetrics.buildCount
    });
    
    metrics.minutesPerProject.push({
      projectId: projectData.projectId,
      projectName: projectMetrics.projectName,
      totalMinutes: projectMetrics.totalMinutes
    });
  });
  
  // Sort time series data by date
  metrics.timeSeriesData.sort((a, b) => moment(a.date).diff(moment(b.date)));
  
  // Group time series data based on the selected time range
  metrics.timeSeriesData = groupTimeSeriesData(metrics.timeSeriesData, timeRange);
  
  return metrics;
}

// Function to group time series data based on time range
function groupTimeSeriesData(timeSeriesData, timeRange) {
  if (timeRange === 'day') {
    // For day view, group by hour
    return timeSeriesData;
  }
  
  const groupedData = [];
  const format = timeRange === 'week' ? 'YYYY-MM-DD' : 
                 timeRange === 'month' ? 'YYYY-MM-DD' : 
                 'YYYY-MM';
  
  timeSeriesData.forEach(entry => {
    const period = moment(entry.date).format(format);
    const existingEntry = groupedData.find(item => item.period === period);
    
    if (existingEntry) {
      existingEntry.buildCount += entry.buildCount;
      existingEntry.minutes += entry.minutes;
    } else {
      groupedData.push({
        period,
        buildCount: entry.buildCount,
        minutes: entry.minutes
      });
    }
  });
  
  return groupedData;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

// Update the function to make GitLab API requests with proper Authorization headers
async function makeGitLabRequest(url, session, params = {}) {
  const headers = {};
  
  // Determine what type of authentication to use
  if (session.token) {
    if (session.tokenType === 'oauth') {
      headers['Authorization'] = `Bearer ${session.token}`;
    } else {
      headers['PRIVATE-TOKEN'] = session.token;
    }
  }
  
  return axios.get(url, { headers, params });
}