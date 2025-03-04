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

// Expanded CORS configuration
app.use(cors({
  origin: '*', // During development; restrict this in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add Content Security Policy middleware to relax restrictions during development
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;");
  next();
});

// Standard middleware
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

// Add API routes with proper HTTP methods
app.post('/api/fetch-ci-metrics', require('./gitlab/fetch-ci-metrics'));
app.post('/api/fetch-namespaces', require('./fetch-namespaces'));
app.get('/api/saml-auth-init', require('./auth/saml-auth-init'));
app.get('/api/saml-auth-status', require('./auth/saml-auth-status'));

// Add a simple test endpoint to verify API functionality
app.get('/api/test', (req, res) => {
  res.status(200).json({ message: 'API is working', timestamp: new Date().toISOString() });
});

// Handle any other route
app.get('*', (req, res) => {
  try {
    // First, try to serve from public directory
    const requestedPath = req.path.substring(1);  // Remove leading slash
    const filePath = path.join(process.cwd(), 'public', requestedPath);
    
    // Check if file exists
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    
    // If not found, return the main HTML file
    const indexPath = path.join(process.cwd(), 'public', 'index.html');
    res.setHeader('Content-Type', 'text/html');
    res.status(200).sendFile(indexPath);
  } catch (error) {
    res.status(500).send('Error loading application');
  }
});

// Export for Vercel
module.exports = app;