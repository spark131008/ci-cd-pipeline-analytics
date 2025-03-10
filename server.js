// server.js - A clean entry point for local development
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

// Import utility functions
const { calculateDateRange, fetchProjects, fetchPipelinesForProjects, processCIMetrics } = require('./utils/gitlab');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 } // 1 hour
}));

// Store active SAML sessions
const samlSessions = new Map();
global.samlSessions = samlSessions;

// Basic route to serve the main HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Import API handlers directly
const fetchCIMetricsHandler = require('./api/gitlab/fetch-ci-metrics');
const debugCIMetricsHandler = require('./api/gitlab/debug-ci-metrics');
const fetchNamespacesHandler = require('./api/fetch-namespaces');
const samlAuthInitHandler = require('./api/auth/saml-auth-init');
const samlAuthStatusHandler = require('./api/auth/saml-auth-status');

// Debug log to see the imported handlers
console.log('Handlers loaded:',{
  'fetchCIMetricsHandler': typeof fetchCIMetricsHandler,
  'fetchNamespacesHandler': typeof fetchNamespacesHandler
});

// Register the working CI metrics endpoint
app.post('/api/fetch-ci-metrics', async (req, res) => {
  console.log('CI Metrics endpoint called');
  try {
    // Get parameters from request
    const { gitlabUrl, authMethod, personalAccessToken, timeRange, namespace } = req.body;
    
    // Input validation
    if (!gitlabUrl || typeof gitlabUrl !== 'string') {
      return res.status(400).json({ error: 'Valid GitLab URL is required' });
    }
    
    if (authMethod !== 'pat') {
      return res.status(400).json({ error: 'Only Personal Access Token authentication is supported' });
    }

    if (!personalAccessToken || typeof personalAccessToken !== 'string') {
      return res.status(400).json({ error: 'Valid Personal Access Token is required' });
    }

    let effectiveTimeRange = timeRange;
    if (!effectiveTimeRange || typeof effectiveTimeRange !== 'string') {
      console.log("Invalid timeRange, defaulting to 'month'");
      effectiveTimeRange = 'month';
    }

    if (!namespace || typeof namespace !== 'string') {
      return res.status(400).json({ error: 'Valid namespace is required' });
    }
    
    // Clean up the GitLab URL
    let processedGitlabUrl = gitlabUrl;
    if (gitlabUrl) {
      const urlObj = new URL(gitlabUrl);
      processedGitlabUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
    
    // Calculate date range
    const dateRange = calculateDateRange(effectiveTimeRange);
    console.log("Date range:", dateRange);
    
    // Fetch projects
    console.log("Fetching projects...");
    const projects = await fetchProjects(processedGitlabUrl, personalAccessToken, namespace);
    console.log(`Projects fetched: ${Array.isArray(projects) ? projects.length : 0}`);
    
    // Ensure projects is an array and has content
    const projectsArray = Array.isArray(projects) ? projects : [];
    if (projectsArray.length === 0) {
      return res.status(404).json({ error: 'No projects found' });
    }
    
    // Fetch pipelines data
    console.log("Fetching pipelines data...");
    const pipelinesData = await fetchPipelinesForProjects(
      processedGitlabUrl, 
      personalAccessToken, 
      projectsArray, 
      dateRange.startDate, 
      dateRange.endDate
    );
    console.log(`Pipeline data sets fetched: ${pipelinesData.length}`);
    
    // Process the metrics
    console.log("Processing CI metrics...");
    const metrics = processCIMetrics(pipelinesData, effectiveTimeRange);
    console.log("CI metrics processed successfully");
    
    // Return the metrics data
    return res.json(metrics);
  } catch (error) {
    console.error('Error in CI metrics handler:', error);
    return res.status(500).json({
      error: 'Failed to fetch CI metrics',
      details: error.message
    });
  }
});

// Add an additional route that matches the URL in the frontend
app.post('/api/gitlab/fetch-ci-metrics', async (req, res) => {
  console.log('CI Metrics endpoint called via /api/gitlab/fetch-ci-metrics');
  
  // Reuse the same handler code
  try {
    // Get parameters from request
    const { gitlabUrl, authMethod, personalAccessToken, timeRange, namespace } = req.body;
    
    // Input validation
    if (!gitlabUrl || typeof gitlabUrl !== 'string') {
      return res.status(400).json({ error: 'Valid GitLab URL is required' });
    }
    
    if (authMethod !== 'pat') {
      return res.status(400).json({ error: 'Only Personal Access Token authentication is supported' });
    }

    if (!personalAccessToken || typeof personalAccessToken !== 'string') {
      return res.status(400).json({ error: 'Valid Personal Access Token is required' });
    }

    let effectiveTimeRange = timeRange;
    if (!effectiveTimeRange || typeof effectiveTimeRange !== 'string') {
      console.log("Invalid timeRange, defaulting to 'month'");
      effectiveTimeRange = 'month';
    }

    if (!namespace || typeof namespace !== 'string') {
      return res.status(400).json({ error: 'Valid namespace is required' });
    }
    
    // Clean up the GitLab URL
    let processedGitlabUrl = gitlabUrl;
    if (gitlabUrl) {
      const urlObj = new URL(gitlabUrl);
      processedGitlabUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
    
    // Calculate date range
    const dateRange = calculateDateRange(effectiveTimeRange);
    console.log("Date range:", dateRange);
    
    // Fetch projects
    console.log("Fetching projects...");
    const projects = await fetchProjects(processedGitlabUrl, personalAccessToken, namespace);
    console.log(`Projects fetched: ${Array.isArray(projects) ? projects.length : 0}`);
    
    // Ensure projects is an array and has content
    const projectsArray = Array.isArray(projects) ? projects : [];
    if (projectsArray.length === 0) {
      return res.status(404).json({ error: 'No projects found' });
    }
    
    // Fetch pipelines data
    console.log("Fetching pipelines data...");
    const pipelinesData = await fetchPipelinesForProjects(
      processedGitlabUrl, 
      personalAccessToken, 
      projectsArray, 
      dateRange.startDate, 
      dateRange.endDate
    );
    console.log(`Pipeline data sets fetched: ${pipelinesData.length}`);
    
    // Process the metrics
    console.log("Processing CI metrics...");
    const metrics = processCIMetrics(pipelinesData, effectiveTimeRange);
    console.log("CI metrics processed successfully");
    
    // Return the metrics data
    return res.json(metrics);
  } catch (error) {
    console.error('Error in CI metrics handler:', error);
    return res.status(500).json({
      error: 'Failed to fetch CI metrics',
      details: error.message
    });
  }
});

// Add a debug endpoint that uses the original handler
app.post('/api/debug/fetch-ci-metrics', async (req, res) => {
  console.log('Original CI Metrics endpoint called');
  try {
    return await fetchCIMetricsHandler(req, res);
  } catch (error) {
    console.error('Error in original CI metrics handler:', error);
    return res.status(500).json({
      error: 'Error in original handler',
      details: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});
app.post('/api/fetch-namespaces', fetchNamespacesHandler);
app.get('/api/saml-auth-init', samlAuthInitHandler);
app.get('/api/saml-auth-status', samlAuthStatusHandler);

// Add a simple test endpoint
app.get('/api/test', (req, res) => {
  res.status(200).json({ 
    message: 'API is working', 
    timestamp: new Date().toISOString(),
    environment: 'Server.js'
  });
});

// Add a debug route for the CI metrics handler
app.get('/api/debug/ci-metrics', (req, res) => {
  res.status(200).json({
    handlerType: typeof fetchCIMetricsHandler,
    isAsync: fetchCIMetricsHandler.constructor.name === 'AsyncFunction',
    handlerStringified: fetchCIMetricsHandler.toString().substring(0, 100) + '...',
  });
});

// Handle any other routes by serving the main HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
