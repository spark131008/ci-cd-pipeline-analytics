// api/index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

// Utils
const { sessions, createSession, getSession, updateSession } = require('../utils/auth');
const { calculateDateRange, fetchProjects } = require('../utils/gitlab');

// Load environment variables
dotenv.config();

// Import your app.js
const appConfig = require('../app');

// Create a new express app for Vercel
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure simple memory-based sessions for Vercel
app.use(session({
  secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 } // 1 hour
}));

// Store samlSessions in a global object so they persist across serverless function calls
// (For limited usage - not a production solution)
global.samlSessions = global.samlSessions || new Map();

// Basic route to serve the main HTML
app.get('/', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'public', 'index.html');
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlContent);
  } catch (error) {
    res.status(500).send('Error loading application');
  }
});

// SAML auth init route
app.get('/api/saml-auth-init', (req, res) => {
  const { gitlabUrl } = req.query;
  
  if (!gitlabUrl) {
    return res.status(400).send('GitLab URL is required');
  }
  
  // Create a session ID to track this authentication attempt
  const sessionId = createSession(gitlabUrl);
  
  // Set a cookie with the session ID
  res.setHeader('Set-Cookie', `samlAuthSessionId=${sessionId}; Path=/; HttpOnly`);
  
  // Redirect to GitLab's SAML login page
  res.redirect(`${gitlabUrl}/users/auth/saml`);
});

// SAML auth status route
app.get('/api/saml-auth-status', (req, res) => {
  // Get session ID from cookie
  const cookies = req.headers.cookie?.split(';').reduce((obj, c) => {
    const [name, value] = c.trim().split('=');
    obj[name] = value;
    return obj;
  }, {}) || {};
  
  const sessionId = cookies.samlAuthSessionId;
  
  if (!sessionId) {
    return res.json({ authenticated: false });
  }
  
  const session = getSession(sessionId);
  
  if (!session) {
    return res.json({ authenticated: false });
  }
  
  // In a real implementation, you would check if the user completed the SAML flow
  // For this example, we'll simulate success after a delay
  if (session.created && (new Date() - session.created > 10000)) {
    updateSession(sessionId, {
      authenticated: true,
      username: 'saml_user@example.com',
      token: 'saml_authenticated_token'
    });
  }
  
  return res.json({
    authenticated: session.authenticated,
    username: session.username,
    session: session.authenticated ? { id: session.id } : null
  });
});

// Copy over all routes from app.js
// API to fetch CI metrics - focused on PAT authentication
app.post('/api/fetch-ci-metrics', appConfig.fetchCIMetrics);

// API endpoint to fetch namespaces - focused on PAT authentication
app.post('/api/fetch-namespaces', appConfig.fetchNamespaces);

module.exports = app;