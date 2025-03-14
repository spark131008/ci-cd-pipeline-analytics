import React from 'react';
import { Alert } from 'react-bootstrap';

function AlertMessages({ alerts, onDismiss, className = '' }) {
  if (alerts.length === 0) return null;
  
  return (
    <div className={`alert-container ${className}`}>
      {alerts.map((alert) => (
        <Alert 
          key={alert.id} 
          variant={alert.type} 
          dismissible 
          onClose={() => onDismiss(alert.id)}
          className="mb-2"
        >
          {alert.message}
        </Alert>
      ))}
    </div>
  );
}

export default AlertMessages;