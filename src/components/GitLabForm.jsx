import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';

const GitLabForm = ({ onSubmit, addAlert }) => {
  const [gitlabUrl, setGitlabUrl] = useState('');
  const [personalAccessToken, setPersonalAccessToken] = useState('');
  const [authMethod, setAuthMethod] = useState('pat'); // Only 'pat' is available, 'saml' is disabled in UI
  const [namespace, setNamespace] = useState('');
  const [timeRange, setTimeRange] = useState('month');
  const [namespaces, setNamespaces] = useState([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);
  const [samlSession, setSamlSession] = useState(null);
  const [samlStatus, setSamlStatus] = useState('Not authenticated');

  // Function to normalize URL by adding https:// if missing and removing duplicates
  const normalizeUrl = (url) => {
    if (!url) return '';
    
    // Remove leading/trailing whitespace
    let normalizedUrl = url.trim();
    
    // Check for duplicate https:// patterns
    const httpsPattern = /^(https:\/\/)+/i;
    if (httpsPattern.test(normalizedUrl)) {
      // Replace multiple https:// with a single one
      normalizedUrl = normalizedUrl.replace(httpsPattern, 'https://');
    } else if (!normalizedUrl.match(/^https?:\/\//i)) {
      // Add https:// if no protocol is specified
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    return normalizedUrl;
  };

  const handleUrlChange = (e) => {
    const normalizedUrl = normalizeUrl(e.target.value);
    setGitlabUrl(normalizedUrl);
  };

  useEffect(() => {
    if (gitlabUrl && (
      (authMethod === 'pat' && personalAccessToken) ||
      (authMethod === 'saml' && samlSession)
    )) {
      fetchNamespaces();
    }
  }, [gitlabUrl, personalAccessToken, authMethod, samlSession]);

  const fetchNamespaces = async () => {
    if (!gitlabUrl) return;
    
    setLoadingNamespaces(true);
    
    try {
      // Ensure URL is normalized before using it
      const normalizedUrl = normalizeUrl(gitlabUrl);
      
      const requestBody = {
        gitlabUrl: normalizedUrl,
        authMethod
      };
      
      if (authMethod === 'pat') {
        requestBody.personalAccessToken = personalAccessToken;
      } else if (samlSession) {
        requestBody.samlSessionId = samlSession.id;
      } else {
        return;
      }
      
      const response = await fetch('/api/gitlab/fetch-namespaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      
      const data = await response.json();
      setNamespaces(data);
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      addAlert('danger', `Error fetching GitLab groups: ${error.message}`);
    } finally {
      setLoadingNamespaces(false);
    }
  };

  const handleAuthMethodChange = (e) => {
    // Prevent selecting the SAML option since it's disabled/coming soon
    const newAuthMethod = e.target.value === 'saml' ? 'pat' : e.target.value;
    setAuthMethod(newAuthMethod);
    setNamespace('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!namespace) {
      addAlert('warning', 'Please select a GitLab group to analyze.');
      return;
    }
    
    if (authMethod === 'pat' && !personalAccessToken) {
      addAlert('warning', 'Please enter a Personal Access Token.');
      return;
    }
    
    if (authMethod === 'saml' && !samlSession) {
      addAlert('warning', 'Please authenticate with SAML before proceeding.');
      return;
    }
    
    // Ensure URL is normalized before submitting
    const normalizedUrl = normalizeUrl(gitlabUrl);
    
    onSubmit({
      gitlabUrl: normalizedUrl,
      authMethod,
      personalAccessToken,
      samlSessionId: samlSession?.id,
      timeRange,
      namespace
    });
  };

  const handleSamlLogin = async () => {
    if (!gitlabUrl) {
      addAlert('warning', 'Please enter a GitLab URL first.');
      return;
    }
    
    try {
      setSamlStatus("Initiating GitLab authentication...");
      
      // Ensure URL is normalized before using it
      const normalizedUrl = normalizeUrl(gitlabUrl);
      
      if (normalizedUrl.includes('stanford.edu')) {
        // Stanford GitLab auth flow
        const signInUrl = `${normalizedUrl}/users/sign_in`;
        const signInWindow = window.open(
          signInUrl,
          'GitLab Sign In',
          'width=800,height=700'
        );
        
        setSamlStatus("Please sign in to GitLab with your Stanford credentials.");
      } else {
        // Regular SAML flow
        const samlWindow = window.open(
          `/api/saml-auth-init?gitlabUrl=${encodeURIComponent(normalizedUrl)}`,
          'GitLab SAML Login',
          'width=600,height=700'
        );
        
        // Poll for auth status
        const checkInterval = setInterval(async () => {
          try {
            const response = await fetch('/api/saml-auth-status');
            const data = await response.json();
            
            if (data.authenticated) {
              clearInterval(checkInterval);
              setSamlSession(data.session);
              setSamlStatus(`Authenticated as: ${data.username}`);
              if (samlWindow && !samlWindow.closed) {
                samlWindow.close();
              }
            }
          } catch (error) {
            console.error('Error checking SAML auth status:', error);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error initiating authentication:', error);
      setSamlStatus("Error initiating authentication.");
      addAlert('danger', `Authentication error: ${error.message}`);
    }
  };

  const completeStanfordAuth = async () => {
    try {
      // Ensure URL is normalized before using it
      const normalizedUrl = normalizeUrl(gitlabUrl);
      
      const tokenResponse = await fetch('/api/auth/get-gitlab-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gitlabUrl: normalizedUrl
        }),
        credentials: 'include'
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get authentication token');
      }
      
      const tokenData = await tokenResponse.json();
      setSamlSession(tokenData.session);
      setSamlStatus(`Authenticated successfully!`);
    } catch (error) {
      console.error('Error getting token:', error);
      setSamlStatus("Error completing authentication.");
      addAlert('danger', `Authentication error: ${error.message}`);
    }
  };

  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Configuration</h5>
      </Card.Header>
      <Card.Body>
        <Alert variant="info" className="mb-3">
          <strong>Privacy Note:</strong> This app does not store any data permanently. All information is session-lived and will be cleared when you close your browser.
        </Alert>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>GitLab Base URL</Form.Label>
            <Form.Control 
              type="url" 
              placeholder="https://gitlab.com" 
              value={gitlabUrl}
              onChange={handleUrlChange}
              required
            />
            <Form.Text className="text-muted">
              Your GitLab instance URL (e.g., https://gitlab.com)
              <br />
              Enter only the base GitLab URL (e.g., "https://gitlab.com" or "https://code.stanford.edu") 
              without any repository paths.
            </Form.Text>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Authentication Method</Form.Label>
            <Form.Select 
              value={authMethod}
              onChange={handleAuthMethodChange}
            >
              <option value="pat">Personal Access Token</option>
              <option value="saml" disabled>SAML Authentication (Coming Soon)</option>
            </Form.Select>
            <Form.Text className="text-muted">
              Choose how to authenticate with GitLab. For enterprise GitLab instances, SAML might be required.
            </Form.Text>
          </Form.Group>
          
          {authMethod === 'pat' ? (
            <Form.Group className="mb-3">
              <Form.Label>Personal Access Token</Form.Label>
              <Form.Control 
                type="password" 
                value={personalAccessToken}
                onChange={(e) => setPersonalAccessToken(e.target.value)}
                required={authMethod === 'pat'}
              />
              <Form.Text className="text-muted">
                Create a token with <code>api, read_api, read_user, read_repository, read_registry</code> scope at 
                <code> Settings &gt; Access Tokens</code> in your GitLab account
              </Form.Text>
            </Form.Group>
          ) : (
            <div className="mb-3">
              <Alert variant="secondary">
                <p><strong>SAML Authentication:</strong> This feature is coming soon and is not yet available.</p>
                <Button variant="secondary" disabled>
                  Login with SAML
                </Button>
              </Alert>
              <div className="form-text">
                <strong>Status:</strong> Feature in development
              </div>
            </div>
          )}
          
          <Form.Group className="mb-3">
            <Form.Label>Available GitLab Group</Form.Label>
            <Form.Select 
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              disabled={loadingNamespaces || namespaces.length === 0}
              required
            >
              <option value="">
                {loadingNamespaces 
                  ? 'Loading groups...' 
                  : namespaces.length === 0 
                    ? 'Complete authentication first' 
                    : 'Select a group'}
              </option>
              {namespaces.map((group) => (
                <option key={group.id} value={group.path}>
                  {group.name}
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Select a group to limit analysis to projects in that group.
            </Form.Text>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Time Range</Form.Label>
            <Form.Select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="day">Last Day</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </Form.Select>
          </Form.Group>
          
          <Button type="submit" variant="primary">Fetch CI Metrics</Button>
        </Form>
        
        <Alert variant="secondary" className="mt-3 mb-3">
          <strong>Security Note:</strong> Your Personal Access Token is only used for API requests and is never stored permanently. It remains in memory only for the duration of your session.
        </Alert>
        
        <Alert variant="info" className="mt-3">
          <strong>Note:</strong> For GitLab instances that use SAML authentication (like Stanford's GitLab), 
          you may need to use a different authentication method. Personal Access Tokens alone might not work.
          Please contact your GitLab administrator for the correct API access method.
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default GitLabForm;