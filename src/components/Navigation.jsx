import React from 'react';
import { Navbar, Nav, Container, Badge } from 'react-bootstrap';

const Navigation = ({ apiStatus }) => {
  // Determine if current path matches a specific route
  const isActive = (path) => {
    return window.location.pathname === path;
  };
  
  // Get appropriate badge for API status
  const getApiStatusBadge = () => {
    switch(apiStatus) {
      case 'connected':
        return <Badge bg="success">API Connected</Badge>;
      case 'error':
        return <Badge bg="danger">API Error</Badge>;
      default:
        return <Badge bg="warning">API Status Unknown</Badge>;
    }
  };
  
  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand href="/">GitLab CI Analytics</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link 
              href="/" 
              active={isActive('/')}
            >
              Dashboard
            </Nav.Link>
            <Nav.Link 
              href="/diagnostics" 
              active={isActive('/diagnostics')}
            >
              System Diagnostics
            </Nav.Link>
          </Nav>
          <div className="d-flex align-items-center">
            <span className="text-light me-2">Status:</span>
            {getApiStatusBadge()}
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;