// api/utils/auth.js
const { v4: uuidv4 } = require('uuid');

// Session storage (note: consider using Vercel KV for production)
const sessions = new Map();

function createSession(gitlabUrl) {
  const sessionId = uuidv4();
  
  sessions.set(sessionId, {
    id: sessionId,
    authenticated: false,
    gitlabUrl,
    username: null,
    token: null,
    created: new Date()
  });
  
  return sessionId;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function updateSession(sessionId, updates) {
  if (!sessions.has(sessionId)) return false;
  
  const session = sessions.get(sessionId);
  sessions.set(sessionId, { ...session, ...updates });
  return true;
}

module.exports = {
  sessions,
  createSession,
  getSession,
  updateSession
};