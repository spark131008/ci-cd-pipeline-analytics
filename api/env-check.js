// api/env-check.js
module.exports = (req, res) => {
  // Create a sanitized version of process.env without sensitive information
  const safeEnv = {};
  
  // List of environment variables that are safe to display
  const safeKeys = [
    'NODE_ENV',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
    'VERCEL_REGION'
  ];
  
  // Add safe environment variables to the response
  safeKeys.forEach(key => {
    if (process.env[key] !== undefined) {
      safeEnv[key] = process.env[key];
    }
  });
  
  // Add keys of other environment variables without their values
  Object.keys(process.env).forEach(key => {
    if (!safeKeys.includes(key)) {
      safeEnv[key] = '[REDACTED]';
    }
  });
  
  // Return the safe environment information
  res.status(200).json({
    environment: process.env.NODE_ENV || 'unknown',
    isVercel: !!process.env.VERCEL,
    environmentVariables: safeEnv,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
};
