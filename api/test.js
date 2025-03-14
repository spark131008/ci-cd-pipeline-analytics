module.exports = (req, res) => {
    res.status(200).json({ 
      message: 'API is working',
      environment: process.env.VERCEL ? 'Vercel' : 'Local',
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  };