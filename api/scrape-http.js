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
    // Use a different approach - HTTP requests instead of browser automation
    const fetch = require('node-fetch');
    
    // Step 1: Get the login page to extract CSRF tokens
    const loginPageResponse = await fetch('https://app.latenode.com/auth', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const loginPageHtml = await loginPageResponse.text();
    
    // Extract any CSRF tokens or form data needed
    const csrfMatch = loginPageHtml.match(/name="csrf[^"]*"\s+value="([^"]+)"/i);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    // Step 2: Attempt login (this is a simplified approach)
    // Note: This may not work if Latenode has complex authentication
    const loginResponse = await fetch('https://app.latenode.com/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://app.latenode.com/auth',
        'Origin': 'https://app.latenode.com'
      },
      body: new URLSearchParams({
        email: email,
        password: password,
        ...(csrfToken && { csrf: csrfToken })
      })
    });

    // Check if login was successful
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status: ${loginResponse.status}`);
    }

    // Step 3: Get the dashboard page
    const dashboardResponse = await fetch('https://app.latenode.com/scenarios', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://app.latenode.com/auth',
        'Cookie': loginResponse.headers.get('set-cookie') || ''
      }
    });

    const dashboardHtml = await dashboardResponse.text();

    // Step 4: Extract credit information from HTML
    const creditInfo = extractCreditInfo(dashboardHtml);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo.rawText,
        credits_used: creditInfo.credits_used,
        credits_total: creditInfo.credits_total,
        credits_left: creditInfo.credits_left,
        plugAndPlay_used: creditInfo.plugAndPlay_used,
        plugAndPlay_total: creditInfo.plugAndPlay_total,
        plugAndPlay_left: creditInfo.plugAndPlay_left,
        screenshotBase64: null // No screenshot with HTTP approach
      }
    });

  } catch (error) {
    console.error('HTTP scraping error:', error);
    
    res.status(500).json({
      ok: false,
      error: error.message,
      screenshotBase64: null
    });
  }
}

function extractCreditInfo(html) {
  // Look for credit information in the HTML
  const creditsMatch = html.match(/Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
  const tokensMatch = html.match(/Plug[&]?Play\s*Tokens?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
  
  return {
    rawText: html.substring(0, 1000) + '...', // First 1000 chars for debugging
    credits_left: creditsMatch ? creditsMatch[1] : null,
    credits_total: creditsMatch ? creditsMatch[2] : null,
    credits_used: creditsMatch ? (parseFloat(creditsMatch[2]) - parseFloat(creditsMatch[1])).toString() : null,
    plugAndPlay_left: tokensMatch ? tokensMatch[1] : null,
    plugAndPlay_total: tokensMatch ? tokensMatch[2] : null,
    plugAndPlay_used: tokensMatch ? (parseFloat(tokensMatch[2]) - parseFloat(tokensMatch[1])).toString() : null
  };
}
