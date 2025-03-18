import React, { useEffect, useRef } from 'react';
import { Card, Row, Col, Badge } from 'react-bootstrap';
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
import { FaChartBar, FaChartLine, FaChartPie, FaProjectDiagram, 
  FaRegClock, FaCheckCircle, FaExclamationTriangle, FaCode } from 'react-icons/fa';

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

function ResultsSection({ metrics, timeRange }) {
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
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 'flex',
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
        tension: 0.3,
        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
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
          'rgba(75, 192, 92, 0.8)', // success
          'rgba(255, 99, 132, 0.8)', // failed
          'rgba(255, 159, 64, 0.8)', // canceled
          'rgba(54, 162, 235, 0.8)', // running
          'rgba(201, 203, 207, 0.8)', // pending
          'rgba(153, 102, 255, 0.8)', // other
        ],
        borderColor: [
          'rgba(75, 192, 92, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(201, 203, 207, 1)',
          'rgba(153, 102, 255, 1)',
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
        backgroundColor: 'rgba(153, 102, 255, 0.7)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
        borderRadius: 4,
      }
    ]
  };

  // Chart options
  const buildsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 6
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          precision: 0
        },
        title: {
          display: true,
          text: 'Number of Builds',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        title: {
          display: true,
          text: getTimeLabel(timeRange),
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }
    }
  };

  const minutesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 6
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        title: {
          display: true,
          text: 'CI Minutes',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        title: {
          display: true,
          text: getTimeLabel(timeRange),
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }
    }
  };

  const statusChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 6
      }
    }
  };

  const projectsChartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 6
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        title: {
          display: true,
          text: 'CI Minutes',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  };

  // Get time range display text
  const getTimeRangeText = () => {
    switch (timeRange) {
      case 'day': return 'Last 24 Hours';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'year': return 'Last 12 Months';
      default: return 'Selected Period';
    }
  };

  // Get status color
  const getStatusColor = (rate) => {
    if (rate >= 90) return 'success';
    if (rate >= 75) return 'warning';
    return 'danger';
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header mb-4">
        <h2 className="mb-2">CI/CD Pipeline Analytics</h2>
        <div className="d-flex align-items-center">
          <Badge bg="primary" className="me-2 py-2 px-3">{getTimeRangeText()}</Badge>
          <span className="text-muted">Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* Summary Metrics */}
      <Row className="metrics-summary g-4 mb-4">
        <Col lg={3} md={6}>
          <Card className="metric-card h-100 border-0 shadow-sm">
            <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
              <div className="metric-icon mb-3 bg-primary-light">
                <FaCode />
              </div>
              <h3 className="metric-value">{totalBuilds.toLocaleString()}</h3>
              <p className="metric-label mb-0">Total Builds</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="metric-card h-100 border-0 shadow-sm">
            <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
              <div className="metric-icon mb-3 bg-info-light">
                <FaRegClock />
              </div>
              <h3 className="metric-value">{totalMinutes.toFixed(0)}</h3>
              <p className="metric-label mb-0">Total CI Minutes</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="metric-card h-100 border-0 shadow-sm">
            <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
              <div className="metric-icon mb-3 bg-warning-light">
                <FaExclamationTriangle />
              </div>
              <h3 className="metric-value">{avgMinutes.toFixed(1)}</h3>
              <p className="metric-label mb-0">Avg. Minutes/Build</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="metric-card h-100 border-0 shadow-sm">
            <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
              <div className={`metric-icon mb-3 bg-${getStatusColor(successRate)}-light`}>
                <FaCheckCircle />
              </div>
              <h3 className="metric-value">{successRate.toFixed(1)}%</h3>
              <p className="metric-label mb-0">Success Rate</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row className="g-4">
        <Col lg={6}>
          <Card className="chart-card h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-0 pt-4 pb-0 px-4">
              <div className="d-flex align-items-center">
                <FaChartBar className="text-primary me-2" size={18} />
                <h5 className="mb-0">Builds Over Time</h5>
              </div>
            </Card.Header>
            <Card.Body className="px-4 pb-4">
              <div style={{ height: '350px' }}>
                <Bar 
                  ref={buildsChartRef}
                  data={buildsChartData} 
                  options={buildsChartOptions} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="chart-card h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-0 pt-4 pb-0 px-4">
              <div className="d-flex align-items-center">
                <FaChartLine className="text-info me-2" size={18} />
                <h5 className="mb-0">CI Minutes Over Time</h5>
              </div>
            </Card.Header>
            <Card.Body className="px-4 pb-4">
              <div style={{ height: '350px' }}>
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

      <Row className="g-4 mt-1">
        <Col lg={6}>
          <Card className="chart-card h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-0 pt-4 pb-0 px-4">
              <div className="d-flex align-items-center">
                <FaChartPie className="text-success me-2" size={18} />
                <h5 className="mb-0">Builds by Status</h5>
              </div>
            </Card.Header>
            <Card.Body className="px-4 pb-4">
              <div style={{ height: '350px' }}>
                <Pie 
                  ref={statusChartRef}
                  data={statusChartData} 
                  options={statusChartOptions} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="chart-card h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-0 pt-4 pb-0 px-4">
              <div className="d-flex align-items-center">
                <FaProjectDiagram className="text-purple me-2" size={18} />
                <h5 className="mb-0">Top Projects by CI Usage</h5>
              </div>
            </Card.Header>
            <Card.Body className="px-4 pb-4">
              <div style={{ height: '350px' }}>
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

      {/* Add custom CSS for the dashboard */}
      <style jsx="true">{`
        .dashboard-container {
          padding: 0;
        }
        
        .dashboard-header {
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        
        .metric-card {
          border-radius: 12px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .metric-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }
        
        .metric-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        
        .bg-primary-light {
          background-color: rgba(13, 110, 253, 0.1);
          color: #0d6efd;
        }
        
        .bg-info-light {
          background-color: rgba(13, 202, 240, 0.1);
          color: #0dcaf0;
        }
        
        .bg-warning-light {
          background-color: rgba(255, 193, 7, 0.1);
          color: #ffc107;
        }
        
        .bg-success-light {
          background-color: rgba(25, 135, 84, 0.1);
          color: #198754;
        }
        
        .bg-danger-light {
          background-color: rgba(220, 53, 69, 0.1);
          color: #dc3545;
        }
        
        .metric-value {
          font-size: 2.2rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        
        .metric-label {
          color: #6c757d;
          font-size: 0.9rem;
        }
        
        .chart-card {
          border-radius: 12px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .chart-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }
        
        .text-purple {
          color: #6f42c1;
        }
        
        @media (max-width: 768px) {
          .metric-value {
            font-size: 1.5rem;
          }
          
          .metric-icon {
            width: 50px;
            height: 50px;
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default ResultsSection;
