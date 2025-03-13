import React, { useState, useEffect } from 'react';
import { Container, Spinner, Alert } from 'react-bootstrap';
import GitLabForm from './components/GitLabForm';
import ResultsSection from './components/ResultsSection';
import AlertMessages from './components/AlertMessages';
import Navigation from './components/Navigation';
import DiagnosticPage from './pages/DiagnosticPage';
import { gitlabApi } from './utils/api';

const App = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [apiStatus, setApiStatus] = useState('unknown');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Handle navigation
  useEffect(() => {
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // Add event listener for path changes
    window.addEventListener('popstate', handleNavigation);
    
    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  // Check API connectivity on load
  useEffect(() => {
    fetch('/api/health')
      .then(response => {
        if (response.ok) {
          setApiStatus('connected');
        } else {
          setApiStatus('error');
          addAlert('warning', 'Unable to connect to the API backend');
        }
      })
      .catch(error => {
        console.error('API health check failed:', error);
        setApiStatus('error');
        addAlert('danger', `API connection error: ${error.message}`);
      });
  }, []);

  const handleFetchMetrics = async (formData) => {
    setLoading(true);
    setAlerts([]);
    
    try {
      console.log('Fetching CI metrics with:', {
        ...formData,
        personalAccessToken: formData.personalAccessToken ? '[MASKED]' : undefined
      });
      
      // Use our API client instead of fetch directly
      const data = await gitlabApi.fetchCIMetrics(formData);
      
      console.log('CI metrics received:', data);
      setMetrics(data);
      setTimeRange(formData.timeRange);
    } catch (error) {
      setAlerts([{ type: 'danger', message: `Error: ${error.message}`, id: Date.now() }]);
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAlert = (type, message) => {
    setAlerts(prev => [...prev, { type, message, id: Date.now() }]);
  };

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  // Custom navigation handler
  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Render content based on the current path
  const renderContent = () => {
    if (currentPath === '/diagnostics') {
      return <DiagnosticPage />;
    }
    
    // Default to dashboard
    return (
      <>
        <GitLabForm 
          onSubmit={handleFetchMetrics} 
          addAlert={addAlert}
          apiStatus={apiStatus}
        />
        
        <AlertMessages 
          alerts={alerts} 
          onDismiss={removeAlert} 
        />
        
        {loading && (
          <div className="d-flex justify-content-center my-5">
            <Spinner animation="border" role="status" variant="primary">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        )}
        
        {metrics && !loading && (
          <ResultsSection 
            metrics={metrics} 
            timeRange={timeRange} 
          />
        )}
      </>
    );
  };

  return (
    <>
      <Navigation 
        apiStatus={apiStatus} 
        navigateTo={navigateTo}
        currentPath={currentPath}
      />
      
      <Container>
        {apiStatus === 'error' && currentPath !== '/diagnostics' && (
          <Alert variant="danger">
            <Alert.Heading>API Connection Issue</Alert.Heading>
            <p>
              There seems to be a problem connecting to the backend API. 
              This might be due to network issues or the API server being down.
            </p>
            <hr />
            <p className="mb-0">
              Try refreshing the page or visit the <Alert.Link onClick={() => navigateTo('/diagnostics')}>System Diagnostics</Alert.Link> page to troubleshoot.
            </p>
          </Alert>
        )}
        
        {renderContent()}
      </Container>
    </>
  );
};

export default App;