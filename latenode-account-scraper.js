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

async function createLatenodeAccount(ioInstance = null, password = null) {
  let browser = null;
  let page = null;
  let tempEmail = null;
  let confirmationCode = null;
  let generatedPassword = password || `TempPass${Math.random().toString(36).substring(2, 8)}!123`;
  
  try {
    addDebugStep('Initialization', 'info', '🚀 Starting Latenode account creation process...');
    
    // Set global.io for WebSocket logging
    if (ioInstance) {
      global.io = ioInstance;
    }
    
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
    
    try {
      // Wait for the copy button to be available
      await page.waitForSelector('svg[onclick="copyAddress()"]', { timeout: 10000 });
      
      // Click the copy button
      await page.click('svg[onclick="copyAddress()"]');
      addDebugStep('Email Copy', 'success', 'Clicked copy button');
      
      await sleep(1000);
    } catch (error) {
      addDebugStep('Email Copy', 'warning', 'Could not click copy button, proceeding with direct extraction', null, error.message);
    }
    
    // Skip clipboard reading in headless mode and go directly to input field extraction
    addDebugStep('Email Copy', 'info', 'Extracting temporary email from input field (headless mode)...');
    
    // Get email directly from the input field since clipboard doesn't work in headless mode
    tempEmail = await page.evaluate(() => {
      // Try multiple selectors for the email input
      const selectors = [
        'input[type="text"]',
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="mail" i]',
        '.email-input input',
        'input[name*="email" i]',
        'input[class*="email"]',
        'input[class*="mail"]'
      ];
      
      for (const selector of selectors) {
        const input = document.querySelector(selector);
        if (input && input.value && input.value.includes('@')) {
          console.log('Found email in input:', input.value);
          return input.value;
        }
      }
      
      // Look for any input with email-like content
      const allInputs = document.querySelectorAll('input');
      for (const input of allInputs) {
        if (input.value && input.value.includes('@') && input.value.includes('.')) {
          console.log('Found email-like text:', input.value);
          return input.value;
        }
      }
      
      // Look for email in any text content or data attributes
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const bodyText = document.body.innerText;
      const emailMatch = bodyText.match(emailRegex);
      if (emailMatch) {
        console.log('Found email in page text:', emailMatch[0]);
        return emailMatch[0];
      }
      
      return null;
    });
    
    if (tempEmail && tempEmail.trim()) {
      addDebugStep('Email Copy', 'success', `Temporary email extracted: ${tempEmail}`);
    } else {
      // Fallback: generate a temporary email
      addDebugStep('Email Copy', 'warning', 'Could not extract email from page, generating fallback email...');
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      tempEmail = `temp${randomId}${timestamp}@tempmail100.com`;
      addDebugStep('Email Copy', 'success', `Generated fallback email: ${tempEmail}`);
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
    
    // Step 5: Click Next button to proceed
    addDebugStep('Next Button', 'info', 'Looking for Next button...');
    
    try {
      // First, click on the email field to make sure it's focused and button becomes visible
      await page.click('input[data-test-id="authEmailInput"]');
      await sleep(1000);
      
      // Also click in empty space to make sure the page is interactive
      await page.mouse.click(100, 100);
      await sleep(1000);
      
      // Try multiple selectors for the Next button
      const nextButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("Next")',
        'button:has-text("Suivant")',
        'button:has-text("Continue")',
        'button:has-text("Continuer")',
        'input[type="submit"]',
        '[data-test-id*="next"]',
        '[data-test-id*="submit"]',
        'button[class*="submit"]',
        'button[class*="next"]'
      ];
      
      let nextButtonFound = false;
      for (const selector of nextButtonSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          addDebugStep('Next Button', 'success', `Clicked Next button using selector: ${selector}`);
          nextButtonFound = true;
          break;
        } catch (e) {
          // Try next selector
          continue;
        }
      }
      
      if (!nextButtonFound) {
        // Last resort: try to find any clickable button
        const anyButton = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button, input[type="submit"], [role="button"]');
          for (const btn of buttons) {
            const text = (btn.innerText || btn.value || '').toLowerCase();
            if (text.includes('next') || text.includes('suivant') || text.includes('continue') || text.includes('submit')) {
              btn.click();
              return true;
            }
          }
          return false;
        });
        
        if (anyButton) {
          addDebugStep('Next Button', 'success', 'Clicked Next button using JavaScript evaluation');
          nextButtonFound = true;
        }
      }
      
      if (!nextButtonFound) {
        addDebugStep('Next Button', 'error', '❌ CRITICAL: Could not find Next button - stopping process');
        throw new Error('Next button not found - this step is obligatory');
      }
      
      // Wait for page to update to confirmation code page
      await page.waitForFunction(() => {
        return document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i]') !== null;
      }, { timeout: 15000 });
      
      addDebugStep('Next Button', 'success', 'Page updated to confirmation code step');
      await takeScreenshot('Confirmation-Code-Page', page);
      
    } catch (error) {
      addDebugStep('Next Button', 'error', '❌ CRITICAL: Next button step failed - stopping process', null, error.message);
      throw new Error(`Next button step failed: ${error.message}`);
    }
    
    // Step 6: Switch back to TempMail100 tab to get confirmation code
    addDebugStep('Email Check', 'info', 'Switching to TempMail100 tab to check for confirmation email...');
    
    // Wait a bit for the email to be sent (if Next button was clicked)
    addDebugStep('Email Check', 'info', 'Waiting for email to be sent...');
    await sleep(10000); // Wait 10 seconds for email to arrive
    
    // Get all pages and find the TempMail100 tab
    const pages = await browser.pages();
    let tempMailPage = null;
    
    for (const p of pages) {
      const url = p.url();
      if (url.includes('tempmail100.com')) {
        tempMailPage = p;
        break;
      }
    }
    
    if (!tempMailPage) {
      // If no TempMail100 tab found, create a new one
      tempMailPage = await browser.newPage();
      await tempMailPage.goto('https://tempmail100.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    }
    
    // Switch to TempMail100 tab
    await tempMailPage.bringToFront();
    await sleep(2000);
    await takeScreenshot('TempMail100-Inbox', tempMailPage);
    
    // Look for the Latenode confirmation email
    addDebugStep('Email Check', 'info', 'Looking for Latenode confirmation email...');
    
    try {
      // Wait for the email to appear with multiple attempts
      let emailFound = false;
      const maxAttempts = 10;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        addDebugStep('Email Check', 'info', `Attempt ${attempt}/${maxAttempts} - Looking for Latenode email...`);
        
        // Refresh the inbox
        try {
          await tempMailPage.click('button:has-text("Refresh"), [class*="refresh"]');
          await sleep(2000);
        } catch (e) {
          // Refresh button not found, continue
        }
        
        // Try multiple selectors for the email
        const emailSelectors = [
          'a.email-item:has-text("Latenode")',
          'a.email-item:has-text("Confirm your email")',
          'a.email-item:has-text("latenode")',
          'a.email-item:has-text("confirm")',
          'a[href*="detail"]:has-text("Latenode")',
          'a[href*="detail"]:has-text("Confirm")'
        ];
        
        for (const selector of emailSelectors) {
          try {
            await tempMailPage.waitForSelector(selector, { timeout: 3000 });
            await tempMailPage.click(selector);
            addDebugStep('Email Check', 'success', `Clicked on Latenode email using selector: ${selector}`);
            emailFound = true;
            break;
          } catch (e) {
            // Try next selector
            continue;
          }
        }
        
        if (emailFound) break;
        
        // If not found, wait a bit and try again
        if (attempt < maxAttempts) {
          addDebugStep('Email Check', 'info', `Email not found yet, waiting 5 seconds before retry...`);
          await sleep(5000);
        }
      }
      
      if (!emailFound) {
        // Last resort: try JavaScript evaluation
        const emailClicked = await tempMailPage.evaluate(() => {
          const emailItems = document.querySelectorAll('a.email-item, a[href*="detail"]');
          for (const item of emailItems) {
            const text = (item.innerText || item.textContent || '').toLowerCase();
            if (text.includes('latenode') || text.includes('confirm')) {
              item.click();
              return true;
            }
          }
          return false;
        });
        
        if (emailClicked) {
          addDebugStep('Email Check', 'success', 'Clicked on Latenode email using JavaScript evaluation');
          emailFound = true;
        }
      }
      
      if (!emailFound) {
        addDebugStep('Email Check', 'error', '❌ CRITICAL: Could not find Latenode confirmation email after multiple attempts - stopping process');
        throw new Error('Latenode confirmation email not found - this step is obligatory');
      }
      
      await sleep(3000);
      await takeScreenshot('Email-Opened', tempMailPage);
      
      // Extract the confirmation code
      addDebugStep('Code Extraction', 'info', 'Extracting confirmation code from email...');
      
      confirmationCode = await tempMailPage.evaluate(() => {
        // Look for confirmation code in various formats
        const bodyText = document.body.innerText;
        const codeMatch = bodyText.match(/confirmation code[:\s]*(\d{4})/i) || 
                         bodyText.match(/code[:\s]*(\d{4})/i) ||
                         bodyText.match(/(\d{4})/);
        
        if (codeMatch) {
          console.log('Found confirmation code:', codeMatch[1]);
          return codeMatch[1];
        }
        
        // Look for any 4-digit number
        const allNumbers = bodyText.match(/\b\d{4}\b/g);
        if (allNumbers && allNumbers.length > 0) {
          console.log('Found 4-digit number:', allNumbers[0]);
          return allNumbers[0];
        }
        
        return null;
      });
      
      if (confirmationCode) {
        addDebugStep('Code Extraction', 'success', `Confirmation code extracted: ${confirmationCode}`);
      } else {
        addDebugStep('Code Extraction', 'error', '❌ CRITICAL: Could not extract confirmation code from email - stopping process');
        throw new Error('Confirmation code extraction failed - this step is obligatory');
      }
      
    } catch (error) {
      addDebugStep('Email Check', 'error', 'Could not find or open Latenode email', null, error.message);
      throw new Error(`Email check failed: ${error.message}`);
    }
    
    // Step 7: Switch back to Latenode tab and enter confirmation code
    addDebugStep('Code Entry', 'info', 'Switching back to Latenode tab to enter confirmation code...');
    
    // Switch back to the original Latenode page
    await page.bringToFront();
    await sleep(2000);
    
    // Find and fill the confirmation code field
    addDebugStep('Code Entry', 'info', `Entering confirmation code: ${confirmationCode}`);
    
    await page.evaluate((code) => {
      const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i]');
      if (codeInput) {
        codeInput.focus();
        codeInput.value = '';
        codeInput.value = code;
        
        // Trigger events
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
        codeInput.dispatchEvent(new Event('change', { bubbles: true }));
        codeInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, confirmationCode);
    
    await sleep(1000);
    await takeScreenshot('Code-Entered', page);
    
    // Click Verify button
    addDebugStep('Code Entry', 'info', 'Looking for Verify button...');
    
    try {
      await page.waitForSelector('button:has-text("Verify"), button:has-text("Vérifier"), button[type="submit"]', { timeout: 10000 });
      await page.click('button:has-text("Verify"), button:has-text("Vérifier"), button[type="submit"]');
      addDebugStep('Code Entry', 'success', 'Clicked Verify button');
      
      // Wait for page to update to password creation
      await page.waitForFunction(() => {
        return document.querySelector('input[type="password"], input[name="password"]') !== null;
      }, { timeout: 15000 });
      
      addDebugStep('Code Entry', 'success', 'Page updated to password creation step');
      await takeScreenshot('Password-Creation-Page', page);
      
    } catch (error) {
      addDebugStep('Code Entry', 'error', '❌ CRITICAL: Could not find Verify button or page did not update - stopping process', null, error.message);
      throw new Error(`Code verification failed: ${error.message}`);
    }
    
    // Step 8: Fill in password fields
    addDebugStep('Password Entry', 'info', 'Filling in password fields...');
    
    await page.evaluate((password) => {
      // Fill first password field
      const passwordInput = document.querySelector('input[name="password"], input[data-test-id="passwordInput"]');
      if (passwordInput) {
        passwordInput.focus();
        passwordInput.value = '';
        passwordInput.value = password;
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Fill second password field
      const confirmPasswordInput = document.querySelector('input[name="newPassword"], input[data-test-id="newPasswordInput"]');
      if (confirmPasswordInput) {
        confirmPasswordInput.focus();
        confirmPasswordInput.value = '';
        confirmPasswordInput.value = password;
        confirmPasswordInput.dispatchEvent(new Event('input', { bubbles: true }));
        confirmPasswordInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, generatedPassword);
    
    await sleep(1000);
    await takeScreenshot('Password-Entered', page);
    
    // Step 9: Click Register/Sign Up button
    addDebugStep('Registration', 'info', 'Looking for Register/Sign Up button...');
    
    try {
      await page.waitForSelector('button:has-text("Register"), button:has-text("Sign Up"), button:has-text("Enregistrer"), button[type="submit"]', { timeout: 10000 });
      await page.click('button:has-text("Register"), button:has-text("Sign Up"), button:has-text("Enregistrer"), button[type="submit"]');
      addDebugStep('Registration', 'success', 'Clicked Register button');
      
      // Wait for successful registration or dashboard
      await page.waitForFunction(() => {
        const url = window.location.href;
        return url.includes('dashboard') || url.includes('home') || url.includes('projects') || 
               document.querySelector('[class*="dashboard"], [class*="welcome"], [class*="success"]') !== null;
      }, { timeout: 30000 });
      
      addDebugStep('Registration', 'success', 'Successfully registered and reached dashboard');
      await takeScreenshot('Registration-Success', page);
      
    } catch (error) {
      addDebugStep('Registration', 'error', '❌ CRITICAL: Could not find Register button or registration failed - stopping process', null, error.message);
      throw new Error(`Registration failed: ${error.message}`);
    }
    
    addDebugStep('Account Creation', 'success', '✅ Latenode account creation process completed successfully!');
    addDebugStep('Account Creation', 'info', `📧 Email: ${tempEmail}`);
    addDebugStep('Account Creation', 'info', `🔑 Password: ${generatedPassword}`);
    addDebugStep('Account Creation', 'info', `🔢 Confirmation Code: ${confirmationCode}`);
    
    return {
      success: true,
      tempEmail: tempEmail,
      password: generatedPassword,
      confirmationCode: confirmationCode,
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
