const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Global variable for io instance
let io = null;

// Function to add debug step with real-time logging
function addDebugStep(step, status, message, screenshot = null, error = null) {
  const timestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const logEntry = {
    step,
    status,
    message,
    timestamp,
    screenshot,
    error
  };

  console.log(`[${status.toUpperCase()}] ${step}: ${message} ${timestamp}`);
  
  // Emit to WebSocket clients if available
  if (global.io) {
    global.io.emit('debug-log', logEntry);
  }
}

// Function to take screenshot
async function takeScreenshot(step, page) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `latenode-account-${Date.now()}-${step.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const screenshotPath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      type: 'png'
    });
    
    addDebugStep(step, 'screenshot', `Screenshot saved: ${filename}`, filename);
    return filename;
  } catch (error) {
    addDebugStep(step, 'error', 'Failed to take screenshot', null, error.message);
    return null;
  }
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createLatenodeAccount() {
  let browser = null;
  let page = null;
  let tempEmail = null;
  
  try {
    addDebugStep('Initialization', 'info', '🚀 Starting Latenode account creation process...');
    
    // Set global io for this scraper
    global.io = io;
    
    // Launch browser
    addDebugStep('Browser Launch', 'info', 'Launching browser...');
    browser = await puppeteer.launch({
      headless: true, // Changed to true for Railway compatibility
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    addDebugStep('Browser Launch', 'success', 'Browser launched successfully');
    
    // Step 1: Navigate to TempMail100
    addDebugStep('Temp Email', 'info', 'Navigating to TempMail100...');
    await page.goto('https://tempmail100.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    await takeScreenshot('TempMail100-Loaded', page);
    addDebugStep('Temp Email', 'success', 'Successfully navigated to TempMail100');
    
    // Wait for page to fully load
    await sleep(2000);
    
    // Handle any ads that might appear
    addDebugStep('Ad Handling', 'info', 'Checking for ads and clicking in empty space...');
    try {
      // Click in empty space to dismiss any ads
      await page.mouse.click(100, 100);
      await sleep(1000);
      addDebugStep('Ad Handling', 'success', 'Clicked in empty space to dismiss ads');
    } catch (error) {
      addDebugStep('Ad Handling', 'warning', 'No ads detected or ad handling failed', null, error.message);
    }
    
    // Step 2: Copy the temporary email
    addDebugStep('Email Copy', 'info', 'Looking for copy button to copy temporary email...');
    
    // Wait for the copy button to be available
    await page.waitForSelector('svg[onclick="copyAddress()"]', { timeout: 10000 });
    
    // Click the copy button
    await page.click('svg[onclick="copyAddress()"]');
    addDebugStep('Email Copy', 'success', 'Clicked copy button');
    
    await sleep(1000);
    
    // Get the copied email from clipboard
    addDebugStep('Email Copy', 'info', 'Reading copied email from clipboard...');
    tempEmail = await page.evaluate(async () => {
      try {
        const text = await navigator.clipboard.readText();
        console.log('Clipboard content:', text);
        return text;
      } catch (error) {
        console.log('Clipboard read error:', error.message);
        return null;
      }
    });
    
    if (tempEmail && tempEmail.trim()) {
      addDebugStep('Email Copy', 'success', `Temporary email copied: ${tempEmail}`);
    } else {
      // Fallback: try to get email from the input field
      addDebugStep('Email Copy', 'warning', 'Could not read from clipboard, trying to get email from input field...');
      tempEmail = await page.evaluate(() => {
        // Try multiple selectors for the email input
        const selectors = [
          'input[type="text"]',
          'input[type="email"]',
          'input[placeholder*="email" i]',
          'input[placeholder*="mail" i]',
          '.email-input input',
          'input[name*="email" i]'
        ];
        
        for (const selector of selectors) {
          const input = document.querySelector(selector);
          if (input && input.value && input.value.includes('@')) {
            console.log('Found email in input:', input.value);
            return input.value;
          }
        }
        
        // Last resort: look for any text that looks like an email
        const allInputs = document.querySelectorAll('input');
        for (const input of allInputs) {
          if (input.value && input.value.includes('@') && input.value.includes('.')) {
            console.log('Found email-like text:', input.value);
            return input.value;
          }
        }
        
        return null;
      });
      
      if (tempEmail) {
        addDebugStep('Email Copy', 'success', `Temporary email found: ${tempEmail}`);
      } else {
        throw new Error('Could not get temporary email address');
      }
    }
    
    await takeScreenshot('Email-Copied', page);
    
    // Step 3: Navigate to Latenode
    addDebugStep('Latenode Navigation', 'info', 'Navigating to Latenode account creation page...');
    await page.goto('https://app.latenode.com/auth', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    await takeScreenshot('Latenode-Loaded', page);
    addDebugStep('Latenode Navigation', 'success', 'Successfully navigated to Latenode');
    
    // Wait for page to fully load
    await sleep(2000);
    
    // Step 4: Fill in the email field
    addDebugStep('Email Input', 'info', 'Looking for email input field...');
    
    // Wait for the email input field
    await page.waitForSelector('input[data-test-id="authEmailInput"]', { timeout: 10000 });
    
    // Clear and fill the email field
    addDebugStep('Email Input', 'info', `Filling email field with: ${tempEmail}`);
    
    await page.evaluate((email) => {
      const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
      if (emailInput) {
        emailInput.focus();
        emailInput.value = '';
        emailInput.value = email;
        
        // Trigger events to ensure the input is registered
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        emailInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, tempEmail);
    
    await sleep(1000);
    
    // Verify the email was entered
    const enteredEmail = await page.evaluate(() => {
      const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
      return emailInput ? emailInput.value : null;
    });
    
    if (enteredEmail === tempEmail) {
      addDebugStep('Email Input', 'success', `Email successfully entered: ${enteredEmail}`);
    } else {
      addDebugStep('Email Input', 'warning', `Email verification failed. Expected: ${tempEmail}, Got: ${enteredEmail}`);
    }
    
    await takeScreenshot('Email-Entered', page);
    
    addDebugStep('Account Creation', 'success', '✅ Latenode account creation process completed successfully!');
    addDebugStep('Account Creation', 'info', `Temporary email used: ${tempEmail}`);
    
    return {
      success: true,
      tempEmail: tempEmail,
      message: 'Latenode account creation process completed successfully!'
    };
    
  } catch (error) {
    addDebugStep('Account Creation', 'error', '❌ Latenode account creation failed', null, error.message);
    
    // Return a more user-friendly error message for Railway
    if (error.message.includes('Failed to launch the browser process')) {
      throw new Error('Browser launch failed. This may be due to server environment limitations. Please try again or contact support.');
    } else if (error.message.includes('Missing X server')) {
      throw new Error('Display server not available. This is a server environment limitation.');
    } else {
      throw new Error(`Latenode account creation failed: ${error.message}`);
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
        addDebugStep('Cleanup', 'info', 'Browser closed');
      } catch (closeError) {
        addDebugStep('Cleanup', 'warning', 'Error closing browser', null, closeError.message);
      }
    }
  }
}

module.exports = { createLatenodeAccount };
