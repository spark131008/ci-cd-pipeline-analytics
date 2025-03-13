// api/index.js - Vercel serverless entry point
const serverless = require('serverless-http');
const app = require('./server');

// Export the serverless handler directly
module.exports = serverless(app());