# GitLab CI Analytics

A web application that provides analytics about GitLab CI builds and usage minutes across different time periods.

## Features

- Track build counts per day, week, month, and year
- Monitor CI minutes usage across time periods
- View build success/failure rates
- Identify projects consuming the most CI resources
- Visualize trends with interactive charts

## Security Considerations

This application requires a GitLab Personal Access Token with read access to repositories. For security:

- Tokens are only processed in-memory and never stored
- Use a token with minimal permissions (read_api scope is sufficient)
- Consider using environment variables rather than entering tokens in the UI
- Set up proper authentication for the application if hosted on a public server

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/gitlab-ci-analytics.git
   cd gitlab-ci-analytics
   ```

2. Install dependencies:
   ```
   npm install
   ```
   
3. Create a `.env` file in the project root:
   ```
   PORT=3000
   ```

4. Start the application:
   ```
   npm start
   ```

5. Access the application at http://localhost:3000

### GitLab Token Setup

1. Go to your GitLab account
2. Navigate to Settings > Access Tokens
3. Create a new token with `read_api` scope
4. Use this token in the application

## Usage

1. Enter your GitLab instance URL (e.g., https://gitlab.com)
2. Paste your Personal Access Token
3. Select a time range (day, week, month, year)
4. Click "Fetch CI Metrics" to see your analytics

## Docker Deployment

You can also run this application using Docker:

```bash
# Build the Docker image
docker build -t gitlab-ci-analytics .

# Run the container
docker run -p 3000:3000 -e PORT=3000 gitlab-ci-analytics