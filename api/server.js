const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// PORT defined outside setup function to be accessible everywhere
const PORT = process.env.PORT || 3000;

// Setup the app
const setupApp = () => {
  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  // Serve static files from both public and dist directories
  app.use(express.static('public'));
  app.use(express.static('dist'));

  // Session Configuration
  let sessionConfig = {
    secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 }
  };

  if (process.env.VERCEL) {
    console.log('Running in Vercel environment, using memory session store');
    app.use(session(sessionConfig));
  } else if (process.env.REDIS_URL) {
    try {
      const RedisStore = require('connect-redis').default;
      const { createClient } = require('redis');
      
      const redisClient = createClient({ url: process.env.REDIS_URL });
      
      redisClient.connect().catch(err => {
        console.warn('Redis connection failed:', err.message);
        app.use(session(sessionConfig));
      });

      redisClient.on('connect', () => {
        console.log('Redis connected successfully');
        sessionConfig.store = new RedisStore({ client: redisClient });
        app.use(session(sessionConfig));
      });

    } catch (error) {
      console.warn('Failed to initialize Redis:', error.message);
      app.use(session(sessionConfig));
    }
  } else {
    console.log('No REDIS_URL provided, using memory session store');
    app.use(session(sessionConfig));
  }

  // Routes
  app.get('/', (req, res) => {
    // In development, the frontend is served by Vite
    // In production, serve the built index.html
    if (process.env.VERCEL) {
      // In Vercel environment, redirects are handled by vercel.json
      res.status(200).send('API server is running');
    } else if (process.env.NODE_ENV === 'production') {
      res.sendFile(path.join(__dirname, '../dist', 'index.html'));
    } else {
      res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
  });

  // Import API handlers
  const fetchCIMetricsHandler = require('./gitlab/fetch-ci-metrics');  // If within api folder
  const fetchNamespacesHandler = require('./gitlab/fetch-namespaces');
  const samlAuthInitHandler = require('./auth/saml-auth-init');
  const samlAuthStatusHandler = require('./auth/saml-auth-status');

  // Register API routes
  app.post('/api/gitlab/fetch-ci-metrics', fetchCIMetricsHandler);
  app.post('/api/gitlab/fetch-namespaces', fetchNamespacesHandler);
  app.get('/api/saml-auth-init', samlAuthInitHandler);
  app.get('/api/saml-auth-status', samlAuthStatusHandler);

  // Debug log
  console.log('Handlers loaded:', {
    fetchCIMetricsHandler: typeof fetchCIMetricsHandler,
    fetchNamespacesHandler: typeof fetchNamespacesHandler
  });

  // Handle unknown routes - for SPA client-side routing
  app.get('*', (req, res) => {
    if (process.env.VERCEL) {
      // In Vercel, let vercel.json handle routing
      res.status(404).send('Not found');
    } else if (process.env.NODE_ENV === 'production') {
      res.sendFile(path.join(__dirname, '../dist', 'index.html'));
    } else {
      res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
  });

  return app;
};

// Create and return a server for local development
const setupLocalServer = () => {
  const app = setupApp();
  const server = app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
  });

  // Handle address-in-use errors gracefully
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is busy, trying ${PORT+1}...`);
      setTimeout(() => {
        server.close();
        app.listen(PORT+1, () => {
          console.log(`Server running locally on port ${PORT+1}`);
        });
      }, 1000);
    } else {
      console.error('Server error:', e);
    }
  });
  
  return server;
};

// Export appropriate objects based on environment
if (require.main === module) {
  // If this file is being run directly, start the server
  setupLocalServer();
} else {
  // If this file is being required, export the setup function
  module.exports = setupApp;
}