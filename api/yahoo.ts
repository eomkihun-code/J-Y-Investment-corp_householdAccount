import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers (Optionally for local dev outside of Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/${path}`;
    const response = await fetch(yahooUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo API returned ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Yahoo Proxy Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
