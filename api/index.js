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
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import API handlers
const fetchCIMetricsHandler = require('./gitlab/fetch-ci-metrics');
const fetchNamespacesHandler = require('./gitlab/fetch-namespaces');
const samlAuthInitHandler = require('./auth/saml-auth-init');
const samlAuthStatusHandler = require('./auth/saml-auth-status');

// Register API routes
app.post('/api/gitlab/fetch-ci-metrics', fetchCIMetricsHandler);
app.post('/api/gitlab/fetch-namespaces', fetchNamespacesHandler);
app.get('/api/saml-auth-init', samlAuthInitHandler);
app.get('/api/saml-auth-status', samlAuthStatusHandler);

// Debug route to confirm API is working
app.get('/api', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'GitLab CI Analytics API is running',
    environment: process.env.VERCEL ? 'Vercel' : 'Development',
    timestamp: new Date().toISOString()
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

// Fallback route for serving static files
app.use('/api/static', express.static(path.join(__dirname, '../dist')));

// Export the serverless handler
module.exports = serverless(app);
