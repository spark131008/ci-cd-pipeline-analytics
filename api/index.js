// api/index.js - Updated for Vercel serverless functions
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for testing
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import API handlers
const fetchCIMetricsHandler = require('./gitlab/fetch-ci-metrics');
const fetchNamespacesHandler = require('./gitlab/fetch-namespaces');
const samlAuthInitHandler = require('./auth/saml-auth-init');
const samlAuthStatusHandler = require('./auth/saml-auth-status');
const testGitLabApiHandler = require('./gitlab/test-api');

// Register API routes
app.post('/api/gitlab/fetch-ci-metrics', fetchCIMetricsHandler);
app.post('/api/gitlab/fetch-namespaces', fetchNamespacesHandler);
app.get('/api/saml-auth-init', samlAuthInitHandler);
app.get('/api/saml-auth-status', samlAuthStatusHandler);
app.get('/api/gitlab/test-api', testGitLabApiHandler);

// Debug route to confirm API is working
app.get('/api', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'GitLab CI Analytics API is running',
    environment: process.env.VERCEL ? 'Vercel' : 'Development',
    timestamp: new Date().toISOString(),
    function_timeout: process.env.VERCEL ? '15 seconds' : 'No limit'
  });
});

// Debug endpoint to check the build files
app.get('/api/build-info', (req, res) => {
  const buildInfo = {
    api_status: 'running',
    node_version: process.version,
    environment: process.env.NODE_ENV || 'unknown',
    vercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString(),
    dist_exists: false,
    files: []
  };
  
  // Check if we can access the dist directory
  const distPath = path.join(__dirname, '../dist');
  
  try {
    if (fs.existsSync(distPath)) {
      buildInfo.dist_exists = true;
      
      // List files in the dist directory
      const files = fs.readdirSync(distPath);
      buildInfo.files = files.map(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          is_directory: stats.isDirectory(),
          modified: stats.mtime
        };
      });
    }
  } catch (error) {
    buildInfo.error = {
      message: error.message,
      stack: error.stack
    };
  }
  
  res.status(200).json(buildInfo);
});

// Health check endpoint with detailed diagnostics
app.get('/api/health', (req, res) => {
  // Get memory usage
  const memoryUsage = process.memoryUsage();
  
  // Create health status object
  const healthStatus = {
    status: 'healthy',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      node_version: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development',
      vercel: process.env.VERCEL === '1' ? true : false,
      function_timeout: process.env.VERCEL ? '15 seconds' : 'No limit',
    },
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      heap_total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      heap_used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
    },
    request: {
      headers: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      protocol: req.protocol,
      method: req.method,
      host: req.get('host'),
    }
  };
  
  // Run a quick self-test
  try {
    // If the request made it this far, the API is working properly
    healthStatus.tests = {
      api_reachable: true,
    };
    
    res.status(200).json(healthStatus);
  } catch (error) {
    healthStatus.status = 'unhealthy';
    healthStatus.error = error.message;
    res.status(500).json(healthStatus);
  }
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.status(200).json({
    name: 'GitLab CI Analytics API',
    version: '1.0.0',
    description: 'API for GitLab CI/CD analytics dashboard',
    endpoints: [
      { path: '/api', method: 'GET', description: 'API root - confirms API is running' },
      { path: '/api/health', method: 'GET', description: 'Health check with detailed diagnostic information' },
      { path: '/api/build-info', method: 'GET', description: 'Information about the current build' },
      { path: '/api/docs', method: 'GET', description: 'API documentation' },
      { path: '/api/gitlab/test-api', method: 'GET', description: 'Test GitLab API connection', params: ['url', 'token'] },
      { path: '/api/gitlab/fetch-namespaces', method: 'POST', description: 'Fetch GitLab namespaces (groups)' },
      { path: '/api/gitlab/fetch-ci-metrics', method: 'POST', description: 'Fetch CI pipeline metrics' },
      { path: '/api/saml-auth-init', method: 'GET', description: 'Initialize SAML authentication' },
      { path: '/api/saml-auth-status', method: 'GET', description: 'Check SAML authentication status' },
    ]
  });
});

// Fallback route for serving static files
app.use('/api/static', express.static(path.join(__dirname, '../dist')));

// Export the serverless handler
module.exports = serverless(app);
