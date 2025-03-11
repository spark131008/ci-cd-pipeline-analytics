# CI/CD Pipeline Analytics

Web application to analyze GitLab CI build metrics with an Express backend and React frontend.

## Project Structure

This project uses a monorepo structure with both the Express backend and React frontend in the same repository.

```
ci-cd-pipeline-analytics/
├── api/                  # Backend Express code
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Express middleware
│   ├── routes/           # API route definitions
│   └── server.js         # Express server entry
├── src/                  # Frontend React code
│   ├── components/       # React components
│   ├── pages/            # Page components
│   └── ...               # Other frontend files
├── public/               # Public static files
├── tests/                # Test files
│   ├── backend/          # Backend tests
│   └── frontend/         # Frontend tests
└── ...                   # Config files
```

## Development

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

```bash
npm install
```

### Running the Application

You can run both the backend and frontend concurrently with:

```bash
npm run dev
```

This will start:
- Backend: Express server on http://localhost:3000
- Frontend: Vite dev server on http://localhost:3001

Or run them separately:

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

The frontend Vite server is configured to proxy API requests to the backend automatically.

### Testing

```bash
# Run all tests
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend
```

### Building for Production

```bash
npm run build
```

This builds the frontend into the `dist` directory, which is served by the Express backend.

## Deployment

For production deployment, build the frontend and then start the Express server:

```bash
npm run build
npm start
```

## Vercel Deployment

For Vercel deployment:

```bash
npm run dev:vercel
```
