import React, { useState, useEffect } from 'react';
import { Container, Spinner, Row, Col, Card, Button, Form, InputGroup } from 'react-bootstrap';
import GitLabForm from './components/GitLabFormRedesigned';
import ResultsSection from './components/ResultsSectionRedesigned';
import AlertMessages from './components/AlertMessages';
import { 
  FaGitlab, FaChartLine, FaSpinner, FaArrowLeft, FaSync, 
  FaCalendarAlt, FaUsers, FaLink, FaKey, FaFilter, 
  FaBars, FaTimes, FaCog
} from 'react-icons/fa';

function App() {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [isDashboardView, setIsDashboardView] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  
  // Store form data for sidebar
  const [sidebarFormData, setSidebarFormData] = useState({
    gitlabUrl: '',
    personalAccessToken: '',
    namespace: '',
    timeRange: 'month',
    authMethod: 'pat',
    samlSessionId: null
  });
  
  // Store namespace options
  const [namespaceOptions, setNamespaceOptions] = useState([]);
  
  // Initialize sidebarFormData with default values
  useEffect(() => {
    console.log('App component mounted, initializing sidebarFormData');
    setSidebarFormData(prev => ({
      ...prev,
      authMethod: 'pat'
    }));
  }, []);

  const handleFetchMetrics = async (formData) => {
    setLoading(true);
    setAlerts([]);
    
    try {
      const response = await fetch('/api/gitlab/fetch-ci-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch CI metrics');
      }
      
      const data = await response.json();
      setMetrics(data);
      setTimeRange(formData.timeRange);
      
      // Store form data for sidebar
      setSidebarFormData({
        gitlabUrl: formData.gitlabUrl,
        personalAccessToken: formData.personalAccessToken,
        namespace: formData.namespace,
        timeRange: formData.timeRange,
        authMethod: formData.authMethod || 'pat',
        samlSessionId: formData.samlSessionId
      });
      
      // If we have namespace info in the response, store it for the sidebar
      if (data.namespaceOptions) {
        setNamespaceOptions(data.namespaceOptions);
      }
      
      // Switch to dashboard view
      setIsDashboardView(true);
      
      // Scroll to top when showing dashboard
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      return data; // Return data for the form component to know submission was successful
    } catch (error) {
      // Create a more detailed error message
      const errorDetails = `Error: ${error.message}. Form data: ${JSON.stringify({
        gitlabUrl: formData.gitlabUrl,
        authMethod: formData.authMethod,
        namespace: formData.namespace,
        timeRange: formData.timeRange,
        hasToken: !!formData.personalAccessToken,
        hasSamlSession: !!formData.samlSessionId
      })}`;
      
      console.error('Error fetching metrics:', errorDetails);
      setAlerts([{ 
        type: 'danger', 
        message: `Error: ${error.message}. Please check console for details.`, 
        id: Date.now() 
      }]);
      
      throw error; // Re-throw to let the form component know submission failed
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

  const handleBackToForm = () => {
    setIsDashboardView(false);
  };
  
  const handleSidebarSubmit = async (e) => {
    e.preventDefault();
    
    // Log the form data being submitted for debugging
    console.log('Submitting form data:', sidebarFormData);
    
    // Ensure authMethod is included
    const formDataToSubmit = {
      ...sidebarFormData,
      authMethod: sidebarFormData.authMethod || 'pat'
    };
    
    await handleFetchMetrics(formDataToSubmit);
    
    // Hide sidebar on mobile after submission
    if (window.innerWidth < 992) {
      setIsSidebarVisible(false);
    }
  };
  
  const handleSidebarInputChange = (field, value) => {
    setSidebarFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const toggleSidebar = () => {
    setIsSidebarVisible(prev => !prev);
  };

  return (
    <div className="app-background">
      {isDashboardView && metrics ? (
        // Dashboard View with Sidebar
        <div className="dashboard-layout">
          {/* Mobile Sidebar Toggle */}
          <button 
            className={`sidebar-toggle-btn ${isSidebarVisible ? 'active' : ''}`}
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            {isSidebarVisible ? <FaTimes /> : <FaCog />}
          </button>
          
          {/* Sidebar */}
          <div className={`dashboard-sidebar ${isSidebarVisible ? 'visible' : 'hidden'}`}>
            <div className="sidebar-header">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <FaGitlab size={24} className="text-primary me-2" />
                  <h5 className="mb-0">GitLab CI Analytics</h5>
                </div>
                <button 
                  className="sidebar-close-btn d-lg-none" 
                  onClick={toggleSidebar}
                  aria-label="Close sidebar"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="sidebar-divider"></div>
            </div>
            
            <div className="sidebar-content">
              <Form onSubmit={handleSidebarSubmit}>
                <div className="sidebar-section">
                  <div className="section-title">
                    <FaLink className="me-2" />
                    <span>Connection</span>
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="small">GitLab URL</Form.Label>
                    <Form.Control 
                      type="text" 
                      size="sm"
                      value={sidebarFormData.gitlabUrl}
                      onChange={(e) => handleSidebarInputChange('gitlabUrl', e.target.value)}
                      disabled
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="small">Authentication</Form.Label>
                    <Form.Control 
                      type="text" 
                      size="sm"
                      value={sidebarFormData.authMethod === 'pat' ? 'Personal Access Token' : 'SAML Authentication'}
                      disabled
                    />
                  </Form.Group>
                  
                  {sidebarFormData.authMethod === 'pat' && (
                    <Form.Group className="mb-3">
                      <Form.Label className="small">Access Token</Form.Label>
                      <Form.Control 
                        type="password" 
                        size="sm"
                        value={sidebarFormData.personalAccessToken}
                        onChange={(e) => handleSidebarInputChange('personalAccessToken', e.target.value)}
                        disabled
                      />
                    </Form.Group>
                  )}
                </div>
                
                <div className="sidebar-section">
                  <div className="section-title">
                    <FaFilter className="me-2" />
                    <span>Filters</span>
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="small">Group/Namespace</Form.Label>
                    <Form.Select
                      size="sm"
                      value={sidebarFormData.namespace}
                      onChange={(e) => handleSidebarInputChange('namespace', e.target.value)}
                    >
                      <option value={sidebarFormData.namespace}>
                        {metrics.namespaceInfo?.name || sidebarFormData.namespace}
                      </option>
                    </Form.Select>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="small">Time Range</Form.Label>
                    <Form.Select
                      size="sm"
                      value={sidebarFormData.timeRange}
                      onChange={(e) => handleSidebarInputChange('timeRange', e.target.value)}
                    >
                      <option value="day">Last 24 Hours</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                      <option value="year">Last 12 Months</option>
                    </Form.Select>
                  </Form.Group>
                </div>
                
                <div className="sidebar-actions">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    size="sm" 
                    className="w-100 d-flex align-items-center justify-content-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <FaSync className="me-2" />
                        Update Dashboard
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="w-100 mt-2 d-flex align-items-center justify-content-center"
                    onClick={handleBackToForm}
                  >
                    <FaArrowLeft className="me-2" />
                    Back to Form
                  </Button>
                </div>
              </Form>
            </div>
          </div>
          
          {/* Main Dashboard Content */}
          <div className="dashboard-main">
            <div className="dashboard-header d-flex justify-content-between align-items-center mb-4">
              <div>
                <h1 className="mb-1">CI/CD Pipeline Analytics</h1>
                <p className="text-muted mb-0">
                  {metrics.namespaceInfo?.name || 'Group'} • {
                    timeRange === 'day' ? 'Last 24 Hours' : 
                    timeRange === 'week' ? 'Last 7 Days' : 
                    timeRange === 'month' ? 'Last 30 Days' : 'Last 12 Months'
                  }
                </p>
              </div>
              
              <AlertMessages 
                alerts={alerts} 
                onDismiss={removeAlert} 
                className="dashboard-alerts"
              />
            </div>
            
            <Card className="dashboard-card border-0 shadow-sm">
              <Card.Body>
                <ResultsSection 
                  metrics={metrics} 
                  timeRange={timeRange} 
                />
              </Card.Body>
            </Card>
          </div>
        </div>
      ) : (
        // Form View
        <Container className="py-4">
          <div className="text-center mb-5">
            <div className="d-flex align-items-center justify-content-center mb-2">
              <FaGitlab size={40} className="text-primary me-3" />
              <h1 className="display-4 mb-0">GitLab CI Analytics</h1>
            </div>
            <p className="text-muted lead">Visualize and analyze your CI/CD pipeline performance</p>
            <div className="badge bg-secondary">Development Mode - React + Express</div>
          </div>
          
          <Row>
            <Col>
              <GitLabForm 
                onSubmit={handleFetchMetrics} 
                addAlert={addAlert}
              />
              
              <AlertMessages 
                alerts={alerts} 
                onDismiss={removeAlert} 
              />
            </Col>
          </Row>
        </Container>
      )}
      
      {loading && (
        <div className="loading-overlay fade-in">
          <div className="loading-content">
            <FaSpinner size={40} className="text-primary spinner-icon" />
            <h3 className="mt-3">Fetching CI Metrics...</h3>
            <p className="text-muted">This may take a moment depending on the size of your GitLab group</p>
          </div>
        </div>
      )}

      <style jsx="true">{`
        .app-background {
          min-height: 100vh;
          background-color: #f8f9fa;
        }
        
        /* Dashboard Layout */
        .dashboard-layout {
          display: flex;
          min-height: 100vh;
          position: relative;
        }
        
        /* Sidebar Styles */
        .dashboard-sidebar {
          width: 280px;
          background-color: #fff;
          border-right: 1px solid rgba(0,0,0,0.1);
          height: 100vh;
          position: sticky;
          top: 0;
          overflow-y: auto;
          z-index: 10;
          box-shadow: 0 0 15px rgba(0,0,0,0.05);
          transition: transform 0.3s ease, opacity 0.3s ease;
        }
        
        .sidebar-header {
          padding: 1.5rem 1rem;
        }
        
        .sidebar-divider {
          height: 1px;
          background-color: rgba(0,0,0,0.1);
          margin: 1rem 0;
        }
        
        .sidebar-content {
          padding: 0 1rem 1.5rem;
        }
        
        .sidebar-section {
          margin-bottom: 1.5rem;
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 1rem;
        }
        
        .section-title {
          display: flex;
          align-items: center;
          font-weight: 600;
          font-size: 0.9rem;
          color: #495057;
          margin-bottom: 0.75rem;
        }
        
        .sidebar-actions {
          padding: 0.5rem 0;
        }
        
        /* Sidebar toggle button */
        .sidebar-toggle-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background-color: #0d6efd;
          color: white;
          border: none;
          display: none;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          z-index: 100;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .sidebar-toggle-btn:hover {
          background-color: #0b5ed7;
        }
        
        .sidebar-toggle-btn.active {
          background-color: #dc3545;
        }
        
        .sidebar-toggle-btn.active:hover {
          background-color: #bb2d3b;
        }
        
        .sidebar-close-btn {
          background: none;
          border: none;
          color: #6c757d;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0;
        }
        
        /* Main Content Styles */
        .dashboard-main {
          flex: 1;
          padding: 2rem;
          overflow-x: hidden;
        }
        
        .dashboard-card {
          border-radius: 12px;
          overflow: hidden;
        }
        
        .dashboard-header h1 {
          font-size: 1.8rem;
          font-weight: 600;
        }
        
        .dashboard-alerts {
          max-width: 400px;
        }
        
        /* Loading Overlay */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .loading-content {
          text-align: center;
          background-color: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          max-width: 90%;
          width: 400px;
        }
        
        .spinner-icon {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        /* Responsive adjustments */
        @media (max-width: 992px) {
          .dashboard-layout {
            flex-direction: column;
          }
          
          .dashboard-sidebar {
            width: 100%;
            height: auto;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-right: none;
            z-index: 1000;
          }
          
          .dashboard-sidebar.hidden {
            transform: translateX(-100%);
            opacity: 0;
            pointer-events: none;
          }
          
          .dashboard-sidebar.visible {
            transform: translateX(0);
            opacity: 1;
            pointer-events: auto;
          }
          
          .sidebar-toggle-btn {
            display: flex;
          }
          
          .sidebar-content {
            padding-bottom: 2rem;
          }
          
          .dashboard-main {
            padding: 1.5rem;
            margin-top: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default App;