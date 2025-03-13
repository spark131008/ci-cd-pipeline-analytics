import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Button, Alert, Table, Badge, Spinner } from 'react-bootstrap';

const DiagnosticPage = () => {
  const [apiHealth, setApiHealth] = useState(null);
  const [buildInfo, setBuildInfo] = useState(null);
  const [connectionTest, setConnectionTest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch health status
  const fetchHealthStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setApiHealth(data);
    } catch (err) {
      console.error('Error fetching health status:', err);
      setError(`Failed to fetch API health: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch build info
  const fetchBuildInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/build-info');
      if (!response.ok) {
        throw new Error(`Build info request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setBuildInfo(data);
    } catch (err) {
      console.error('Error fetching build info:', err);
      setError(`Failed to fetch build info: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to perform API connection test
  const testApiConnection = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoints = [
        { name: 'API Root', url: '/api' },
        { name: 'API Health', url: '/api/health' },
        { name: 'API Docs', url: '/api/docs' }
      ];

      const results = await Promise.all(
        endpoints.map(async (endpoint) => {
          try {
            const start = Date.now();
            const response = await fetch(endpoint.url);
            const responseTime = Date.now() - start;
            
            return {
              endpoint: endpoint.name,
              url: endpoint.url,
              status: response.status,
              ok: response.ok,
              responseTime: `${responseTime}ms`,
              contentType: response.headers.get('content-type')
            };
          } catch (err) {
            return {
              endpoint: endpoint.name,
              url: endpoint.url,
              status: 'Error',
              ok: false,
              error: err.message
            };
          }
        })
      );

      setConnectionTest({ timestamp: new Date().toISOString(), results });
    } catch (err) {
      console.error('Error testing API connections:', err);
      setError(`Failed to test API connections: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format bytes to human-readable form
  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get environment status badge
  const getEnvironmentBadge = (env) => {
    if (!env) return <Badge bg="secondary">Unknown</Badge>;
    
    if (env === 'production') {
      return <Badge bg="success">Production</Badge>;
    } else if (env === 'development') {
      return <Badge bg="info">Development</Badge>;
    } else if (env.includes('Vercel')) {
      return <Badge bg="primary">Vercel</Badge>;
    } else {
      return <Badge bg="secondary">{env}</Badge>;
    }
  };

  // Determine connection status badge
  const getConnectionBadge = (ok) => {
    return ok ? 
      <Badge bg="success">Successful</Badge> : 
      <Badge bg="danger">Failed</Badge>;
  };

  // Run checks on initial load
  useEffect(() => {
    const runInitialChecks = async () => {
      await fetchHealthStatus();
      await fetchBuildInfo();
      await testApiConnection();
    };
    
    runInitialChecks();
  }, []);

  return (
    <Container className="py-4">
      <h1 className="mb-4">System Diagnostics</h1>
      
      <Row className="mb-3">
        <Col md={4}>
          <Button 
            variant="primary" 
            onClick={fetchHealthStatus} 
            disabled={isLoading}
            className="me-2 mb-2"
          >
            {isLoading ? <><Spinner animation="border" size="sm" /> Checking...</> : 'Check API Health'}
          </Button>
          
          <Button 
            variant="info" 
            onClick={fetchBuildInfo}
            disabled={isLoading}
            className="me-2 mb-2"
          >
            {isLoading ? <><Spinner animation="border" size="sm" /> Loading...</> : 'Check Build Info'}
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={testApiConnection}
            disabled={isLoading}
            className="me-2 mb-2"
          >
            {isLoading ? <><Spinner animation="border" size="sm" /> Testing...</> : 'Test API Connection'}
          </Button>
        </Col>
      </Row>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}

      {apiHealth && (
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">API Health Status</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Table striped bordered>
                  <tbody>
                    <tr>
                      <th>Status</th>
                      <td>
                        {apiHealth.status === 'healthy' ? 
                          <Badge bg="success">Healthy</Badge> : 
                          <Badge bg="danger">Unhealthy</Badge>}
                      </td>
                    </tr>
                    <tr>
                      <th>Environment</th>
                      <td>{getEnvironmentBadge(apiHealth.environment?.env)}</td>
                    </tr>
                    <tr>
                      <th>Node Version</th>
                      <td>{apiHealth.environment?.node_version || 'Unknown'}</td>
                    </tr>
                    <tr>
                      <th>Platform</th>
                      <td>{apiHealth.environment?.platform || 'Unknown'}</td>
                    </tr>
                    <tr>
                      <th>Function Timeout</th>
                      <td>{apiHealth.environment?.function_timeout || 'Unknown'}</td>
                    </tr>
                    <tr>
                      <th>Request Time</th>
                      <td>{apiHealth.time || 'Unknown'}</td>
                    </tr>
                    <tr>
                      <th>Uptime</th>
                      <td>{apiHealth.uptime ? `${apiHealth.uptime.toFixed(2)} seconds` : 'Unknown'}</td>
                    </tr>
                  </tbody>
                </Table>
              </Col>
              <Col md={6}>
                <h6>Memory Usage</h6>
                <Table striped bordered>
                  <tbody>
                    {apiHealth.memory && Object.keys(apiHealth.memory).map(key => (
                      <tr key={key}>
                        <th>{key.replace('_', ' ').toUpperCase()}</th>
                        <td>{apiHealth.memory[key]}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                
                <h6 className="mt-3">Request Details</h6>
                <Table striped bordered>
                  <tbody>
                    {apiHealth.request && Object.keys(apiHealth.request).map(key => (
                      <tr key={key}>
                        <th>{key.replace('_', ' ').toUpperCase()}</th>
                        <td>{apiHealth.request[key] || 'Not available'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {buildInfo && (
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">Build Information</h5>
          </Card.Header>
          <Card.Body>
            <Table striped bordered>
              <tbody>
                <tr>
                  <th>API Status</th>
                  <td>{buildInfo.api_status || 'Unknown'}</td>
                </tr>
                <tr>
                  <th>Node Version</th>
                  <td>{buildInfo.node_version || 'Unknown'}</td>
                </tr>
                <tr>
                  <th>Environment</th>
                  <td>{getEnvironmentBadge(buildInfo.environment)}</td>
                </tr>
                <tr>
                  <th>Vercel Deployment</th>
                  <td>{buildInfo.vercel ? 'Yes' : 'No'}</td>
                </tr>
                <tr>
                  <th>Build Timestamp</th>
                  <td>{buildInfo.timestamp || 'Unknown'}</td>
                </tr>
                <tr>
                  <th>Dist Directory</th>
                  <td>{buildInfo.dist_exists ? 
                    <Badge bg="success">Found</Badge> : 
                    <Badge bg="danger">Not Found</Badge>}
                  </td>
                </tr>
              </tbody>
            </Table>
            
            {buildInfo.files && buildInfo.files.length > 0 && (
              <>
                <h6 className="mt-3">Dist Directory Files</h6>
                <Table striped bordered responsive>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildInfo.files.map((file, index) => (
                      <tr key={index}>
                        <td>{file.name}</td>
                        <td>{file.is_directory ? 'Directory' : 'File'}</td>
                        <td>{file.is_directory ? '-' : formatBytes(file.size)}</td>
                        <td>{new Date(file.modified).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}
            
            {buildInfo.error && (
              <Alert variant="danger" className="mt-3">
                <strong>Error accessing build files:</strong> {buildInfo.error.message}
              </Alert>
            )}
          </Card.Body>
        </Card>
      )}

      {connectionTest && (
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">API Connection Test</h5>
          </Card.Header>
          <Card.Body>
            <p>Timestamp: {connectionTest.timestamp}</p>
            
            <Table striped bordered>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Response Time</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {connectionTest.results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.endpoint}</td>
                    <td><code>{result.url}</code></td>
                    <td>{result.status}</td>
                    <td>{result.responseTime || 'N/A'}</td>
                    <td>{getConnectionBadge(result.ok)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
      
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Troubleshooting Guide</h5>
        </Card.Header>
        <Card.Body>
          <h6>Common Vercel Deployment Issues</h6>
          <Table striped bordered>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Possible Causes</th>
                <th>Solutions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>API Timeout</td>
                <td>Serverless function timeout (default is 10s)</td>
                <td>
                  <ul className="mb-0">
                    <li>Update maxDuration in vercel.json (currently set to 15s)</li>
                    <li>Optimize API calls to reduce response time</li>
                    <li>Implement pagination for large datasets</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td>CORS Errors</td>
                <td>Cross-origin request issues in production</td>
                <td>
                  <ul className="mb-0">
                    <li>Check CORS configuration in the API</li>
                    <li>Verify Vercel project settings for allowed origins</li>
                    <li>Use relative API URLs in production</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td>Build Failures</td>
                <td>Static build process not completing properly</td>
                <td>
                  <ul className="mb-0">
                    <li>Check build output for errors</li>
                    <li>Verify build command in vercel.json</li>
                    <li>Check for missing dependencies</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td>API Not Found</td>
                <td>API routes not configured correctly</td>
                <td>
                  <ul className="mb-0">
                    <li>Verify routes configuration in vercel.json</li>
                    <li>Check API path prefixes</li>
                    <li>Test API endpoints individually</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td>Memory Limit Exceeded</td>
                <td>Serverless function exceeding memory limits</td>
                <td>
                  <ul className="mb-0">
                    <li>Optimize memory usage in API calls</li>
                    <li>Break down large operations into smaller chunks</li>
                    <li>Implement pagination and lazy loading</li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default DiagnosticPage;