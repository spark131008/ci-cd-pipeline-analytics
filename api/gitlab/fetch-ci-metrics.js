// api/gitlab/fetch-ci-metrics.js
const { getSession } = require('../../utils/auth');
const { 
  fetchProjects, 
  calculateDateRange,
  fetchPipelinesForProjects,
  processCIMetrics
} = require('../../utils/gitlab');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { gitlabUrl, authMethod, personalAccessToken, timeRange, namespace } = req.body;
    
    // Focus only on PAT authentication for now
    if (authMethod !== 'pat') {
      return res.status(400).json({ error: 'Only Personal Access Token authentication is supported' });
    }
    
    let token = personalAccessToken;

    // Clean up the GitLab URL
    if (gitlabUrl) {
      const urlObj = new URL(gitlabUrl);
      gitlabUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
    
    if (!gitlabUrl || !token) {
      return res.status(400).json({ error: 'GitLab URL and token required' });
    }

    const dateRange = calculateDateRange(timeRange);
    const projects = await fetchProjects(gitlabUrl, token, namespace);
    const projectsArray = Array.isArray(projects) ? projects : [];
    
    if (projectsArray.length === 0) {
      return res.status(404).json({ error: 'No projects found' });
    }
    
    const pipelinesData = await fetchPipelinesForProjects(
      gitlabUrl, 
      token, 
      projectsArray, 
      dateRange.startDate, 
      dateRange.endDate
    );
    
    const metrics = processCIMetrics(pipelinesData, timeRange);
    res.json(metrics);
  } catch (error) {
    console.error('Error in fetch-ci-metrics handler:', error);
    res.status(500).json({ 
      error: 'Failed to fetch CI metrics', 
      details: error.message 
    });
  }
}