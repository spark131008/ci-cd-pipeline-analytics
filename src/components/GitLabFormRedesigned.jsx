import React, { useState, useEffect } from 'react';
import { 
  Card, Form, Button, Alert, Container, Row, Col, 
  InputGroup, Spinner, Badge, OverlayTrigger, Tooltip 
} from 'react-bootstrap';
import { 
  FaGitlab, FaKey, FaLock, FaUsers, FaCalendarAlt, 
  FaInfoCircle, FaShieldAlt, FaExclamationTriangle, 
  FaCheck, FaArrowRight, FaLink
} from 'react-icons/fa';

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
  const [formStep, setFormStep] = useState(1);
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);

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
    setIsUrlValid(normalizedUrl.length > 8); // Simple validation
  };

  const handleTokenChange = (e) => {
    const token = e.target.value;
    setPersonalAccessToken(token);
    setIsTokenValid(token.length > 8); // Simple validation
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
      
      // Auto-advance to next step if we have namespaces
      if (data.length > 0 && formStep === 2) {
        setFormStep(3);
      }
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

  const handleSubmit = async (e) => {
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
    
    setIsSubmitting(true);
    setIsSubmitSuccess(false);
    
    try {
      await onSubmit({
        gitlabUrl: normalizedUrl,
        authMethod,
        personalAccessToken,
        samlSessionId: samlSession?.id,
        timeRange,
        namespace
      });
      
      // Show success message
      addAlert('success', 'Successfully fetched CI metrics!');
      
      // Set success state
      setIsSubmitSuccess(true);
      
      // Reset submission state
      setIsSubmitting(false);
      
      // No need to scroll to results anymore as we're switching to dashboard view
    } catch (error) {
      // Error handling is done in the parent component
      setIsSubmitting(false);
      setIsSubmitSuccess(false);
      addAlert('danger', `Error fetching metrics: ${error.message || 'Unknown error'}`);
    }
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

  const nextStep = () => {
    if (formStep === 1 && !isUrlValid) {
      addAlert('warning', 'Please enter a valid GitLab URL.');
      return;
    }
    
    if (formStep === 2 && authMethod === 'pat' && !isTokenValid) {
      addAlert('warning', 'Please enter a valid Personal Access Token.');
      return;
    }
    
    setFormStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setFormStep(prev => Math.max(prev - 1, 1));
  };

  // Render different form steps
  const renderFormStep = () => {
    // If submission was successful, show success state
    if (isSubmitSuccess) {
      return (
        <div className="step-content">
          <div className="text-center my-4 py-3">
            <div className="success-checkmark">
              <div className="check-icon">
                <span className="icon-line line-tip"></span>
                <span className="icon-line line-long"></span>
                <div className="icon-circle"></div>
                <div className="icon-fix"></div>
              </div>
            </div>
            <h4 className="mt-4 mb-3">CI Metrics Successfully Fetched!</h4>
            <p className="text-muted">Your GitLab CI/CD metrics have been successfully retrieved and are now displayed in the dashboard.</p>
            <div className="mt-4">
              <Button 
                variant="outline-primary" 
                onClick={() => {
                  // Reset form for new submission
                  setIsSubmitSuccess(false);
                  setFormStep(1);
                }}
              >
                Start New Analysis
              </Button>
            </div>
          </div>
        </div>
      );
    }

    switch (formStep) {
      case 1:
        return (
          <div className="step-content">
            <h4 className="mb-3">Step 1: Connect to GitLab</h4>
            <Form.Group className="mb-3">
              <Form.Label>
                <FaGitlab className="me-2" />
                GitLab Base URL
              </Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaLink />
                </InputGroup.Text>
                <Form.Control 
                  type="url" 
                  placeholder="https://gitlab.com" 
                  value={gitlabUrl}
                  onChange={handleUrlChange}
                  required
                  className={gitlabUrl ? (isUrlValid ? "is-valid" : "is-invalid") : ""}
                />
                {isUrlValid && (
                  <InputGroup.Text className="bg-success text-white">
                    <FaCheck />
                  </InputGroup.Text>
                )}
              </InputGroup>
              <Form.Text className="text-muted">
                Your GitLab instance URL (e.g., https://gitlab.com)
                <br />
                Enter only the base GitLab URL without any repository paths.
              </Form.Text>
            </Form.Group>
            
            <div className="d-flex justify-content-between mt-4">
              <div></div> {/* Empty div for spacing */}
              <Button 
                variant="primary" 
                onClick={nextStep}
                disabled={!isUrlValid}
              >
                Next <FaArrowRight className="ms-1" />
              </Button>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="step-content">
            <h4 className="mb-3">Step 2: Authentication</h4>
            
            <Form.Group className="mb-3">
              <Form.Label>
                <FaShieldAlt className="me-2" />
                Authentication Method
              </Form.Label>
              <div className="auth-method-selector mb-3">
                <Row>
                  <Col xs={12} md={6}>
                    <Card 
                      className={`auth-card ${authMethod === 'pat' ? 'selected' : ''}`}
                      onClick={() => setAuthMethod('pat')}
                    >
                      <Card.Body className="d-flex align-items-center">
                        <FaKey size={24} className="me-3 text-primary" />
                        <div>
                          <h5 className="mb-1">Personal Access Token</h5>
                          <p className="mb-0 text-muted small">Use a token from your GitLab account</p>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card className="auth-card disabled">
                      <Card.Body className="d-flex align-items-center">
                        <FaLock size={24} className="me-3 text-secondary" />
                        <div>
                          <h5 className="mb-1">SAML Authentication</h5>
                          <p className="mb-0 text-muted small">Coming Soon</p>
                          <Badge bg="warning" className="mt-1">Beta</Badge>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
              
              {authMethod === 'pat' && (
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaKey className="me-2" />
                    Personal Access Token
                  </Form.Label>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaLock />
                    </InputGroup.Text>
                    <Form.Control 
                      type="password" 
                      value={personalAccessToken}
                      onChange={handleTokenChange}
                      required
                      className={personalAccessToken ? (isTokenValid ? "is-valid" : "is-invalid") : ""}
                    />
                    {isTokenValid && (
                      <InputGroup.Text className="bg-success text-white">
                        <FaCheck />
                      </InputGroup.Text>
                    )}
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Create a token with <code>api, read_api, read_user, read_repository, read_registry</code> scope at 
                    <code> Settings &gt; Access Tokens</code> in your GitLab account
                  </Form.Text>
                </Form.Group>
              )}
            </Form.Group>
            
            <div className="d-flex justify-content-between mt-4">
              <Button variant="outline-secondary" onClick={prevStep}>
                Back
              </Button>
              <Button 
                variant="primary" 
                onClick={nextStep}
                disabled={authMethod === 'pat' && !isTokenValid}
              >
                Next <FaArrowRight className="ms-1" />
              </Button>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="step-content">
            <h4 className="mb-3">Step 3: Select Group & Time Range</h4>
            
            <Form.Group className="mb-4">
              <Form.Label>
                <FaUsers className="me-2" />
                Available GitLab Groups
              </Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaUsers />
                </InputGroup.Text>
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
                {loadingNamespaces && (
                  <InputGroup.Text>
                    <Spinner animation="border" size="sm" />
                  </InputGroup.Text>
                )}
              </InputGroup>
              <Form.Text className="text-muted">
                Select a group to limit analysis to projects in that group.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>
                <FaCalendarAlt className="me-2" />
                Time Range
              </Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <FaCalendarAlt />
                </InputGroup.Text>
                <Form.Select 
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="day">Last Day</option>
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="year">Last Year</option>
                </Form.Select>
              </InputGroup>
            </Form.Group>
            
            <div className="d-flex justify-content-between mt-4">
              <Button variant="outline-secondary" onClick={prevStep}>
                Back
              </Button>
              <Button 
                variant="primary" 
                onClick={nextStep}
                disabled={!namespace}
              >
                Review <FaArrowRight className="ms-1" />
              </Button>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div className="step-content">
            <h4 className="mb-3">Step 4: Review & Submit</h4>
            
            <Card className="mb-3 summary-card">
              <Card.Body>
                <h5 className="card-title">Configuration Summary</h5>
                <Row className="mb-2">
                  <Col xs={4} className="text-muted">GitLab URL:</Col>
                  <Col xs={8} className="fw-bold">{gitlabUrl}</Col>
                </Row>
                <Row className="mb-2">
                  <Col xs={4} className="text-muted">Authentication:</Col>
                  <Col xs={8} className="fw-bold">
                    {authMethod === 'pat' ? 'Personal Access Token' : 'SAML Authentication'}
                  </Col>
                </Row>
                <Row className="mb-2">
                  <Col xs={4} className="text-muted">Selected Group:</Col>
                  <Col xs={8} className="fw-bold">
                    {namespaces.find(g => g.path === namespace)?.name || namespace}
                  </Col>
                </Row>
                <Row className="mb-2">
                  <Col xs={4} className="text-muted">Time Range:</Col>
                  <Col xs={8} className="fw-bold">
                    {timeRange === 'day' ? 'Last Day' : 
                     timeRange === 'week' ? 'Last Week' : 
                     timeRange === 'month' ? 'Last Month' : 'Last Year'}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
            
            <Alert variant="info" className="d-flex align-items-center">
              <FaInfoCircle size={20} className="me-3" />
              <div>
                <strong>Privacy Note:</strong> Your Personal Access Token is only used for API requests and is never stored permanently.
              </div>
            </Alert>
            
            {isSubmitting ? (
              <div className="text-center my-4 py-3">
                <Spinner animation="border" variant="primary" className="mb-3" />
                <h5>Fetching CI Metrics...</h5>
                <p className="text-muted small">This may take a moment depending on the size of your GitLab group</p>
              </div>
            ) : (
              <div className="d-flex justify-content-between mt-4">
                <Button variant="outline-secondary" onClick={prevStep}>
                  Back
                </Button>
                <Button 
                  variant="success" 
                  type="submit"
                >
                  Fetch CI Metrics
                </Button>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className="gitlab-form-card">
      <Card.Header className="bg-primary text-white">
        <div className="d-flex align-items-center">
          <FaGitlab size={24} className="me-2" />
          <h4 className="mb-0">GitLab CI Analytics Configuration</h4>
        </div>
      </Card.Header>
      <Card.Body>
        <div className="progress-indicator mb-4">
          <div className="progress" style={{ height: '8px' }}>
            <div 
              className="progress-bar" 
              role="progressbar" 
              style={{ width: `${formStep * 25}%` }}
              aria-valuenow={formStep * 25} 
              aria-valuemin="0" 
              aria-valuemax="100"
            ></div>
          </div>
          <div className="d-flex justify-content-between mt-2">
            <div className={`step-indicator ${formStep >= 1 ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-label d-none d-md-block">Connect</div>
            </div>
            <div className={`step-indicator ${formStep >= 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-label d-none d-md-block">Authenticate</div>
            </div>
            <div className={`step-indicator ${formStep >= 3 ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <div className="step-label d-none d-md-block">Select</div>
            </div>
            <div className={`step-indicator ${formStep >= 4 ? 'active' : ''}`}>
              <div className="step-number">4</div>
              <div className="step-label d-none d-md-block">Review</div>
            </div>
          </div>
        </div>
        
        <Form onSubmit={handleSubmit}>
          {renderFormStep()}
        </Form>
      </Card.Body>
      <Card.Footer className="bg-light">
        <div className="d-flex align-items-center">
          <FaExclamationTriangle className="text-warning me-2" />
          <small className="text-muted">
            For GitLab instances that use SAML authentication (like Stanford's GitLab), 
            you may need to use a different authentication method.
          </small>
        </div>
      </Card.Footer>
    </Card>
  );
};

// Add custom CSS for the form
const styles = `
<style>
  .gitlab-form-card {
    border: none;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 2rem;
  }
  
  .step-content {
    min-height: 300px;
  }
  
  .progress-indicator {
    padding: 0 10px;
  }
  
  .step-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 1;
  }
  
  .step-number {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #e9ecef;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    margin-bottom: 5px;
    transition: all 0.3s ease;
  }
  
  .step-indicator.active .step-number {
    background-color: #007bff;
    color: white;
  }
  
  .step-label {
    font-size: 0.8rem;
    color: #6c757d;
    transition: all 0.3s ease;
  }
  
  .step-indicator.active .step-label {
    color: #007bff;
    font-weight: bold;
  }
  
  .auth-method-selector .card {
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    margin-bottom: 1rem;
  }
  
  .auth-method-selector .card:hover:not(.disabled) {
    transform: translateY(-3px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }
  
  .auth-method-selector .card.selected {
    border-color: #007bff;
    background-color: rgba(0, 123, 255, 0.05);
  }
  
  .auth-method-selector .card.disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .summary-card {
    background-color: #f8f9fa;
    border-left: 4px solid #007bff;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .step-content {
      min-height: 400px;
    }
  }
  
  /* Success checkmark animation */
  .success-checkmark {
    width: 80px;
    height: 80px;
    margin: 0 auto;
  }
  
  .success-checkmark .check-icon {
    width: 80px;
    height: 80px;
    position: relative;
    border-radius: 50%;
    box-sizing: content-box;
    border: 4px solid #4CAF50;
  }
  
  .success-checkmark .check-icon::before {
    top: 3px;
    left: -2px;
    width: 30px;
    transform-origin: 100% 50%;
    border-radius: 100px 0 0 100px;
  }
  
  .success-checkmark .check-icon::after {
    top: 0;
    left: 30px;
    width: 60px;
    transform-origin: 0 50%;
    border-radius: 0 100px 100px 0;
    animation: rotate-circle 4.25s ease-in;
  }
  
  .success-checkmark .check-icon::before, .success-checkmark .check-icon::after {
    content: '';
    height: 100px;
    position: absolute;
    background: #FFFFFF;
    transform: rotate(-45deg);
  }
  
  .success-checkmark .check-icon .icon-line {
    height: 5px;
    background-color: #4CAF50;
    display: block;
    border-radius: 2px;
    position: absolute;
    z-index: 10;
  }
  
  .success-checkmark .check-icon .icon-line.line-tip {
    top: 46px;
    left: 14px;
    width: 25px;
    transform: rotate(45deg);
    animation: icon-line-tip 0.75s;
  }
  
  .success-checkmark .check-icon .icon-line.line-long {
    top: 38px;
    right: 8px;
    width: 47px;
    transform: rotate(-45deg);
    animation: icon-line-long 0.75s;
  }
  
  .success-checkmark .check-icon .icon-circle {
    top: -4px;
    left: -4px;
    z-index: 10;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    position: absolute;
    box-sizing: content-box;
    border: 4px solid rgba(76, 175, 80, 0.5);
  }
  
  .success-checkmark .check-icon .icon-fix {
    top: 8px;
    width: 5px;
    left: 26px;
    z-index: 1;
    height: 85px;
    position: absolute;
    transform: rotate(-45deg);
    background-color: #FFFFFF;
  }
  
  @keyframes rotate-circle {
    0% {
      transform: rotate(-45deg);
    }
    5% {
      transform: rotate(-45deg);
    }
    12% {
      transform: rotate(-405deg);
    }
    100% {
      transform: rotate(-405deg);
    }
  }
  
  @keyframes icon-line-tip {
    0% {
      width: 0;
      left: 1px;
      top: 19px;
    }
    54% {
      width: 0;
      left: 1px;
      top: 19px;
    }
    70% {
      width: 50px;
      left: -8px;
      top: 37px;
    }
    84% {
      width: 17px;
      left: 21px;
      top: 48px;
    }
    100% {
      width: 25px;
      left: 14px;
      top: 45px;
    }
  }
  
  @keyframes icon-line-long {
    0% {
      width: 0;
      right: 46px;
      top: 54px;
    }
    65% {
      width: 0;
      right: 46px;
      top: 54px;
    }
    84% {
      width: 55px;
      right: 0px;
      top: 35px;
    }
    100% {
      width: 47px;
      right: 8px;
      top: 38px;
    }
  }
</style>
`;

// Append styles to the component
const GitLabFormWithStyles = () => {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: styles }} />
      <GitLabForm />
    </>
  );
};

export default GitLabForm;