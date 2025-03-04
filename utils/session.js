// api/utils/session.js
const session = require('express-session');

function configureSession(app) {
  // Check if we're in production (Vercel)
  if (process.env.VERCEL) {
    // Use memory store for Vercel (not ideal for production, but works for demos)
    app.use(session({
      secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 }
    }));
  } else {
    // Only use Redis in local development
    const RedisStore = require('connect-redis').default;
    const { createClient } = require('redis');
    
    const redisClient = createClient({
      url: process.env.REDIS_URL
    });
    redisClient.connect().catch(console.error);
    
    app.use(session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || 'gitlab-ci-analytics-session-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 3600000 }
    }));
  }
}

module.exports = { configureSession };