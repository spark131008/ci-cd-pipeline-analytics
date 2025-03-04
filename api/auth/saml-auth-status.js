const { getSession, updateSession } = require('../../utils/auth');

module.exports = (req, res) => {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get session ID from cookie
  const sessionId = req.cookies?.samlAuthSessionId;
  
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
};