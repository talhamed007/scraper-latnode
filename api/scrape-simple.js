export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // For now, return a mock response to test the API
    // This will be replaced with actual scraping logic
    const mockData = {
      ok: true,
      data: {
        rawText: "Credits left: 150/200\nPlug & Play Tokens: 10/15",
        credits_used: "50",
        credits_total: "200",
        credits_left: "150",
        plugAndPlay_used: "5",
        plugAndPlay_total: "15",
        plugAndPlay_left: "10",
        screenshotBase64: null
      }
    };

    res.status(200).json(mockData);

  } catch (error) {
    console.error('Scraping error:', error);
    
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
