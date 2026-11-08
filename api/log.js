/**
 * Vercel Serverless Function: Frontend Log Drain (/api/log)
 * Captures all client-side browser logs, exceptions, unhandled rejections,
 * user interactions, and telemetry, and outputs them to the Vercel Dashboard Logs.
 */
export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = { message: body };
      }
    }

    const {
      level = 'info',
      event = 'TELEMETRY',
      message = '',
      details = {},
      url = '/',
      userAgent = 'Unknown',
      timestamp = new Date().toISOString()
    } = body || {};

    const levelUpper = String(level).toUpperCase();
    const formatted = `[CLIENT-${levelUpper}] [${event}] ${message} | Route: ${url} | Details: ${JSON.stringify(details)}`;

    // Output to Vercel Runtime Logs Console
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    return res.status(200).json({ status: 'logged', timestamp });
  }

  // Health check / GET status
  return res.status(200).json({
    status: 'online',
    service: 'NISAR Frontend Telemetry Logger',
    runtime: 'Vercel Serverless Node.js',
    timestamp: new Date().toISOString()
  });
}
