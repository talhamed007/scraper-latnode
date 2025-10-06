const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Global variables for control
let globalBrowser = null;
let globalPage = null;
let globalScraperPaused = false;
let globalScraperStopped = false;
let globalIO = null;

// Debug logging function
async function addDebugStep(step, type, message, screenshot = null, error = null, page = null) {
  const timestamp = new Date().toLocaleString();
  
  // Take screenshot for important steps if page is provided
  if (page && !screenshot && (type === 'success' || type === 'error' || step.includes('Entry') || step.includes('Button'))) {
    try {
      screenshot = await takeScreenshot(`${step.replace(/\s+/g, '-')}-${type}`, page);
    } catch (e) {
      // Screenshot failed, continue without it
    }
  }
  
  const logEntry = {
    step,
    type,
    message,
    timestamp,
    screenshot,
    error
  };
  
  console.log(`[${timestamp}] ${step}: ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}`);
  if (screenshot) {
    console.log(`[${timestamp}] ${step}: Screenshot: ${screenshot}`);
  }
  
  // Emit to all connected clients
  if (globalIO) {
    globalIO.emit('log', logEntry);
  }
  
  return logEntry;
}

// Helper function to take screenshots
async function takeScreenshot(name, page) {
  try {
    // Check if page is still accessible before taking screenshot
    try {
      await page.evaluate(() => document.title);
    } catch (e) {
      addDebugStep('Screenshot', 'warning', `Page not accessible for screenshot ${name}: ${e.message}`);
      return null;
    }

    const timestamp = Date.now();
    const screenshotPath = path.join(__dirname, 'screenshots', `${name}-${timestamp}.png`);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Verify file was saved
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      const filename = `${name}-${timestamp}.png`;
      addDebugStep('Screenshot', 'success', `Screenshot saved: ${filename} (${stats.size} bytes)`);
      
      // Emit screenshot to clients
      if (globalIO) {
        globalIO.emit('screenshot', { filename: filename });
      }
      
      return filename;
    } else {
      addDebugStep('Screenshot', 'error', `Screenshot file not found: ${screenshotPath}`);
      return null;
    }
  } catch (error) {
    addDebugStep('Screenshot', 'error', `Screenshot failed: ${error.message}`);
    return null;
  }
}

// Helper function for human-like delays
async function randomHumanDelay(page, min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

// Main login function
async function loginToOutlook(email, password, io) {
  globalIO = io;
  globalScraperPaused = false;
  globalScraperStopped = false;
  
  let browser = null;
  let page = null;
  
  try {
    // Step 1: Launch browser
    addDebugStep('Browser', 'info', 'Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 120000, // 2 minutes timeout
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    globalBrowser = browser;
    
    addDebugStep('Browser', 'success', 'Browser launched successfully');
    
    // Step 2: Create new page
    addDebugStep('Browser', 'info', 'Creating new page...');
    page = await browser.newPage();
    globalPage = page;
    
    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });
    addDebugStep('Browser', 'success', 'Page created and viewport set');
    
    // Step 3: Navigate to Microsoft login
    addDebugStep('Navigation', 'info', 'Navigating to Microsoft login...');
    await page.goto('https://login.microsoftonline.com/', { waitUntil: 'networkidle2' });
    await takeScreenshot('Microsoft-Login-Initial', page);
    await addDebugStep('Navigation', 'success', 'Successfully navigated to Microsoft login', null, null, page);
    
    // Wait for page to load
    await randomHumanDelay(page, 2000, 3000);
    
    // Step 4: Enter email
    addDebugStep('Email Entry', 'info', 'Entering email...');
    await page.click('input[name="loginfmt"]');
    await page.type('input[name="loginfmt"]', email, { delay: 100 });
    
    await takeScreenshot('Email-Entered', page);
    await addDebugStep('Email Entry', 'success', 'Email entered successfully', null, null, page);
    
    // Step 5: Click Next button
    addDebugStep('Email Entry', 'info', 'Clicking Next button...');
    await page.click('input[type="submit"][id="idSIButton9"]');
    await takeScreenshot('Email-Next-Clicked', page);
    await addDebugStep('Email Entry', 'success', 'Next button clicked', null, null, page);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 6: Enter password
    addDebugStep('Password Entry', 'info', 'Entering password...');
    await page.click('input[name="passwd"]');
    await page.type('input[name="passwd"]', password, { delay: 100 });
    
    await takeScreenshot('Password-Entered', page);
    await addDebugStep('Password Entry', 'success', 'Password entered successfully', null, null, page);
    
    // Step 7: Click Next button for password
    addDebugStep('Password Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Password-Next-Clicked', page);
    await addDebugStep('Password Entry', 'success', 'Next button clicked', null, null, page);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 8: Handle "Stay signed in?" prompt
    addDebugStep('Stay Signed In', 'info', 'Handling stay signed in prompt...');
    
    try {
      // Look for "Yes" button
      await page.waitForSelector('button[type="submit"][data-testid="primaryButton"]', { timeout: 10000 });
      await page.click('button[type="submit"][data-testid="primaryButton"]');
      await takeScreenshot('Stay-Signed-In-Yes', page);
      await addDebugStep('Stay Signed In', 'success', 'Stay signed in confirmed', null, null, page);
    } catch (e) {
      addDebugStep('Stay Signed In', 'info', 'Stay signed in prompt not found or already handled');
    }
    
    // Wait for navigation
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 9: Handle any popups that appear
    addDebugStep('Popup Handling', 'info', 'Checking for popups...');
    
    try {
      // Look for close button (X) in popups
      const closeButton = await page.$('svg[aria-hidden="true"]');
      if (closeButton) {
        await closeButton.click();
        await takeScreenshot('Popup-Closed', page);
        await addDebugStep('Popup Handling', 'success', 'Popup closed successfully', null, null, page);
      } else {
        addDebugStep('Popup Handling', 'info', 'No popup found to close');
      }
    } catch (e) {
      addDebugStep('Popup Handling', 'info', 'No popup found or already closed');
    }
    
    // Step 10: Verify login success
    addDebugStep('Login Verification', 'info', 'Verifying login success...');
    
    // Wait for page to load completely
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 });
    
    // Check if we're on a Microsoft dashboard or Outlook
    const currentUrl = page.url();
    const pageTitle = await page.title();
    
    await takeScreenshot('Login-Success', page);
    
    if (currentUrl.includes('office.com') || currentUrl.includes('outlook.com') || 
        pageTitle.toLowerCase().includes('outlook') || pageTitle.toLowerCase().includes('microsoft')) {
      await addDebugStep('Login Verification', 'success', 'Successfully logged into Microsoft account!', null, null, page);
      
      return {
        success: true,
        message: 'Successfully logged into Microsoft account',
        email: email,
        url: currentUrl,
        title: pageTitle
      };
    } else {
      await addDebugStep('Login Verification', 'warning', `Unexpected page after login: ${currentUrl}`, null, null, page);
      
      return {
        success: true,
        message: 'Login completed but redirected to unexpected page',
        email: email,
        url: currentUrl,
        title: pageTitle
      };
    }
    
  } catch (error) {
    addDebugStep('Login Process', 'error', `Login failed: ${error.message}`, null, null, page);
    return {
      success: false,
      error: error.message,
      email: email
    };
  } finally {
    // Clean up
    if (browser) {
      await browser.close();
      globalBrowser = null;
      globalPage = null;
    }
  }
}

module.exports = { loginToOutlook };
