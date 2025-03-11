import React from 'react';
import { Alert } from 'react-bootstrap';

const AlertMessages = ({ alerts, onDismiss }) => {
  return (
    <div className="my-3">
      {alerts.map((alert) => (
        <Alert 
          key={alert.id} 
          variant={alert.type} 
          dismissible 
          onClose={() => onDismiss(alert.id)}
        >
          {alert.message}
        </Alert>
      ))}
    </div>
  );
};

export default AlertMessages;