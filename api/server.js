const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Only serve static files locally, not on Vercel
if (!process.env.VERCEL) {
  app.use(express.static('public'));
  app.use(express.static('dist'));
}

// Session Configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 }
};

// Redis session store setup
if (!process.env.VERCEL && process.env.REDIS_URL) {
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
  // Use memory session store
  app.use(session(sessionConfig));
}

// Import API handlers - same paths for both Vercel and local
const fetchCIMetricsHandler = require('./gitlab/fetch-ci-metrics');
const fetchNamespacesHandler = require('./gitlab/fetch-namespaces');
const samlAuthInitHandler = require('./auth/saml-auth-init');
const samlAuthStatusHandler = require('./auth/saml-auth-status');
const testApi = require('./test');

// Register API routes
app.post('/api/gitlab/fetch-ci-metrics', fetchCIMetricsHandler);
app.post('/api/gitlab/fetch-namespaces', fetchNamespacesHandler);
app.get('/api/saml-auth-init', samlAuthInitHandler);
app.get('/api/saml-auth-status', samlAuthStatusHandler);
app.get("/api/test", testApi);

// Root route handler
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  }
});

// Handle unknown routes - for SPA client-side routing
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  }
});

// Start server for local development
if (!process.env.VERCEL && require.main === module) {
  const PORT = process.env.PORT || 3000;
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
}

// Export the Express app
module.exports = app;