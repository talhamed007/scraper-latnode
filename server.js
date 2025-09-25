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

// Serve the Make.com scraper page
app.get('/make', (req, res) => {
  res.sendFile(path.join(__dirname, 'make.html'));
});

// Serve the KIE.ai scraper page
app.get('/kie', (req, res) => {
  res.sendFile(path.join(__dirname, 'kie.html'));
});

// Serve the Recraft.ai scraper page
app.get('/recraft', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft.html'));
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

// Make.com scraping endpoint
app.post('/api/scrape-make', async (req, res) => {
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
    console.log('🚀 Starting Make.com scraping...');
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

    console.log('🌐 Navigating to Make.com login page...');
    
    // Navigate to login page
    await page.goto('https://www.make.com/en/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    // Step 1: Handle cookie consent popup if present
    console.log('🍪 Checking for cookie consent popup...');
    try {
      // Wait a bit for cookie popup to appear
      await sleep(2000);
      
      // Look for cookie consent buttons
      const cookieSelectors = [
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept all cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button[data-testid="accept-all-cookies"]',
        'button[data-testid="accept-cookies"]',
        '.cookie-accept-all',
        '.accept-all-cookies'
      ];
      
      let cookieAccepted = false;
      for (const selector of cookieSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          cookieAccepted = true;
          console.log('✅ Accepted cookies with selector:', selector);
          await sleep(1000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      // Fallback: try to find cookie button by text content
      if (!cookieAccepted) {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text && (text.toLowerCase().includes('accept all cookies') || 
                      text.toLowerCase().includes('accept all') ||
                      text.toLowerCase().includes('accept cookies'))) {
            console.log('✅ Accepted cookies by text:', text);
            await button.click();
            await sleep(1000);
            cookieAccepted = true;
            break;
          }
        }
      }
      
      if (cookieAccepted) {
        console.log('🍪 Cookie consent handled successfully');
      } else {
        console.log('ℹ️ No cookie popup detected or already handled');
      }
    } catch (e) {
      console.log('ℹ️ Cookie popup handling failed, continuing...');
    }

    // Step 2: Handle Cloudflare verification if present
    console.log('🔒 Checking for Cloudflare verification...');
    try {
      // Wait for Cloudflare challenge or login form
      await page.waitForSelector('input[type="email"], input[name="email"], .cf-challenge-running, [data-ray]', { timeout: 10000 });
      
      // Check if Cloudflare challenge is present
      const cloudflarePresent = await page.$('.cf-challenge-running, [data-ray]');
      if (cloudflarePresent) {
        console.log('🛡️ Cloudflare verification detected, waiting for completion...');
        
        // Wait for Cloudflare to complete (usually takes 5-10 seconds)
        await page.waitForFunction(() => {
          return !document.querySelector('.cf-challenge-running, [data-ray]');
        }, { timeout: 30000 });
        
        console.log('✅ Cloudflare verification completed');
        await sleep(2000); // Wait a bit more for page to load
      }
    } catch (e) {
      console.log('ℹ️ No Cloudflare verification detected or already completed');
    }

    console.log('✍️ Filling email field...');
    
    // Wait for email input and fill it
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    await page.type('input[type="email"], input[name="email"]', email, { delay: 25 });

    console.log('🔒 Filling password field...');
    
    // Wait for password input and fill it
    await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 30000 });
    await page.type('input[type="password"], input[name="password"]', password, { delay: 25 });

    console.log('🚪 Clicking login button...');
    
    // Click login button - use proper CSS selectors
    try {
      // Try different selectors for the login button
      const loginSelectors = [
        'button[type="submit"]',
        'button[data-testid="sign-in-button"]',
        'button.sign-in-button',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Sign In")',
        'button:has-text("Login")',
        'button:has-text("Log in")'
      ];
      
      let buttonClicked = false;
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          buttonClicked = true;
          console.log(`✅ Clicked login button with selector: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!buttonClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value, button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            await button.click();
            buttonClicked = true;
            console.log(`✅ Clicked login button with text: ${text}`);
            break;
          }
        }
      }
      
      if (!buttonClicked) {
        throw new Error('Could not find login button');
      }
    } catch (error) {
      console.log('⚠️ Could not click login button, trying alternative approach...');
      // Try pressing Enter on the password field
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('🎯 Handling post-login popups...');
    
    // Step 4: Handle modal popup if present
    try {
      // Wait a bit for any popups to appear
      await sleep(3000);
      
      // Look for common popup close buttons
      const popupSelectors = [
        'button[aria-label="Close"]',
        'button[title="Close"]',
        '.modal-close',
        '.popup-close',
        '[data-testid="close"]',
        '.close-button',
        'button[aria-label="×"]',
        'button[title="×"]'
      ];
      
      let popupClosed = false;
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector);
          if (popup) {
            console.log('🚫 Found popup, clicking close button...');
            await popup.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: try to find close button by text content
      if (!popupClosed) {
        const closeButtons = await page.$$('button, [role="button"]');
        for (const button of closeButtons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.includes('×') || text.includes('✕') || text.toLowerCase().includes('close'))) {
            console.log('🚫 Found popup close button by text:', text);
            await button.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        }
      }
      
      // Also try to press Escape key to close any modals
      await page.keyboard.press('Escape');
      await sleep(1000);
      
    } catch (e) {
      console.log('ℹ️ No popup detected or already closed');
    }

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to dashboard if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('https://eu2.make.com/organization/dashboard', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    }
    
    await sleep(3000);

    console.log('📸 Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 Extracting credit information...');
    
    // Extract credit information from the dashboard
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      const creditPatterns = [
        /Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits/i,
        /Credits?\s*left\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*left/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*credits/i
      ];
      
      let creditsMatch = null;
      
      // Try each credit pattern
      for (let pattern of creditPatterns) {
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "8,699/10,000" near the word "credit"
        const creditContext = allText.match(/credit[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: creditsMatch ? creditsMatch[2] : null,
        credits_used: creditsMatch ? (parseFloat(creditsMatch[2].replace(/,/g, '')) - parseFloat(creditsMatch[1].replace(/,/g, ''))).toString() : null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo?.rawText || 'Could not extract credit information',
        credits_used: creditInfo?.credits_used,
        credits_total: creditInfo?.credits_total,
        credits_left: creditInfo?.credits_left,
        plugAndPlay_used: null, // Make.com doesn't have Plug&Play tokens
        plugAndPlay_total: null,
        plugAndPlay_left: null,
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

// KIE.ai scraping endpoint
app.post('/api/scrape-kie', async (req, res) => {
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
    console.log('🚀 Starting KIE.ai scraping...');
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

    console.log('🌐 Navigating to KIE.ai login page...');
    
    // Navigate to login page
    await page.goto('https://kie.ai/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    // Step 1: Handle any popups that might appear
    console.log('🎯 Checking for popups...');
    try {
      // Wait a bit for any popups to appear
      await sleep(2000);
      
      // Look for popup close buttons
      const popupSelectors = [
        'button[aria-label="Close"]',
        'button[title="Close"]',
        '.modal-close',
        '.popup-close',
        '[data-testid="close"]',
        '.close-button',
        'button[aria-label="×"]',
        'button[title="×"]'
      ];
      
      let popupClosed = false;
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector);
          if (popup) {
            console.log('🚫 Found popup, clicking close button...');
            await popup.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: try to find close button by text content
      if (!popupClosed) {
        const closeButtons = await page.$$('button, [role="button"]');
        for (const button of closeButtons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.includes('×') || text.includes('✕') || text.toLowerCase().includes('close'))) {
            console.log('🚫 Found popup close button by text:', text);
            await button.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        }
      }
      
      // Also try to press Escape key to close any modals
      await page.keyboard.press('Escape');
      await sleep(1000);
      
    } catch (e) {
      console.log('ℹ️ No popup detected or already closed');
    }

    console.log('✍️ Filling email field...');
    
    // Wait for email input and fill it
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    await page.type('input[type="email"], input[name="email"]', email, { delay: 25 });

    console.log('🔒 Filling password field...');
    
    // Wait for password input and fill it
    await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 30000 });
    await page.type('input[type="password"], input[name="password"]', password, { delay: 25 });

    console.log('🚪 Clicking login button...');
    
    // Click login button - use proper CSS selectors
    try {
      // Try different selectors for the login button
      const loginSelectors = [
        'button[type="submit"]',
        'button:has-text("Sign In")',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
        'button:has-text("Log in")',
        '.sign-in-button',
        '.login-button'
      ];
      
      let buttonClicked = false;
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          buttonClicked = true;
          console.log(`✅ Clicked login button with selector: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!buttonClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value, button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            await button.click();
            buttonClicked = true;
            console.log(`✅ Clicked login button with text: ${text}`);
            break;
          }
        }
      }
      
      if (!buttonClicked) {
        throw new Error('Could not find login button');
      }
    } catch (error) {
      console.log('⚠️ Could not click login button, trying alternative approach...');
      // Try pressing Enter on the password field
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to dashboard if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('https://kie.ai/dashboard', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    }
    
    await sleep(3000);

    console.log('📸 Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 Extracting credit information...');
    
    // Extract credit information from the dashboard
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      const creditPatterns = [
        /Remaining\s*credits?\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*left\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*credits?\s*left/i,
        /([0-9.,]+)\s*remaining/i
      ];
      
      let creditsMatch = null;
      
      // Try each credit pattern
      for (let pattern of creditPatterns) {
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "62,5" near the word "credit" or "remaining"
        const creditContext = allText.match(/(?:credit|remaining)[^0-9]*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: null, // KIE.ai only shows remaining credits
        credits_used: null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo?.rawText || 'Could not extract credit information',
        credits_used: creditInfo?.credits_used,
        credits_total: creditInfo?.credits_total,
        credits_left: creditInfo?.credits_left,
        plugAndPlay_used: null, // KIE.ai doesn't have Plug&Play tokens
        plugAndPlay_total: null,
        plugAndPlay_left: null,
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

// Recraft.ai scraping endpoint
app.post('/api/scrape-recraft', async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  let browser;
  let page;

  try {
    console.log('🚀 Starting Recraft.ai scraping...');
    console.log('📧 Email:', email);

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

    console.log('🌐 Navigating to Recraft.ai...');
    
    // Navigate to Recraft.ai landing page
    await page.goto('https://www.recraft.ai/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of landing page
    const landingScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Landing page screenshot taken');
    
    // Log current URL for debugging
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);

    // Step 1: Handle cookie consent popup if present
    console.log('🍪 Checking for cookie consent popup...');
    try {
      await sleep(2000);
      
      // Look for cookie consent buttons
      const cookieSelectors = [
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept all cookies")',
        'button[data-testid="accept-all-cookies"]',
        'button[data-testid="accept-cookies"]',
        '.cookie-accept-all',
        '.accept-all-cookies'
      ];
      
      let cookieAccepted = false;
      for (const selector of cookieSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          cookieAccepted = true;
          console.log('✅ Accepted cookies with selector:', selector);
          await sleep(1000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      // Fallback: try to find cookie button by text content
      if (!cookieAccepted) {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text && (text.toLowerCase().includes('accept all') || 
                      text.toLowerCase().includes('accept cookies'))) {
            console.log('✅ Accepted cookies by text:', text);
            await button.click();
            await sleep(1000);
            cookieAccepted = true;
            break;
          }
        }
      }
      
      if (cookieAccepted) {
        console.log('🍪 Cookie consent handled successfully');
      } else {
        console.log('ℹ️ No cookie popup detected or already handled');
      }
    } catch (e) {
      console.log('ℹ️ Cookie popup handling failed, continuing...');
    }

    console.log('🔍 Looking for Sign In button...');
    
    // Click on Sign In button
    try {
      const signInSelectors = [
        'button:has-text("Sign in")',
        'button:has-text("Sign In")',
        'a:has-text("Sign in")',
        'a:has-text("Sign In")',
        '[href*="sign-in"]',
        '[href*="login"]',
        '.sign-in-button',
        '.login-button'
      ];
      
      let signInClicked = false;
      for (const selector of signInSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          signInClicked = true;
          console.log('✅ Clicked Sign In with selector:', selector);
          await sleep(3000); // Wait longer for navigation
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!signInClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, a');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text && text.toLowerCase().includes('sign in')) {
            console.log('✅ Clicked Sign In by text:', text);
            await button.click();
            await sleep(3000);
            signInClicked = true;
            break;
          }
        }
      }
      
      if (!signInClicked) {
        throw new Error('Could not find Sign In button');
      }
    } catch (error) {
      console.log('⚠️ Could not click Sign In button:', error.message);
      throw error;
    }
    
    // Log URL after clicking Sign In
    const urlAfterSignIn = page.url();
    console.log('📍 URL after Sign In:', urlAfterSignIn);

    console.log('✍️ Filling email field...');
    
    // Wait for email input and fill it - now on the authentication page
    try {
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
      await page.type('input[type="email"], input[name="email"]', email, { delay: 25 });
      console.log('✅ Email filled successfully');
    } catch (error) {
      console.log('⚠️ Could not find email input, trying alternative selectors...');
      
      // Try alternative selectors for email input
      const emailSelectors = [
        'input[type="text"]',
        'input[placeholder*="email"]',
        'input[placeholder*="Email"]',
        'input[name="username"]',
        'input[id="email"]',
        'input[class*="email"]'
      ];
      
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.type(selector, email, { delay: 25 });
          emailFilled = true;
          console.log('✅ Email filled with selector:', selector);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!emailFilled) {
        throw new Error('Could not find email input field');
      }
    }

    console.log('☑️ Checking verification checkbox...');
    
    // Look for and click verification checkbox (Cloudflare)
    try {
      const checkboxSelectors = [
        'input[type="checkbox"]',
        '.cf-challenge-running input[type="checkbox"]',
        '[data-ray] input[type="checkbox"]',
        'input[name="cf-turnstile-response"]'
      ];
      
      let checkboxChecked = false;
      for (const selector of checkboxSelectors) {
        try {
          const checkbox = await page.$(selector);
          if (checkbox) {
            await checkbox.click();
            checkboxChecked = true;
            console.log('✅ Clicked verification checkbox');
            await sleep(2000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!checkboxChecked) {
        console.log('ℹ️ No verification checkbox found, continuing...');
      }
    } catch (e) {
      console.log('ℹ️ Verification checkbox handling failed, continuing...');
    }

    console.log('🚪 Clicking Continue button...');
    
    // Click Continue button
    try {
      const continueSelectors = [
        'button:has-text("Continue")',
        'button:has-text("continue")',
        'button[type="submit"]',
        '.continue-button'
      ];
      
      let continueClicked = false;
      for (const selector of continueSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          continueClicked = true;
          console.log('✅ Clicked Continue with selector:', selector);
          await sleep(3000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!continueClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text && text.toLowerCase().includes('continue')) {
            console.log('✅ Clicked Continue by text:', text);
            await button.click();
            await sleep(3000);
            continueClicked = true;
            break;
          }
        }
      }
      
      if (!continueClicked) {
        throw new Error('Could not find Continue button');
      }
    } catch (error) {
      console.log('⚠️ Could not click Continue button:', error.message);
      throw error;
    }

    console.log('📧 Waiting for verification code page...');
    
    // Wait for verification code page
    await page.waitForSelector('input[type="text"], input[name="code"], input[placeholder*="code"]', { timeout: 30000 });
    
    // Take screenshot of verification page
    const verificationScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Verification page screenshot taken');

    console.log('⏳ Waiting for manual verification code entry...');
    
    // Wait for user to manually enter verification code
    // This is a limitation - we can't automatically read emails
    // The user will need to enter the code manually
    await sleep(10000); // Wait 10 seconds for user to enter code
    
    console.log('🔍 Checking if verification was successful...');
    
    // Check if we're on the dashboard or still on verification page
    const currentUrl = page.url();
    if (currentUrl.includes('verification') || currentUrl.includes('code')) {
      console.log('⚠️ Still on verification page - user needs to enter code manually');
      
      // Return verification required response
      res.status(200).json({
        ok: true,
        data: {
          rawText: 'Verification code required - please check your email and enter the code manually',
          credits_used: null,
          credits_total: null,
          credits_left: null,
          plugAndPlay_used: null,
          plugAndPlay_total: null,
          plugAndPlay_left: null,
          screenshotBase64: verificationScreenshot ? verificationScreenshot.toString('base64') : null,
          verificationRequired: true,
          message: 'Please check your email for the verification code and enter it manually in the browser'
        }
      });
      return;
    }

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to dashboard if not already there
    if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/app')) {
      await page.goto('https://www.recraft.ai/app', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    }
    
    await sleep(3000);

    console.log('📸 Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 Extracting credit information...');
    
    // Extract credit information from the dashboard
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      const creditPatterns = [
        /Credits?\s*:?\s*([0-9.,]+)/i,
        /Remaining\s*credits?\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*left\s*:?\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*credits?/i,
        /([0-9.,]+)\s*remaining/i
      ];
      
      let creditsMatch = null;
      
      // Try each credit pattern
      for (let pattern of creditPatterns) {
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "100" near the word "credit"
        const creditContext = allText.match(/(?:credit|remaining)[^0-9]*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: null, // Recraft.ai might only show remaining credits
        credits_used: null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo?.rawText || 'Could not extract credit information',
        credits_used: creditInfo?.credits_used,
        credits_total: creditInfo?.credits_total,
        credits_left: creditInfo?.credits_left,
        plugAndPlay_used: null, // Recraft.ai doesn't have Plug&Play tokens
        plugAndPlay_total: null,
        plugAndPlay_left: null,
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
