// vercel-utils.js - Helper functions for Vercel deployment

// Helper to resolve paths correctly in Vercel
const resolvePath = (relativePath) => {
  const path = require('path');
  
  // In Vercel, the base directory is different
  if (process.env.VERCEL) {
    return path.join(process.cwd(), relativePath);
  }
  
  return path.join(__dirname, '..', relativePath);
};

module.exports = {
  resolvePath
};