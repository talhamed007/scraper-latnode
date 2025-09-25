const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Real scraping endpoint
app.post('/api/scrape', async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let browser;
  let page;

  try {
    console.log('🚀 Starting real Latenode scraping...');
    console.log('📧 Email:', email);
    console.log('🔑 Password length:', password.length);

    // Launch browser with optimized settings for Railway
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Helper function for sleep
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    console.log('🌐 Navigating to Latenode login page...');
    
    // Navigate to login page
    await page.goto('https://app.latenode.com/auth', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    console.log('✍️ Filling email field...');
    
    // Wait for email input and fill it
    await page.waitForSelector('input[type=email],#email,input[name=email]', { timeout: 30000 });
    await page.type('input[type=email],#email,input[name=email]', email, { delay: 25 });

    // Helper function to click by text
    const clickByText = async (regex) => {
      const buttons = await page.$$('button,[role=button],input[type=submit]');
      for (const button of buttons) {
        const text = (await (await button.getProperty('innerText')).jsonValue() || '').trim();
        if (new RegExp(regex, 'i').test(text)) {
          await button.click();
          return true;
        }
      }
      return false;
    };

    console.log('➡️ Clicking next button...');
    
    // Click next/continue button
    await clickByText('Suivant|Next');
    await sleep(1200);

    console.log('🔒 Filling password field...');
    
    // Wait for password input and fill it
    await page.waitForSelector('input[type=password],#login,input[name=login]', { timeout: 30000 });
    await page.type('input[type=password],#login,input[name=login]', password, { delay: 25 });

    console.log('🚪 Clicking login button...');
    
    // Click login button
    (await clickByText('Connexion|Se connecter|Sign in')) || await clickByText('Login');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to scenarios page to see the dashboard
    await page.goto('https://app.latenode.com/scenarios', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await sleep(3000);

    console.log('📸 Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 Extracting credit information...');
    
    // Extract credit information from the sidebar
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      // Try multiple patterns to catch different formats
      const creditPatterns = [
        /Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits/i,
        /Credits?\s*left\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*left/i
      ];
      
      const tokenPatterns = [
        /Plug[&]?Play\s*Tokens?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Plug[&]?Play\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Plug[&]?Play/i,
        /Plug[&]?Play\s*Tokens?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i
      ];
      
      let creditsMatch = null;
      let tokensMatch = null;
      
      // Try each credit pattern
      for (let pattern of creditPatterns) {
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          break;
        }
      }
      
      // Try each token pattern
      for (let pattern of tokenPatterns) {
        tokensMatch = allText.match(pattern);
        if (tokensMatch) {
          console.log('Found tokens with pattern:', pattern);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "296/300" near the word "credit"
        const creditContext = allText.match(/credit[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      if (!tokensMatch) {
        // Look for patterns like "0.82/0" near the word "plug" or "play"
        const tokenContext = allText.match(/(plug|play)[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (tokenContext) {
          tokensMatch = tokenContext;
          console.log('Found tokens in context:', tokenContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      console.log('Final tokens match:', tokensMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: creditsMatch ? creditsMatch[2] : null,
        plugAndPlay_left: tokensMatch ? tokensMatch[1] : null,
        plugAndPlay_total: tokensMatch ? tokensMatch[2] : null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo?.rawText || 'Could not extract credit information',
        credits_used: creditInfo?.credits_total && creditInfo?.credits_left ? 
          (parseFloat(creditInfo.credits_total) - parseFloat(creditInfo.credits_left)).toString() : null,
        credits_total: creditInfo?.credits_total,
        credits_left: creditInfo?.credits_left,
        plugAndPlay_used: creditInfo?.plugAndPlay_total && creditInfo?.plugAndPlay_left ? 
          (parseFloat(creditInfo.plugAndPlay_total) - parseFloat(creditInfo.plugAndPlay_left)).toString() : null,
        plugAndPlay_total: creditInfo?.plugAndPlay_total,
        plugAndPlay_left: creditInfo?.plugAndPlay_left,
        screenshotBase64: dashboardScreenshot ? dashboardScreenshot.toString('base64') : null
      }
    });

  } catch (error) {
    console.error('❌ Scraping error:', error);
    
    // Take error screenshot if possible
    let errorScreenshot = null;
    try {
      if (page) {
        errorScreenshot = await page.screenshot({ fullPage: true });
      }
    } catch (e) {
      console.log('Could not take error screenshot:', e.message);
    }

    res.status(500).json({
      ok: false,
      error: error.message,
      screenshotBase64: errorScreenshot ? errorScreenshot.toString('base64') : null
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Latenode Scraper running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
});
