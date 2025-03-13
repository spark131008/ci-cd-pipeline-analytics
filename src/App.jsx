import React, { useState } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import GitLabForm from './components/GitLabForm';
import ResultsSection from './components/ResultsSection';
import AlertMessages from './components/AlertMessages';
import { gitlabApi } from './utils/api';

const App = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [timeRange, setTimeRange] = useState('month');

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

  return (
    <Container>
      <h1 className="mb-4">GitLab CI Analytics</h1>
      <p className="text-muted">React + Express API</p>
      
      <GitLabForm 
        onSubmit={handleFetchMetrics} 
        addAlert={addAlert}
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
    </Container>
  );
};

export default App;