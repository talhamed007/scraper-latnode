const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Debug steps storage
let debugSteps = [];
let screenshotCounter = 0;

function addDebugStep(step, status, message, screenshot = null, error = null) {
  const stepData = {
    step: step,
    status: status,
    message: message,
    timestamp: new Date().toISOString(),
    screenshot: screenshot,
    error: error
  };
  
  debugSteps.push(stepData);
  console.log(`[${status.toUpperCase()}] ${step}: ${message}`);
  
  if (error) {
    console.error(`Error: ${error}`);
  }
}

async function takeScreenshot(description, pageInstance = null) {
  try {
    const currentPage = pageInstance || page;
    if (!currentPage) {
      addDebugStep(description, 'warning', 'No page instance available for screenshot');
      return null;
    }
    
    screenshotCounter++;
    const filename = `recraft-simple-${screenshotCounter}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const filepath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    const screenshot = await currentPage.screenshot({ 
      fullPage: true,
      path: filepath 
    });
    
    addDebugStep(description, 'screenshot', `Screenshot saved: ${filename}`, filename);
    return screenshot;
  } catch (error) {
    addDebugStep(description, 'error', 'Failed to take screenshot', null, error.message);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeRecraftSimple(googleEmail, googlePassword) {
  let browser = null;
  let page = null;
  
  try {
    // Initialize debug steps
    debugSteps = [];
    screenshotCounter = 0;
    
    addDebugStep('Initialization', 'info', 'Starting simple Recraft.ai scraper...');
    
    // Launch browser with Railway-compatible settings
    addDebugStep('Browser Launch', 'info', 'Launching browser...');
    
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-field-trial-config',
          '--disable-back-forward-cache',
          '--disable-ipc-flooding-protection',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings',
          '--disable-logging',
          '--disable-permissions-api',
          '--disable-presentation-api',
          '--disable-print-preview',
          '--disable-speech-api',
          '--disable-file-system',
          '--disable-notifications',
          '--disable-geolocation',
          '--disable-media-session',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-background-networking',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        defaultViewport: { width: 1366, height: 768 },
        ignoreDefaultArgs: ['--disable-extensions'],
        ignoreHTTPSErrors: true,
        timeout: 60000
      });
      
      addDebugStep('Browser Launch', 'success', 'Browser launched successfully');
      
    } catch (browserError) {
      addDebugStep('Browser Launch', 'error', 'Failed to launch browser', null, browserError.message);
      throw new Error(`Failed to launch browser: ${browserError.message}. Railway environment may not support browser automation.`);
    }
    
    page = await browser.newPage();
    
    // Basic stealth settings
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Navigate to Recraft.ai login page
    addDebugStep('Navigation', 'info', 'Navigating to Recraft.ai login page...');
    await page.goto('https://www.recraft.ai/auth/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await sleep(3000);
    await takeScreenshot('Recraft.ai Login Page', page);
    
    addDebugStep('Navigation', 'success', 'Successfully navigated to Recraft.ai login page');
    
    // Try to find and click Google login button
    addDebugStep('Google Button', 'info', 'Looking for Google login button...');
    
    try {
      // Wait for Google button to appear
      await page.waitForSelector('a[data-provider="google"]', { timeout: 10000 });
      
      // Click Google button
      await page.click('a[data-provider="google"]');
      addDebugStep('Google Button', 'success', 'Clicked Google login button');
      
      await sleep(3000);
      await takeScreenshot('Google Login Page', page);
      
    } catch (error) {
      addDebugStep('Google Button', 'error', 'Could not find or click Google button', null, error.message);
      throw new Error('Could not find Google login button');
    }
    
    // Fill Google email
    addDebugStep('Google Email', 'info', 'Filling Google email...');
    
    try {
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Clear and fill email
      await page.click('input[type="email"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.type('input[type="email"]', googleEmail, { delay: 100 });
      
      addDebugStep('Google Email', 'success', 'Email filled successfully');
      
      await sleep(1000);
      await takeScreenshot('After Filling Email', page);
      
    } catch (error) {
      addDebugStep('Google Email', 'error', 'Could not fill email', null, error.message);
      throw new Error('Could not fill Google email');
    }
    
    // Click Next button for email
    addDebugStep('Email Next', 'info', 'Clicking Next button for email...');
    
    try {
      await page.click('#identifierNext');
      addDebugStep('Email Next', 'success', 'Clicked Next button for email');
      
      await sleep(5000);
      await takeScreenshot('After Clicking Email Next', page);
      
    } catch (error) {
      addDebugStep('Email Next', 'error', 'Could not click Next button for email', null, error.message);
      throw new Error('Could not click Next button for email');
    }
    
    // Fill Google password
    addDebugStep('Google Password', 'info', 'Filling Google password...');
    
    try {
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      
      // Clear and fill password
      await page.click('input[type="password"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.type('input[type="password"]', googlePassword, { delay: 100 });
      
      addDebugStep('Google Password', 'success', 'Password filled successfully');
      
      await sleep(1000);
      await takeScreenshot('After Filling Password', page);
      
    } catch (error) {
      addDebugStep('Google Password', 'error', 'Could not fill password', null, error.message);
      throw new Error('Could not fill Google password');
    }
    
    // Click Next button for password
    addDebugStep('Password Next', 'info', 'Clicking Next button for password...');
    
    try {
      await page.click('#passwordNext');
      addDebugStep('Password Next', 'success', 'Clicked Next button for password');
      
      await sleep(5000);
      await takeScreenshot('After Clicking Password Next', page);
      
    } catch (error) {
      addDebugStep('Password Next', 'error', 'Could not click Next button for password', null, error.message);
      throw new Error('Could not click Next button for password');
    }
    
    // Wait for redirect to Recraft.ai
    addDebugStep('Redirect', 'info', 'Waiting for redirect to Recraft.ai...');
    
    try {
      await page.waitForFunction(() => {
        return window.location.href.includes('recraft.ai') && 
               !window.location.href.includes('/auth/login');
      }, { timeout: 30000 });
      
      addDebugStep('Redirect', 'success', 'Successfully redirected to Recraft.ai');
      
      await sleep(3000);
      await takeScreenshot('Recraft.ai Dashboard', page);
      
    } catch (error) {
      addDebugStep('Redirect', 'warning', 'Redirect timeout, checking current URL', null, error.message);
    }
    
    // Handle popups and cookies
    addDebugStep('Popup Handling', 'info', 'Checking for and closing popups...');
    
    try {
      // Wait a bit for popups to appear
      await sleep(2000);
      
      // Close any popups that might appear
      const popupsClosed = await page.evaluate(() => {
        let closedCount = 0;
        
        // Get all buttons on the page
        const allButtons = document.querySelectorAll('button, a, [role="button"]');
        
        for (const button of allButtons) {
          if (button.offsetParent === null) continue; // Skip hidden buttons
          
          const text = (button.innerText || button.textContent || '').trim().toLowerCase();
          const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
          const className = (button.className || '').toLowerCase();
          
          // Look for close buttons (X buttons) in popups
          if (text === '×' || text === '✕' || text === 'close' || 
              ariaLabel.includes('close') || className.includes('close')) {
            button.click();
            closedCount++;
            console.log('Closed popup with close button:', text);
            continue;
          }
          
          // Look for "Accept All" buttons in cookie popups
          if (text.includes('accept all') || text.includes('accept') || 
              text.includes('ok') || text.includes('got it') ||
              text.includes('agree') || text.includes('continue')) {
            button.click();
            closedCount++;
            console.log('Clicked Accept/OK button:', text);
            continue;
          }
          
          // Look for "Learn more" or similar buttons that might close popups
          if (text.includes('learn more') || text.includes('dismiss') ||
              text.includes('skip') || text.includes('not now')) {
            button.click();
            closedCount++;
            console.log('Clicked Learn more/Dismiss button:', text);
            continue;
          }
        }
        
        return closedCount;
      });
      
      if (popupsClosed > 0) {
        addDebugStep('Popup Handling', 'success', `Closed ${popupsClosed} popup(s)`);
        await sleep(1000);
        await takeScreenshot('After Closing Popups', page);
      } else {
        addDebugStep('Popup Handling', 'info', 'No popups found to close');
      }
      
    } catch (error) {
      addDebugStep('Popup Handling', 'warning', 'Error handling popups', null, error.message);
    }
    
    // Final page analysis
    const finalUrl = page.url();
    const finalTitle = await page.title();
    
    addDebugStep('Final Analysis', 'info', `Final URL: ${finalUrl}`);
    addDebugStep('Final Analysis', 'info', `Final Title: ${finalTitle}`);
    
    // Determine success - must be on actual Recraft.ai dashboard, not auth pages
    const isSuccess = finalUrl.includes('recraft.ai') && 
                     (finalUrl.includes('/dashboard') || finalUrl.includes('/workspace') || 
                      finalUrl.includes('/app') || finalUrl.includes('/home')) &&
                     !finalUrl.includes('keycloak') && !finalUrl.includes('auth') &&
                     !finalTitle.toLowerCase().includes('sign in') && !finalTitle.toLowerCase().includes('login');
    
    if (isSuccess) {
      addDebugStep('Result', 'success', 'Simple Recraft.ai login completed successfully!');
    } else {
      addDebugStep('Result', 'warning', 'Simple login completed but may not have reached dashboard');
    }
    
    return {
      ok: true,
      success: isSuccess,
      finalUrl: finalUrl,
      finalTitle: finalTitle,
      steps: debugSteps,
      message: isSuccess ? 'Simple login successful!' : 'Simple login completed with warnings'
    };
    
  } catch (error) {
    addDebugStep('Error', 'error', 'Simple scraper failed', null, error.message);
    console.error('❌ Simple scraper error:', error);
    
    return {
      ok: false,
      success: false,
      error: error.message,
      steps: debugSteps
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeRecraftSimple };
