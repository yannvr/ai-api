const corsMiddleware = (req, res, next) => {
  const referrer = req.headers.referer || req.headers.referrer;
  const specialHeader = req.headers['x-api-key'];

  // Allow CORS for specific origins
  const allowedOrigins = ['https://dreamcatcher.run', 'http://localhost:9000', 'http://localhost:9300', '*'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Check if the referrer is 'dreamcatcher.run' or the special header is present
  // if (
  //   !referrer?.includes('dreamcatcher.run') &&
  //   specialHeader !== '0x1eb4aC0CD307aB4c7dB6c25a78029E035670ac95'
  // ) {
  //   return next(({ statusCode: 403, statusMessage: 'Forbidden' }));
  // }

  next();
};

export default corsMiddleware;
