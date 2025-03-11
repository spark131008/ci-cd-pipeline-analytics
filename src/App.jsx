import React, { useState } from 'react';
import { Container } from 'react-bootstrap';
import GitLabForm from './components/GitLabForm';
import ResultsSection from './components/ResultsSection';
import AlertMessages from './components/AlertMessages';

const App = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [timeRange, setTimeRange] = useState('month');

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
    } catch (error) {
      setAlerts([{ type: 'danger', message: `Error: ${error.message}` }]);
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
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
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