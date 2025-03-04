const axios = require('axios');
const moment = require('moment');

// Helper function to calculate date range based on selected time range
function calculateDateRange(timeRange) {
  const endDate = moment();
  let startDate;
  
  switch (timeRange) {
    case 'day':
      startDate = moment().subtract(1, 'days');
      break;
    case 'week':
      startDate = moment().subtract(1, 'weeks');
      break;
    case 'month':
      startDate = moment().subtract(1, 'months');
      break;
    case 'year':
      startDate = moment().subtract(1, 'years');
      break;
    default:
      startDate = moment().subtract(1, 'months');
  }
  
  return {
    startDate: startDate.format('YYYY-MM-DD'),
    endDate: endDate.format('YYYY-MM-DD')
  };
}

// Function to fetch projects from GitLab
async function fetchProjects(gitlabUrl, token, namespace = '', tokenType = 'personal') {
  try {
    let params = {
      membership: true,
      per_page: 100
    };
    
    // If namespace is provided, add it to the query
    if (namespace) {
      params.namespace = namespace;
    }
    
    console.log(`Making request to: ${gitlabUrl}/api/v4/projects with params:`, params);
    
    const headers = tokenType === 'oauth' 
      ? { 'Authorization': `Bearer ${token}` }
      : { 'PRIVATE-TOKEN': token };
    
    const response = await axios.get(`${gitlabUrl}/api/v4/projects`, {
      headers,
      params
    });
    
    // Make sure we're returning an array
    if (!Array.isArray(response.data)) {
      console.log('Projects response is not an array:', response.data);
      return Array.isArray(response.data.projects) ? response.data.projects : [];
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
}

// Function to fetch pipelines for multiple projects
async function fetchPipelinesForProjects(gitlabUrl, token, projects, startDate, endDate) {
  // Ensure projects is an array and has content
  if (!Array.isArray(projects)) {
    console.error('Projects is not an array:', typeof projects, projects);
    return [];
  }
  
  // Make a safe copy of the projects array and ensure each item has an id
  const validProjects = projects.filter(project => project && project.id);
  
  console.log(`Processing ${validProjects.length} valid projects out of ${projects.length} total`);
  
  if (validProjects.length === 0) {
    console.error('No valid projects with IDs found');
    return [];
  }
  
  const pipelinesPromises = validProjects.map(project => 
    fetchPipelinesForProject(gitlabUrl, token, project.id, startDate, endDate)
  );
  
  return Promise.all(pipelinesPromises);
}

// Function to fetch pipelines for a single project
async function fetchPipelinesForProject(gitlabUrl, token, projectId, startDate, endDate) {
  try {
    console.log(`Fetching pipelines for project ${projectId}`);
    
    // First, get the project details to get the name
    const projectResponse = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}`, {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });
    
    const projectName = projectResponse.data.name || `Project ${projectId}`;
    
    const response = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}/pipelines`, {
      headers: {
        'PRIVATE-TOKEN': token
      },
      params: {
        updated_after: startDate,
        updated_before: endDate,
        per_page: 100
      }
    });
    
    // Get details for each pipeline to calculate duration
    const pipelineDetails = await Promise.all(
      response.data.map(pipeline => 
        fetchPipelineDetails(gitlabUrl, token, projectId, pipeline.id)
      )
    );
    
    // Filter out null values (failed requests)
    const validPipelines = pipelineDetails.filter(p => p !== null);
    
    return {
      projectId,
      projectName,
      pipelines: validPipelines
    };
  } catch (error) {
    console.error(`Error fetching pipelines for project ${projectId}:`, error);
    return {
      projectId,
      projectName: `Project ${projectId}`,
      pipelines: []
    };
  }
}

// Function to fetch details for a single pipeline
async function fetchPipelineDetails(gitlabUrl, token, projectId, pipelineId) {
  try {
    const response = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}/pipelines/${pipelineId}`, {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });
    
    // Fetch the jobs for this pipeline to calculate total CI minutes
    const jobsResponse = await axios.get(`${gitlabUrl}/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`, {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });
    
    // Calculate the total duration of all jobs
    const totalDurationMinutes = jobsResponse.data.reduce((total, job) => {
      // Duration is in seconds, convert to minutes
      return total + (job.duration ? job.duration / 60 : 0);
    }, 0);
    
    return {
      ...response.data,
      totalDurationMinutes
    };
  } catch (error) {
    console.error(`Error fetching details for pipeline ${pipelineId}:`, error);
    return null;
  }
}

// Function to process and aggregate CI metrics
function processCIMetrics(pipelinesData, timeRange) {
  // Initialize metrics object
  const metrics = {
    totalBuilds: 0,
    totalMinutes: 0,
    buildsPerProject: [],
    minutesPerProject: [],
    buildsByStatus: {
      success: 0,
      failed: 0,
      canceled: 0,
      running: 0,
      pending: 0,
      other: 0
    },
    timeSeriesData: []
  };
  
  // Process data for each project
  pipelinesData.forEach(projectData => {
    if (!projectData.pipelines || projectData.pipelines.length === 0) {
      return;
    }
    
    // Store the project name from the first pipeline if available
    const projectName = projectData.projectName || `Project ${projectData.projectId}`;
    
    const projectMetrics = {
      projectId: projectData.projectId,
      projectName: projectName,
      buildCount: 0,
      totalMinutes: 0
    };
    
    // Process each pipeline
    projectData.pipelines.forEach(pipeline => {
      if (!pipeline) return;
      
      metrics.totalBuilds++;
      projectMetrics.buildCount++;
      
      // Add duration to total minutes
      const durationMinutes = pipeline.totalDurationMinutes || 0;
      metrics.totalMinutes += durationMinutes;
      projectMetrics.totalMinutes += durationMinutes;
      
      // Count builds by status
      const status = pipeline.status || 'other';
      if (metrics.buildsByStatus[status] !== undefined) {
        metrics.buildsByStatus[status]++;
      } else {
        metrics.buildsByStatus.other++;
      }
      
      // Add to time series data
      const pipelineDate = moment(pipeline.created_at).format('YYYY-MM-DD');
      const existingDateEntry = metrics.timeSeriesData.find(entry => entry.date === pipelineDate);
      
      if (existingDateEntry) {
        existingDateEntry.buildCount++;
        existingDateEntry.minutes += durationMinutes;
      } else {
        metrics.timeSeriesData.push({
          date: pipelineDate,
          buildCount: 1,
          minutes: durationMinutes
        });
      }
    });
    
    // Add project metrics to the overall metrics
    metrics.buildsPerProject.push({
      projectId: projectData.projectId,
      projectName: projectMetrics.projectName,
      buildCount: projectMetrics.buildCount
    });
    
    metrics.minutesPerProject.push({
      projectId: projectData.projectId,
      projectName: projectMetrics.projectName,
      totalMinutes: projectMetrics.totalMinutes
    });
  });
  
  // Sort time series data by date
  metrics.timeSeriesData.sort((a, b) => moment(a.date).diff(moment(b.date)));
  
  // Group time series data based on the selected time range
  metrics.timeSeriesData = groupTimeSeriesData(metrics.timeSeriesData, timeRange);
  
  return metrics;
}

// Function to group time series data based on time range
function groupTimeSeriesData(timeSeriesData, timeRange) {
  if (timeRange === 'day') {
    // For day view, group by hour
    return timeSeriesData;
  }
  
  const groupedData = [];
  const format = timeRange === 'week' ? 'YYYY-MM-DD' : 
                 timeRange === 'month' ? 'YYYY-MM-DD' : 
                 'YYYY-MM';
  
  timeSeriesData.forEach(entry => {
    const period = moment(entry.date).format(format);
    const existingEntry = groupedData.find(item => item.period === period);
    
    if (existingEntry) {
      existingEntry.buildCount += entry.buildCount;
      existingEntry.minutes += entry.minutes;
    } else {
      groupedData.push({
        period,
        buildCount: entry.buildCount,
        minutes: entry.minutes
      });
    }
  });
  
  return groupedData;
}

// Update the function to make GitLab API requests with proper Authorization headers
async function makeGitLabRequest(url, session, params = {}) {
  const headers = {};
  
  // Determine what type of authentication to use
  if (session.token) {
    if (session.tokenType === 'oauth') {
      headers['Authorization'] = `Bearer ${session.token}`;
    } else {
      headers['PRIVATE-TOKEN'] = session.token;
    }
  }
  
  return axios.get(url, { headers, params });
}

module.exports = {
  calculateDateRange,
  fetchProjects,
  fetchPipelinesForProjects,
  fetchPipelinesForProject,
  fetchPipelineDetails,
  processCIMetrics,
  groupTimeSeriesData,
  makeGitLabRequest
};