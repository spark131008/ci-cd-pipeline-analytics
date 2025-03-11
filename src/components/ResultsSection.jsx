import React, { useEffect, useRef } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const ResultsSection = ({ metrics, timeRange }) => {
  // Clean up chart instances on unmount
  const buildsChartRef = useRef(null);
  const minutesChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const projectsChartRef = useRef(null);

  useEffect(() => {
    // Cleanup function to destroy charts when component unmounts
    return () => {
      const charts = [
        buildsChartRef.current,
        minutesChartRef.current,
        statusChartRef.current,
        projectsChartRef.current
      ];
      
      charts.forEach(chart => {
        if (chart && chart.chartInstance) {
          chart.chartInstance.destroy();
        }
      });
    };
  }, []);

  // Calculate summary metrics
  const totalBuilds = metrics.totalBuilds || 0;
  const totalMinutes = metrics.totalMinutes || 0;
  const avgMinutes = totalBuilds > 0 ? totalMinutes / totalBuilds : 0;
  const successRate = totalBuilds > 0 
    ? (metrics.buildsByStatus.success / totalBuilds * 100) 
    : 0;

  // Helper function to get appropriate time label based on time range
  const getTimeLabel = (timeRange) => {
    switch (timeRange) {
      case 'day': return 'Hours';
      case 'week': return 'Days';
      case 'month': return 'Days';
      case 'year': return 'Months';
      default: return 'Time Period';
    }
  };

  // Prepare chart data
  const timeSeriesLabels = metrics.timeSeriesData.map(item => item.period || item.date);
  
  // Builds chart data
  const buildsChartData = {
    labels: timeSeriesLabels,
    datasets: [
      {
        label: 'Build Count',
        data: metrics.timeSeriesData.map(item => item.buildCount),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      }
    ]
  };

  // Minutes chart data
  const minutesChartData = {
    labels: timeSeriesLabels,
    datasets: [
      {
        label: 'CI Minutes',
        data: metrics.timeSeriesData.map(item => item.minutes),
        fill: true,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        tension: 0.1,
      }
    ]
  };

  // Status chart data
  const statusLabels = Object.keys(metrics.buildsByStatus).map(
    label => label.charAt(0).toUpperCase() + label.slice(1)
  );
  
  const statusChartData = {
    labels: statusLabels,
    datasets: [
      {
        label: 'Builds by Status',
        data: Object.values(metrics.buildsByStatus),
        backgroundColor: [
          'rgba(75, 192, 92, 0.7)', // success
          'rgba(255, 99, 132, 0.7)', // failed
          'rgba(255, 159, 64, 0.7)', // canceled
          'rgba(54, 162, 235, 0.7)', // running
          'rgba(201, 203, 207, 0.7)', // pending
          'rgba(153, 102, 255, 0.7)', // other
        ],
        borderWidth: 1,
      }
    ]
  };

  // Top projects chart data
  const topProjects = [...metrics.minutesPerProject]
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 5);
  
  const projectsChartData = {
    labels: topProjects.map(project => project.projectName || `Project ${project.projectId}`),
    datasets: [
      {
        label: 'CI Minutes',
        data: topProjects.map(project => project.totalMinutes),
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      }
    ]
  };

  // Chart options
  const buildsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Builds'
        }
      },
      x: {
        title: {
          display: true,
          text: getTimeLabel(timeRange)
        }
      }
    }
  };

  const minutesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'CI Minutes'
        }
      },
      x: {
        title: {
          display: true,
          text: getTimeLabel(timeRange)
        }
      }
    }
  };

  const statusChartOptions = {
    responsive: true,
    maintainAspectRatio: false
  };

  const projectsChartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'CI Minutes'
        }
      }
    }
  };

  return (
    <div>
      {/* Summary Metrics */}
      <Row className="metrics-summary">
        <Col md={3}>
          <Card bg="light">
            <Card.Body className="text-center">
              <h5 className="card-title">Total Builds</h5>
              <h2>{totalBuilds.toLocaleString()}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="light">
            <Card.Body className="text-center">
              <h5 className="card-title">Total CI Minutes</h5>
              <h2>{totalMinutes.toFixed(2)}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="light">
            <Card.Body className="text-center">
              <h5 className="card-title">Avg. Minutes/Build</h5>
              <h2>{avgMinutes.toFixed(2)}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="light">
            <Card.Body className="text-center">
              <h5 className="card-title">Success Rate</h5>
              <h2>{successRate.toFixed(1)}%</h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Builds Over Time</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px' }}>
                <Bar 
                  ref={buildsChartRef}
                  data={buildsChartData} 
                  options={buildsChartOptions} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">CI Minutes Over Time</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px' }}>
                <Line 
                  ref={minutesChartRef}
                  data={minutesChartData} 
                  options={minutesChartOptions} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Builds by Status</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px' }}>
                <Pie 
                  ref={statusChartRef}
                  data={statusChartData} 
                  options={statusChartOptions} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Top Projects by CI Usage</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px' }}>
                <Bar 
                  ref={projectsChartRef}
                  data={projectsChartData} 
                  options={projectsChartOptions} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ResultsSection;
