import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';

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