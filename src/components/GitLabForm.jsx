import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { gitlabApi, authApi } from '../utils/api';

const GitLabForm = ({ onSubmit, addAlert }) => {
  const [gitlabUrl, setGitlabUrl] = useState('');
  const [personalAccessToken, setPersonalAccessToken] = useState('');
  const [authMethod, setAuthMethod] = useState('pat');
  const [namespace, setNamespace] = useState('');
  const [timeRange, setTimeRange] = useState('month');
  const [namespaces, setNamespaces] = useState([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);
  const [samlSession, setSamlSession] = useState(null);
  const [samlStatus, setSamlStatus] = useState('Not authenticated');
  const [connectionStatus, setConnectionStatus] = useState('unknown'); // 'unknown', 'success', 'error'
  const [errorDetails, setErrorDetails] = useState(null);
  const [lastTested, setLastTested] = useState(null);

  useEffect(() => {
    if (gitlabUrl && (
      (authMethod === 'pat' && personalAccessToken) ||
      (authMethod === 'saml' && samlSession)
    )) {
      // Reset states when credentials change
      setConnectionStatus('unknown');
      setErrorDetails(null);
      setNamespaces([]);
      setNamespace('');
      
      // Debounce fetch namespaces to prevent multiple rapid requests
      const timer = setTimeout(() => {
        fetchNamespaces();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [gitlabUrl, personalAccessToken, authMethod, samlSession]);

  const testGitLabConnection = async () => {
    if (!gitlabUrl || (authMethod === 'pat' && !personalAccessToken)) {
      addAlert('warning', 'Please provide GitLab URL and authentication credentials');
      return;
    }
    
    try {
      setConnectionStatus('testing');
      setErrorDetails(null);
      
      // Use the test API endpoint
      const response = await fetch(`/api/gitlab/test-api?url=${encodeURIComponent(gitlabUrl)}&token=${encodeURIComponent(personalAccessToken)}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setConnectionStatus('success');
        setLastTested(new Date());
        addAlert('success', `Successfully connected to GitLab ${data.gitlab_version.version}`);
      } else {
        setConnectionStatus('error');
        setErrorDetails(data);
        addAlert('danger', `Connection test failed: ${data.error || data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing GitLab connection:', error);
      setConnectionStatus('error');
      setErrorDetails({ message: error.message });
      addAlert('danger', `Connection test error: ${error.message}`);
    }
  };
  
  const fetchNamespaces = async () => {
    if (!gitlabUrl) return;
    
    setLoadingNamespaces(true);
    setConnectionStatus('testing'); // Update connection status while loading
    
    try {
      const requestBody = {
        gitlabUrl,
        authMethod
      };
      
      if (authMethod === 'pat') {
        requestBody.personalAccessToken = personalAccessToken;
      } else if (samlSession) {
        requestBody.samlSessionId = samlSession.id;
      } else {
        return;
      }
      
      console.log('Fetching namespaces with:', {...requestBody, personalAccessToken: requestBody.personalAccessToken ? '[MASKED]' : undefined});
      
      // Use our API client instead of fetch directly
      const data = await gitlabApi.fetchNamespaces(requestBody);
      console.log('Namespaces received:', data);
      setNamespaces(data);
      setConnectionStatus('success');
      setLastTested(new Date());
      setErrorDetails(null);
      
      // Show success message only if we found groups
      if (data.length > 0) {
        addAlert('success', `Successfully fetched ${data.length} GitLab groups`);
      } else {
        addAlert('warning', 'No GitLab groups found with your current access level');
      }
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      setConnectionStatus('error');
      setErrorDetails({ message: error.message });
      addAlert('danger', `Error fetching GitLab groups: ${error.message}`);
    } finally {
      setLoadingNamespaces(false);
    }
  };

  const handleAuthMethodChange = (e) => {
    setAuthMethod(e.target.value);
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
    
    onSubmit({
      gitlabUrl,
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
      
      if (gitlabUrl.includes('stanford.edu')) {
        // Stanford GitLab auth flow
        const signInUrl = `${gitlabUrl}/users/sign_in`;
        const signInWindow = window.open(
          signInUrl,
          'GitLab Sign In',
          'width=800,height=700'
        );
        
        setSamlStatus("Please sign in to GitLab with your Stanford credentials.");
      } else {
        // Regular SAML flow
        const samlWindow = window.open(
          `/api/saml-auth-init?gitlabUrl=${encodeURIComponent(gitlabUrl)}`,
          'GitLab SAML Login',
          'width=600,height=700'
        );
        
        // Poll for auth status
        const checkInterval = setInterval(async () => {
          try {
            const data = await authApi.getSamlAuthStatus();
            
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
      const tokenResponse = await fetch('/api/auth/get-gitlab-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gitlabUrl
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
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>GitLab URL</Form.Label>
            <Form.Control 
              type="url" 
              placeholder="https://gitlab.com" 
              value={gitlabUrl}
              onChange={(e) => setGitlabUrl(e.target.value)}
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
              <option value="saml">SAML Authentication</option>
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
                Create a token with <code>read_api</code> scope at 
                <code> Settings &gt; Access Tokens</code> in your GitLab account
              </Form.Text>
            </Form.Group>
          ) : (
            <div className="mb-3">
              <Alert variant="info">
                <p><strong>SAML Authentication:</strong> Click the button below to authenticate with GitLab using SAML.</p>
                <Button variant="primary" onClick={handleSamlLogin}>Login with SAML</Button>
                
                {gitlabUrl && gitlabUrl.includes('stanford.edu') && samlStatus.includes('credentials') && (
                  <Button 
                    variant="success" 
                    className="ms-2" 
                    onClick={completeStanfordAuth}
                  >
                    Complete Authentication
                  </Button>
                )}
              </Alert>
              <div className="form-text">
                <strong>Status:</strong> {samlStatus}
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
        
        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
          <Button variant="outline-secondary" size="sm" onClick={testGitLabConnection} disabled={!gitlabUrl || (authMethod === 'pat' && !personalAccessToken)}>
            Test GitLab Connection
          </Button>
          
          {connectionStatus === 'testing' && (
            <div>
              <Spinner animation="border" size="sm" /> Testing connection...
            </div>
          )}
          
          {connectionStatus === 'success' && (
            <Badge bg="success" className="p-2">
              Connection Successful
              {lastTested && (
                <small className="ms-2">({new Date(lastTested).toLocaleTimeString()})</small>
              )}
            </Badge>
          )}
          
          {connectionStatus === 'error' && (
            <Badge bg="danger" className="p-2">Connection Failed</Badge>
          )}
        </div>
        
        {errorDetails && (
          <Alert variant="danger" className="mt-3">
            <strong>Error Details:</strong>
            <p className="mb-1">{errorDetails.message || 'Unknown error'}</p>
            {errorDetails.status && <p className="mb-0">Status: {errorDetails.status}</p>}
            {errorDetails.code && <p className="mb-0">Code: {errorDetails.code}</p>}
            <hr />
            <p className="mb-0">
              <a href="/api" target="_blank" rel="noopener noreferrer" className="text-danger">
                Check API Status
              </a>
            </p>
          </Alert>
        )}
        
        <Alert variant="info" className="mt-3">
          <strong>Troubleshooting:</strong> If you're experiencing issues with API calls,
          please ensure:
          <ul className="mb-0">
            <li>Your GitLab URL is correct and accessible</li>
            <li>Your Personal Access Token has the <code>read_api</code> scope</li>
            <li>You have access to at least one group in GitLab</li>
          </ul>
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default GitLabForm;