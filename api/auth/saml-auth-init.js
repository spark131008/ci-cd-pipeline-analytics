// api/auth/saml-auth-init.js
const { createSession } = require('../../utils/auth');

export default function handler(req, res) {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gitlabUrl } = req.query;
  
  if (!gitlabUrl) {
    return res.status(400).json({ error: 'GitLab URL is required' });
  }
  
  // Create a session ID to track this authentication attempt
  const sessionId = createSession(gitlabUrl);
  
  // Set a cookie with the session ID (in a real app, use secure cookies)
  res.setHeader('Set-Cookie', `samlAuthSessionId=${sessionId}; Path=/; HttpOnly`);
  
  // Redirect to GitLab's SAML login page
  res.redirect(`${gitlabUrl}/users/auth/saml`);
}