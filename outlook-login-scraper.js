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
    
    // Wait for navigation after password submission
    try {
      await page.waitForNavigation({ timeout: 10000 });
      await takeScreenshot('Password-Next-Clicked', page);
      await addDebugStep('Password Entry', 'success', 'Next button clicked and navigated', null, null, page);
    } catch (navError) {
      addDebugStep('Password Entry', 'warning', `Navigation timeout: ${navError.message}`);
      // Try to take screenshot anyway
      try {
        await takeScreenshot('Password-Next-Clicked', page);
      } catch (screenshotError) {
        addDebugStep('Password Entry', 'warning', `Screenshot failed: ${screenshotError.message}`);
      }
    }
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 8: Handle "Stay signed in?" prompt
    addDebugStep('Stay Signed In', 'info', 'Handling stay signed in prompt...');
    
    try {
      // Look for "Yes" button
      await page.waitForSelector('button[type="submit"][data-testid="primaryButton"]', { timeout: 10000 });
      await page.click('button[type="submit"][data-testid="primaryButton"]');
      
      // Wait for navigation after stay signed in
      try {
        await page.waitForNavigation({ timeout: 10000 });
        await takeScreenshot('Stay-Signed-In-Yes', page);
        await addDebugStep('Stay Signed In', 'success', 'Stay signed in confirmed and navigated', null, null, page);
      } catch (navError) {
        addDebugStep('Stay Signed In', 'warning', `Navigation timeout: ${navError.message}`);
        // Try to take screenshot anyway
        try {
          await takeScreenshot('Stay-Signed-In-Yes', page);
        } catch (screenshotError) {
          addDebugStep('Stay Signed In', 'warning', `Screenshot failed: ${screenshotError.message}`);
        }
      }
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
    try {
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 });
    } catch (e) {
      addDebugStep('Login Verification', 'warning', `Page load timeout: ${e.message}`);
    }
    
    // Take final screenshot to verify login state
    await takeScreenshot('Login-Final-Verification', page);
    
    // Try to navigate to Outlook specifically
    addDebugStep('Login Verification', 'info', 'Attempting to navigate to Outlook...');
    try {
      await page.goto('https://outlook.com', { waitUntil: 'networkidle2', timeout: 30000 });
      await takeScreenshot('Outlook-Redirect', page);
      await addDebugStep('Login Verification', 'success', 'Successfully navigated to Outlook', null, null, page);
    } catch (outlookError) {
      addDebugStep('Login Verification', 'warning', `Could not navigate to Outlook: ${outlookError.message}`);
    }
    
    // Check if we're on a Microsoft dashboard or Outlook
    const currentUrl = page.url();
    const pageTitle = await page.title();
    
    addDebugStep('Login Verification', 'info', `Current URL: ${currentUrl}`);
    addDebugStep('Login Verification', 'info', `Page Title: ${pageTitle}`);
    
    // Check for login success indicators
    const isLoggedIn = currentUrl.includes('office.com') || 
                      currentUrl.includes('outlook.com') || 
                      currentUrl.includes('m365.cloud.microsoft') ||
                      currentUrl.includes('portal.office.com') ||
                      pageTitle.toLowerCase().includes('outlook') || 
                      pageTitle.toLowerCase().includes('microsoft') ||
                      pageTitle.toLowerCase().includes('office');
    
    if (isLoggedIn) {
      await addDebugStep('Login Verification', 'success', 'Successfully logged into Microsoft account!', null, null, page);
      
      // Step 11: Navigate to Kie.ai and login
      await addDebugStep('Kie.ai Login', 'info', 'Starting Kie.ai login process...');
      
      try {
        // Navigate to Kie.ai
        await addDebugStep('Kie.ai Login', 'info', 'Navigating to Kie.ai...');
        await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
        await takeScreenshot('Kie-ai-Initial', page);
        await addDebugStep('Kie.ai Login', 'success', 'Successfully navigated to Kie.ai', null, null, page);
        
        // Wait for page to load
        await randomHumanDelay(page, 2000, 3000);
        
        // Click on "Get Started" button
        await addDebugStep('Kie.ai Login', 'info', 'Looking for Get Started button...');
        try {
          await page.waitForSelector('button:contains("Get Started")', { timeout: 10000 });
          await page.click('button:contains("Get Started")');
          await takeScreenshot('Get-Started-Clicked', page);
          await addDebugStep('Kie.ai Login', 'success', 'Clicked Get Started button', null, null, page);
        } catch (e) {
          // Try alternative selectors
          const getStartedSelectors = [
            'button[class*="Get Started"]',
            'a[class*="Get Started"]',
            '[data-testid*="get-started"]',
            'button:contains("Get Started")',
            'a:contains("Get Started")'
          ];
          
          let clicked = false;
          for (const selector of getStartedSelectors) {
            try {
              if (selector.includes(':contains')) {
                const xpath = selector.includes('button') ? 
                  '//button[contains(text(), "Get Started")]' : 
                  '//a[contains(text(), "Get Started")]';
                await page.waitForXPath(xpath, { timeout: 3000 });
                const [button] = await page.$x(xpath);
                if (button) {
                  await button.click();
                  clicked = true;
                  break;
                }
              } else {
                await page.waitForSelector(selector, { timeout: 3000 });
                await page.click(selector);
                clicked = true;
                break;
              }
            } catch (selectorError) {
              continue;
            }
          }
          
          if (clicked) {
            await takeScreenshot('Get-Started-Clicked', page);
            await addDebugStep('Kie.ai Login', 'success', 'Clicked Get Started button with alternative method', null, null, page);
          } else {
            await addDebugStep('Kie.ai Login', 'warning', 'Could not find Get Started button');
          }
        }
        
        // Wait for popup to appear
        await randomHumanDelay(page, 2000, 3000);
        
        // Look for "Sign in with Microsoft" button in popup
        await addDebugStep('Kie.ai Login', 'info', 'Looking for Sign in with Microsoft button...');
        try {
          await page.waitForSelector('button:contains("Sign in with Microsoft")', { timeout: 10000 });
          await page.click('button:contains("Sign in with Microsoft")');
          await takeScreenshot('Microsoft-Signin-Clicked', page);
          await addDebugStep('Kie.ai Login', 'success', 'Clicked Sign in with Microsoft button', null, null, page);
        } catch (e) {
          // Try alternative selectors for Microsoft button
          const microsoftSelectors = [
            'button[class*="microsoft"]',
            'button[data-testid*="microsoft"]',
            'button:contains("Sign in with Microsoft")',
            'button:contains("Se connecter avec Microsoft")',
            'button:contains("Microsoft")'
          ];
          
          let clicked = false;
          for (const selector of microsoftSelectors) {
            try {
              if (selector.includes(':contains')) {
                const xpath = '//button[contains(text(), "Sign in with Microsoft") or contains(text(), "Se connecter avec Microsoft") or contains(text(), "Microsoft")]';
                await page.waitForXPath(xpath, { timeout: 3000 });
                const [button] = await page.$x(xpath);
                if (button) {
                  await button.click();
                  clicked = true;
                  break;
                }
              } else {
                await page.waitForSelector(selector, { timeout: 3000 });
                await page.click(selector);
                clicked = true;
                break;
              }
            } catch (selectorError) {
              continue;
            }
          }
          
          if (clicked) {
            await takeScreenshot('Microsoft-Signin-Clicked', page);
            await addDebugStep('Kie.ai Login', 'success', 'Clicked Sign in with Microsoft button with alternative method', null, null, page);
          } else {
            await addDebugStep('Kie.ai Login', 'warning', 'Could not find Sign in with Microsoft button');
          }
        }
        
        // Wait for Microsoft consent page
        await randomHumanDelay(page, 3000, 5000);
        
        // Handle Microsoft consent page
        await addDebugStep('Kie.ai Login', 'info', 'Handling Microsoft consent page...');
        try {
          // Wait for consent page to load
          await page.waitForFunction(() => {
            return window.location.href.includes('account.live.com') || 
                   window.location.href.includes('login.live.com') ||
                   document.title.includes('Let this app access');
          }, { timeout: 15000 });
          
          await takeScreenshot('Microsoft-Consent-Page', page);
          await addDebugStep('Kie.ai Login', 'success', 'Microsoft consent page loaded', null, null, page);
          
          // Scroll down to find Accept button
          await addDebugStep('Kie.ai Login', 'info', 'Scrolling down to find Accept button...');
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await randomHumanDelay(page, 1000, 2000);
          
          // Look for Accept button
          await addDebugStep('Kie.ai Login', 'info', 'Looking for Accept button...');
          try {
            await page.waitForSelector('button[data-testid="appConsentPrimaryButton"]', { timeout: 10000 });
            await page.click('button[data-testid="appConsentPrimaryButton"]');
            await takeScreenshot('Accept-Button-Clicked', page);
            await addDebugStep('Kie.ai Login', 'success', 'Clicked Accept button', null, null, page);
          } catch (e) {
            // Try alternative selectors for Accept button
            const acceptSelectors = [
              'button:contains("Accept")',
              'button[type="submit"]',
              'button[class*="primary"]',
              'button[class*="accept"]'
            ];
            
            let clicked = false;
            for (const selector of acceptSelectors) {
              try {
                if (selector.includes(':contains')) {
                  const xpath = '//button[contains(text(), "Accept")]';
                  await page.waitForXPath(xpath, { timeout: 3000 });
                  const [button] = await page.$x(xpath);
                  if (button) {
                    await button.click();
                    clicked = true;
                    break;
                  }
                } else {
                  await page.waitForSelector(selector, { timeout: 3000 });
                  await page.click(selector);
                  clicked = true;
                  break;
                }
              } catch (selectorError) {
                continue;
              }
            }
            
            if (clicked) {
              await takeScreenshot('Accept-Button-Clicked', page);
              await addDebugStep('Kie.ai Login', 'success', 'Clicked Accept button with alternative method', null, null, page);
            } else {
              await addDebugStep('Kie.ai Login', 'warning', 'Could not find Accept button');
            }
          }
          
          // Wait for navigation back to Kie.ai
          await randomHumanDelay(page, 3000, 5000);
          
        } catch (consentError) {
          await addDebugStep('Kie.ai Login', 'warning', `Microsoft consent page handling failed: ${consentError.message}`);
        }
        
        // Switch back to Kie.ai page and handle human verification
        await addDebugStep('Kie.ai Login', 'info', 'Switching back to Kie.ai page...');
        try {
          // Get all open pages and find Kie.ai page
          const pages = await browser.pages();
          let kiePage = null;
          
          for (const p of pages) {
            try {
              const url = p.url();
              if (url.includes('kie.ai')) {
                kiePage = p;
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          if (kiePage) {
            page = kiePage;
            await takeScreenshot('Kie-ai-After-Consent', page);
            await addDebugStep('Kie.ai Login', 'success', 'Switched back to Kie.ai page', null, null, page);
          } else {
            // Navigate back to Kie.ai
            await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
            await takeScreenshot('Kie-ai-After-Consent', page);
            await addDebugStep('Kie.ai Login', 'success', 'Navigated back to Kie.ai page', null, null, page);
          }
          
          // Wait for human verification popup
          await addDebugStep('Kie.ai Login', 'info', 'Looking for human verification popup...');
          await randomHumanDelay(page, 2000, 3000);
          
          try {
            // Look for human verification checkbox
            await page.waitForSelector('div[id="checkbox"][role="checkbox"]', { timeout: 10000 });
            await page.click('div[id="checkbox"][role="checkbox"]');
            await takeScreenshot('Human-Verification-Checked', page);
            await addDebugStep('Kie.ai Login', 'success', 'Clicked human verification checkbox', null, null, page);
          } catch (e) {
            // Try alternative selectors for checkbox
            const checkboxSelectors = [
              'div[role="checkbox"]',
              'input[type="checkbox"]',
              'div[id*="checkbox"]',
              'div[aria-checked="false"]'
            ];
            
            let clicked = false;
            for (const selector of checkboxSelectors) {
              try {
                await page.waitForSelector(selector, { timeout: 3000 });
                await page.click(selector);
                clicked = true;
                break;
              } catch (selectorError) {
                continue;
              }
            }
            
            if (clicked) {
              await takeScreenshot('Human-Verification-Checked', page);
              await addDebugStep('Kie.ai Login', 'success', 'Clicked human verification checkbox with alternative method', null, null, page);
            } else {
              await addDebugStep('Kie.ai Login', 'warning', 'Could not find human verification checkbox');
            }
          }
          
          // Wait for login to complete
          await randomHumanDelay(page, 3000, 5000);
          
          // Navigate to dashboard
          await addDebugStep('Kie.ai Login', 'info', 'Navigating to Kie.ai dashboard...');
          await page.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2', timeout: 30000 });
          await takeScreenshot('Kie-ai-Dashboard', page);
          await addDebugStep('Kie.ai Login', 'success', 'Successfully navigated to Kie.ai dashboard', null, null, page);
          
        } catch (switchError) {
          await addDebugStep('Kie.ai Login', 'warning', `Failed to switch back to Kie.ai: ${switchError.message}`);
        }
        
      } catch (kieError) {
        await addDebugStep('Kie.ai Login', 'error', `Kie.ai login failed: ${kieError.message}`);
      }
      
      return {
        success: true,
        message: 'Successfully logged into Microsoft account and Kie.ai',
        email: email,
        name: 'Microsoft User',
        url: currentUrl,
        title: pageTitle
      };
    } else {
      await addDebugStep('Login Verification', 'warning', `Unexpected page after login: ${currentUrl}`, null, null, page);
      
      return {
        success: true,
        message: 'Login completed but redirected to unexpected page',
        email: email,
        name: 'Microsoft User',
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
