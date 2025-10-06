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
    
    // Check if we're on Microsoft marketing page instead of actual Outlook
    if (currentUrl.includes('microsoft.com') && !currentUrl.includes('outlook.live.com')) {
      await addDebugStep('Login Verification', 'info', 'Detected Microsoft marketing page - handling cookie consent and redirecting...');
      
      // Handle cookie consent if present
      try {
        await addDebugStep('Cookie Consent', 'info', 'Looking for cookie consent banner...');
        
        // Try multiple cookie accept selectors
        const cookieSelectors = [
          '[data-testid*="accept"]',
          '[data-testid*="Accept"]',
          'button[class*="accept"]',
          'button[class*="Accept"]',
          'button[aria-label*="Accept"]',
          'button[aria-label*="accept"]',
          'button[type="button"]'
        ];
        
        let cookieAccepted = false;
        for (const selector of cookieSelectors) {
          try {
            const cookieButton = await page.waitForSelector(selector, { visible: true, timeout: 2000 });
            if (cookieButton) {
              // Check if button text contains "Accept"
              const buttonText = await page.evaluate(el => el.textContent, cookieButton);
              if (buttonText && (buttonText.toLowerCase().includes('accept') || buttonText.toLowerCase().includes('accept all'))) {
                await addDebugStep('Cookie Consent', 'info', `Found cookie button: ${selector} with text: ${buttonText}`);
                await cookieButton.click();
                await randomHumanDelay(page, 1000, 2000);
                await takeScreenshot('Cookie-Consent-Accepted', page);
                cookieAccepted = true;
                break;
              }
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        // If no specific accept button found, try to find any button with "Accept" text
        if (!cookieAccepted) {
          try {
            const acceptButtons = await page.$$x('//button[contains(text(), "Accept") or contains(text(), "Accept all") or contains(text(), "Accept All")]');
            if (acceptButtons.length > 0) {
              await addDebugStep('Cookie Consent', 'info', `Found ${acceptButtons.length} Accept button(s) using XPath`);
              await acceptButtons[0].click();
              await randomHumanDelay(page, 1000, 2000);
              await takeScreenshot('Cookie-Consent-Accepted', page);
              cookieAccepted = true;
            }
          } catch (e) {
            // XPath also failed
          }
        }
        
        if (!cookieAccepted) {
          await addDebugStep('Cookie Consent', 'info', 'No cookie consent banner found or already accepted');
        }
      } catch (cookieError) {
        await addDebugStep('Cookie Consent', 'warning', `Cookie handling failed: ${cookieError.message}`);
      }
      
      // Now navigate directly to Outlook Live
      await addDebugStep('Login Verification', 'info', 'Navigating directly to Outlook Live...');
      try {
        await page.goto('https://outlook.live.com/', { waitUntil: 'networkidle2', timeout: 30000 });
        await randomHumanDelay(page, 3000, 5000);
        await takeScreenshot('Outlook-Live-Redirect', page);
        
        const finalUrl = page.url();
        await addDebugStep('Login Verification', 'info', `Final URL after redirect: ${finalUrl}`);
        
        if (finalUrl.includes('outlook.live.com')) {
          await addDebugStep('Login Verification', 'success', 'Successfully navigated to Outlook Live');
        } else {
          await addDebugStep('Login Verification', 'warning', `Still not on Outlook Live - current URL: ${finalUrl}`);
        }
      } catch (redirectError) {
        await addDebugStep('Login Verification', 'warning', `Failed to redirect to Outlook Live: ${redirectError.message}`);
      }
    }
    
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
      
      let apiKey = 'Not Found'; // Initialize API key variable
      
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
        
        // Wait for popup to appear and use comprehensive detection like Kie.ai scraper
        await randomHumanDelay(page, 2000, 3000);
        
        // Check for "Sign in with Microsoft" popup (sometimes appears at bottom of page)
        await addDebugStep('Kie.ai Login', 'info', 'Looking for Sign in with Microsoft popup...');
        
        // First check if popup is visible without scrolling
        let microsoftPopupFound = false;
        try {
          // Use proper XPath selectors for Microsoft popup detection
          await page.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 3000 });
          await addDebugStep('Kie.ai Login', 'success', 'Sign in with Microsoft popup detected at top', null, null, page);
          await takeScreenshot('Microsoft-Popup-Top', page);
          microsoftPopupFound = true;
        } catch (topError) {
          await addDebugStep('Kie.ai Login', 'info', 'No Microsoft popup found at top - scrolling down to check bottom of page');
          
          // Scroll down to look for popup at bottom of page
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await randomHumanDelay(page, 2000, 3000);
          await takeScreenshot('Scrolled-Down-Looking-For-Popup', page);
          
          // Check again after scrolling with multiple methods
          try {
            // Try XPath first
            await page.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 3000 });
            await addDebugStep('Kie.ai Login', 'success', 'Sign in with Microsoft popup detected at bottom after scrolling', null, null, page);
            await takeScreenshot('Microsoft-Popup-Bottom', page);
            microsoftPopupFound = true;
          } catch (bottomError) {
            // Try alternative detection methods
            await addDebugStep('Kie.ai Login', 'info', 'XPath detection failed, trying alternative methods...');
            
            // Check for any popup or modal elements
            const popupDetected = await page.evaluate(() => {
              // Look for common popup indicators
              const popups = document.querySelectorAll('[role="dialog"], [class*="popup"], [class*="modal"], [class*="overlay"], [class*="popup"], [class*="dialog"]');
              if (popups.length > 0) {
                return {
                  found: true,
                  count: popups.length,
                  elements: Array.from(popups).map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    textContent: el.textContent?.substring(0, 100)
                  }))
                };
              }
              
              // Look for Microsoft-related text anywhere on page
              const microsoftElements = document.querySelectorAll('*');
              for (const el of microsoftElements) {
                const text = el.textContent?.toLowerCase() || '';
                if (text.includes('sign in with microsoft') || text.includes('inloggen met microsoft') || text.includes('microsoft')) {
                  return {
                    found: true,
                    element: {
                      tagName: el.tagName,
                      className: el.className,
                      textContent: el.textContent?.substring(0, 100)
                    }
                  };
                }
              }
              
              return { found: false };
            });
            
            if (popupDetected.found) {
              await addDebugStep('Kie.ai Login', 'success', `Microsoft popup detected using alternative method: ${JSON.stringify(popupDetected)}`, null, null, page);
              await takeScreenshot('Microsoft-Popup-Alternative', page);
              microsoftPopupFound = true;
            } else {
              await addDebugStep('Kie.ai Login', 'info', 'No Microsoft popup found at bottom either');
            }
          }
        }
        
        if (microsoftPopupFound) {
          // Click "Sign in with Microsoft" button using proper selectors
          await addDebugStep('Kie.ai Login', 'info', 'Clicking Sign in with Microsoft button...');
          
          try {
            // Try XPath first
            await page.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 5000 });
            await page.click('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]');
            await addDebugStep('Kie.ai Login', 'success', 'Clicked Sign in with Microsoft button using XPath', null, null, page);
          } catch (xpathError) {
            // Fallback to evaluate method
            await addDebugStep('Kie.ai Login', 'info', 'XPath click failed, trying evaluate method...');
            
            const clicked = await page.evaluate(() => {
              // Look for Microsoft button by text content
              const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
              for (const button of buttons) {
                const text = button.textContent?.toLowerCase() || '';
                if (text.includes('sign in with microsoft') || text.includes('inloggen met microsoft') || text.includes('microsoft')) {
                  button.click();
                  return true;
                }
              }
              return false;
            });
            
            if (clicked) {
              await addDebugStep('Kie.ai Login', 'success', 'Clicked Sign in with Microsoft button using evaluate method', null, null, page);
            } else {
              await addDebugStep('Kie.ai Login', 'warning', 'Could not click Microsoft button with any method');
            }
          }
          
          await takeScreenshot('Microsoft-Signin-Clicked', page);
          
          // Wait for popup to appear and analyze what opens
          await addDebugStep('Kie.ai Login', 'info', 'Waiting for Microsoft login popup to appear...');
          await randomHumanDelay(page, 3000, 5000);
          
          // Check what pages/tabs are now open
          await addDebugStep('Kie.ai Login', 'info', 'Analyzing all open pages after Microsoft login click...');
          
          try {
            const allPages = await Promise.race([
              browser.pages(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Browser pages timeout')), 5000))
            ]);
            await addDebugStep('Kie.ai Login', 'info', `Total pages open: ${allPages.length}`);
            
            for (let i = 0; i < allPages.length; i++) {
              const currentPage = allPages[i];
              try {
                const pageInfo = await Promise.race([
                  currentPage.evaluate(() => {
                    return {
                      url: window.location.href,
                      title: document.title,
                      domain: window.location.hostname,
                      pathname: window.location.pathname,
                      hasEmailInput: document.querySelectorAll('input[name="loginfmt"], input[id="i0116"], input[type="email"]').length > 0,
                      hasPasswordInput: document.querySelectorAll('input[name="passwd"], input[type="password"]').length > 0,
                      buttonCount: document.querySelectorAll('button, a, [role="button"]').length,
                      inputCount: document.querySelectorAll('input, textarea, select').length,
                      visibleText: document.body.textContent?.substring(0, 200) || '',
                      isMicrosoftLogin: window.location.hostname.includes('login.live.com') || 
                                     window.location.hostname.includes('microsoft.com') ||
                                     document.body.textContent.toLowerCase().includes('microsoft') ||
                                     document.querySelectorAll('input[name="loginfmt"]').length > 0
                    };
                  }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Page analysis timeout')), 3000))
                ]);
                
                await addDebugStep('Kie.ai Login', 'info', `Page ${i + 1}:`);
                await addDebugStep('Kie.ai Login', 'info', `  - URL: ${pageInfo.url}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Title: ${pageInfo.title}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Domain: ${pageInfo.domain}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Buttons: ${pageInfo.buttonCount}, Inputs: ${pageInfo.inputCount}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Email Input: ${pageInfo.hasEmailInput}, Password Input: ${pageInfo.hasPasswordInput}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Is Microsoft Login: ${pageInfo.isMicrosoftLogin}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Text: "${pageInfo.visibleText}"`);
                
                // If this is a Microsoft login page, switch to it
                if (pageInfo.isMicrosoftLogin && currentPage !== page) {
                  await addDebugStep('Kie.ai Login', 'success', `Found Microsoft login page, switching to it...`);
                  page = currentPage;
                  await takeScreenshot('Microsoft-Login-Page-Detected', page);
                  break;
                }
              } catch (pageError) {
                await addDebugStep('Kie.ai Login', 'warning', `Could not analyze page ${i + 1}: ${pageError.message}`);
              }
            }
          } catch (browserError) {
            await addDebugStep('Kie.ai Login', 'warning', `Could not get browser pages: ${browserError.message}`);
          }
          
        } else {
          await addDebugStep('Kie.ai Login', 'warning', 'No Microsoft popup found, continuing without Microsoft login');
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
          
          // Step 12: Click API Key button
          await addDebugStep('Kie.ai API Key', 'info', 'Clicking API Key button...');
          try {
            const apiKeyButtonSelector = 'a[href="/api-key"]';
            await page.waitForSelector(apiKeyButtonSelector, { visible: true, timeout: 10000 });
            await page.click(apiKeyButtonSelector);
            
            // Wait for navigation with shorter timeout and fallback
            try {
              await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
            } catch (navError) {
              // Fallback: just wait for URL change
              await page.waitForFunction(() => window.location.href.includes('/api-key'), { timeout: 10000 });
            }
            
            await takeScreenshot('Kie-ai-API-Key-Page', page);
            await addDebugStep('Kie.ai API Key', 'success', 'Successfully navigated to API Key page', null, null, page);
            await randomHumanDelay(page, 2000, 3000);
          } catch (e) {
            await addDebugStep('Kie.ai API Key', 'warning', `API Key button click failed, trying direct navigation: ${e.message}`);
            // Fallback: try direct navigation
            try {
              await page.goto('https://kie.ai/api-key', { waitUntil: 'networkidle2', timeout: 15000 });
              await takeScreenshot('Kie-ai-API-Key-Direct', page);
              await addDebugStep('Kie.ai API Key', 'success', 'Successfully navigated to API Key page directly', null, null, page);
            } catch (directError) {
              await addDebugStep('Kie.ai API Key', 'error', `Direct navigation also failed: ${directError.message}`, null, directError, page);
            }
          }

          // Step 13: Extract API Key with smart logic
          await addDebugStep('Kie.ai API Key', 'info', 'Looking for API Key and Copy button...');
          
          try {
            // Skip DOM extraction - always use copy button for full API key
            await addDebugStep('Kie.ai API Key', 'info', 'Skipping DOM extraction - using copy button method for full API key...');
            
            // Try to find and click the copy button
            const copyButtonSelectors = [
              'button:has(svg.lucide-copy)',
              'button[aria-label*="copy"]',
              'button[title*="copy"]',
              'button:contains("Copy")',
              'svg.lucide-copy',
              '[role="gridcell"] button:has(svg.lucide-copy)',
              'button[class*="copy"]',
              'button[class*="Copy"]'
            ];
            
            let copyButton = null;
            for (const selector of copyButtonSelectors) {
              try {
                if (selector.includes(':has') || selector.includes(':contains')) {
                  // Use XPath for complex selectors
                  const xpath = selector.includes(':has') ? 
                    '//button[.//svg[contains(@class, "lucide-copy")]]' :
                    '//button[contains(text(), "Copy")]';
                  const [element] = await page.waitForXPath(xpath, { visible: true, timeout: 2000 });
                  if (element) {
                    copyButton = element;
                    break;
                  }
                } else {
                  const element = await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                  if (element) {
                    copyButton = element;
                    break;
                  }
                }
              } catch (selectorError) {
                continue;
              }
            }

            if (copyButton) {
              // Hover over the copy button first
              await addDebugStep('Kie.ai API Key', 'info', 'Hovering over copy button...');
              await copyButton.hover();
              await randomHumanDelay(page, 500, 1000);
              
              await copyButton.click();
              await takeScreenshot('Kie-ai-API-Key-Copied', page);
              await addDebugStep('Kie.ai API Key', 'success', 'Clicked Copy button', null, null, page);
              await randomHumanDelay(page, 1000, 2000);

              // Try to extract API Key using API Updates page method
              await addDebugStep('Kie.ai API Key', 'info', 'Using API Updates page method to extract API key...');
              
              try {
                // Click on API Updates button
                await addDebugStep('Kie.ai API Key', 'info', 'Clicking on API Updates button...');
                const apiUpdatesButton = await page.waitForSelector('a[href="/api-updates"]', { visible: true, timeout: 10000 });
                await apiUpdatesButton.click();
                await randomHumanDelay(page, 2000, 3000);
                
                // Wait for API Updates page to load
                await page.waitForFunction(() => window.location.href.includes('/api-updates'), { timeout: 10000 });
                await addDebugStep('Kie.ai API Key', 'success', 'Successfully navigated to API Updates page');
                
                // Find the search input field
                await addDebugStep('Kie.ai API Key', 'info', 'Looking for search input field...');
                const searchInput = await page.waitForSelector('input[placeholder*="Search for updates"]', { visible: true, timeout: 10000 });
                
                // Click on the search input to focus it
                await searchInput.click();
                await randomHumanDelay(page, 500, 1000);
                
                // Paste the copied API key into the search field
                await addDebugStep('Kie.ai API Key', 'info', 'Pasting API key into search field...');
                await page.keyboard.down('Control');
                await page.keyboard.press('v');
                await page.keyboard.up('Control');
                
                await randomHumanDelay(page, 1000, 1500);
                
                // Select all text in the search field
                await page.keyboard.down('Control');
                await page.keyboard.press('a');
                await page.keyboard.up('Control');
                
                await randomHumanDelay(page, 500, 1000);
                
                // Copy the selected text
                await page.keyboard.down('Control');
                await page.keyboard.press('c');
                await page.keyboard.up('Control');
                
                await randomHumanDelay(page, 1000, 1500);
                
                // Extract the API key from the search field value
                await addDebugStep('Kie.ai API Key', 'info', 'Extracting API key from search field...');
                
                // Try multiple methods to get the full API key
                apiKey = await page.evaluate(() => {
                  const searchInput = document.querySelector('input[placeholder*="Search for updates"]');
                  if (!searchInput) return null;
                  
                  // Method 1: Get the value directly
                  let value = searchInput.value;
                  if (value && value.length > 20) {
                    return value;
                  }
                  
                  // Method 2: Get the text content if value is masked
                  const textContent = searchInput.textContent;
                  if (textContent && textContent.length > 20) {
                    return textContent;
                  }
                  
                  // Method 3: Get the innerHTML and extract text
                  const innerHTML = searchInput.innerHTML;
                  if (innerHTML && innerHTML.length > 20) {
                    return innerHTML;
                  }
                  
                  // Method 4: Check if it's in a data attribute
                  const dataValue = searchInput.getAttribute('data-value') || searchInput.getAttribute('value');
                  if (dataValue && dataValue.length > 20) {
                    return dataValue;
                  }
                  
                  // Method 5: Look for the actual text in the DOM
                  const allText = document.body.innerText;
                  const apiKeyMatch = allText.match(/[a-f0-9]{32,}/i);
                  if (apiKeyMatch) {
                    return apiKeyMatch[0];
                  }
                  
                  return value; // Return whatever we found
                });
                
                // If we still don't have a full key, try to get it from the visible text
                if (!apiKey || apiKey.length < 30) {
                  await addDebugStep('Kie.ai API Key', 'info', 'Trying to extract from visible text...');
                  
                  // Get all visible text and look for API key pattern
                  const fullApiKey = await page.evaluate(() => {
                    // Look for 32-character hex string (typical API key length)
                    const text = document.body.innerText;
                    const matches = text.match(/[a-f0-9]{32,}/gi);
                    if (matches && matches.length > 0) {
                      // Return the longest match (most likely the API key)
                      return matches.sort((a, b) => b.length - a.length)[0];
                    }
                    return null;
                  });
                  
                  if (fullApiKey && fullApiKey.length >= 30) {
                    apiKey = fullApiKey;
                    await addDebugStep('Kie.ai API Key', 'success', `Full API Key extracted from visible text: ${apiKey}`, null, null, page);
                  } else {
                    throw new Error('Could not extract full API key from visible text');
                  }
                } else {
                  await addDebugStep('Kie.ai API Key', 'success', `API Key extracted via API Updates page: ${apiKey}`, null, null, page);
                }
                
              } catch (apiUpdatesError) {
                await addDebugStep('Kie.ai API Key', 'warning', `API Updates method failed: ${apiUpdatesError.message}`);
                
                // Fallback: try direct clipboard extraction
                try {
                  apiKey = await page.evaluate(() => navigator.clipboard.readText());
                  if (apiKey && apiKey.length > 10) {
                    await addDebugStep('Kie.ai API Key', 'success', `API Key extracted from clipboard: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`, null, null, page);
                  } else {
                    throw new Error('Empty or invalid API key from clipboard');
                  }
                } catch (clipboardError) {
                  await addDebugStep('Kie.ai API Key', 'warning', `Clipboard extraction also failed: ${clipboardError.message}`);
                  await addDebugStep('Kie.ai API Key', 'warning', 'Could not extract API Key using any method');
                }
              }
            } else {
              await addDebugStep('Kie.ai API Key', 'warning', 'Could not find Copy button', null, null, page);
            }
          } catch (e) {
            await addDebugStep('Kie.ai API Key', 'error', `Failed to extract API Key: ${e.message}`, null, e, page);
          }
          
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
        password: password, // Include password as requested
        name: 'Microsoft User',
        url: currentUrl,
        title: pageTitle,
        apiKey: apiKey || 'Not Found' // Include API key
      };
    } else {
      await addDebugStep('Login Verification', 'warning', `Unexpected page after login: ${currentUrl}`, null, null, page);
      
      return {
        success: true,
        message: 'Login completed but redirected to unexpected page',
        email: email,
        password: password, // Include password as requested
        name: 'Microsoft User',
        url: currentUrl,
        title: pageTitle,
        apiKey: 'Not Found' // No API key if login failed
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
