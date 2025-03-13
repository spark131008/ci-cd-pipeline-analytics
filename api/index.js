// api/index.js - Updated for Vercel serverless functions
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

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

// Export the serverless handler
module.exports = serverless(app);
