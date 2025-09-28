const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getAIGuidance, executeAIAction } = require('./ai-guide');

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
    const filename = `recraft-ai-${screenshotCounter}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
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

async function scrapeRecraftWithAI(googleEmail, googlePassword) {
  let browser = null;
  let page = null;
  
  try {
    // Initialize debug steps
    debugSteps = [];
    screenshotCounter = 0;
    
    addDebugStep('Initialization', 'info', 'Starting AI-powered Recraft.ai scraper...');
    
    // Launch browser with Railway-compatible settings
    addDebugStep('Browser Launch', 'info', 'Launching browser with AI guidance...');
    
    try {
      browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode for Railway compatibility
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
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { width: 1366, height: 768 },
      ignoreDefaultArgs: ['--disable-extensions'],
      ignoreHTTPSErrors: true,
      timeout: 60000
    });
    
    addDebugStep('Browser Launch', 'success', 'Browser launched successfully');
    
    page = await browser.newPage();
    
    } catch (browserError) {
      addDebugStep('Browser Launch', 'error', 'Failed to launch browser', null, browserError.message);
      throw new Error(`Failed to launch browser: ${browserError.message}. This might be due to Railway's server environment limitations.`);
    }
    
    // Enhanced stealth settings
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    });
    
    addDebugStep('Browser Launch', 'success', 'Browser launched successfully');
    
    // Navigate to Recraft.ai login page
    addDebugStep('Navigation', 'info', 'Navigating to Recraft.ai login page...');
    await page.goto('https://www.recraft.ai/auth/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await sleep(3000);
    await takeScreenshot('Recraft.ai Login Page', page);
    
    addDebugStep('Navigation', 'success', 'Successfully navigated to Recraft.ai login page');
    
    // AI-Guided Scraping Loop
    let maxSteps = 20; // Prevent infinite loops
    let currentStep = 0;
    
    while (currentStep < maxSteps) {
      currentStep++;
      console.log(`\n🤖 AI-Guided Step ${currentStep}/${maxSteps}`);
      
      // Get current page information
      const pageInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]')).map(btn => ({
          text: (btn.innerText || btn.textContent || '').trim(),
          visible: btn.offsetParent !== null && !btn.disabled,
          id: btn.id || '',
          className: btn.className || ''
        }));
        
        return {
          url: window.location.href,
          title: document.title,
          buttons: buttons
        };
      });
      
      console.log('📊 Page Info:', {
        url: pageInfo.url,
        title: pageInfo.title,
        buttonsCount: pageInfo.buttons.length
      });
      
      // Take screenshot for AI analysis
      const screenshot = await page.screenshot({ fullPage: true });
      
      // Get AI guidance
      const aiResponse = await getAIGuidance(screenshot, pageInfo, `Step ${currentStep}`);
      
      // Log AI decision
      addDebugStep(`AI Step ${currentStep}`, 'info', 
        `AI Decision: ${aiResponse.action} - ${aiResponse.reason} (Confidence: ${aiResponse.confidence})`);
      
      // Check if we've reached the Recraft.ai dashboard
      if (pageInfo.url.includes('recraft.ai') && 
          (pageInfo.url.includes('/dashboard') || pageInfo.url.includes('/workspace') || 
           pageInfo.url.includes('/app') || pageInfo.url.includes('/home'))) {
        addDebugStep('Success', 'success', 'Successfully reached Recraft.ai dashboard!');
        await takeScreenshot('Recraft.ai Dashboard', page);
        
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
              
              const text = (button.innerText || button.textContent || '').trim();
              const lowerText = text.toLowerCase();
              const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
              const className = (button.className || '').toLowerCase();
              
              console.log('Checking button:', text, 'aria-label:', ariaLabel, 'class:', className);
              
              // Look for "Accept All" buttons in cookie popups (exact match first)
              if (text === 'Accept All' || lowerText === 'accept all') {
                button.click();
                closedCount++;
                console.log('Clicked Accept All button:', text);
                continue;
              }
              
              // Look for close buttons (X buttons) in popups
              if (text === '×' || text === '✕' || text === 'Close' || lowerText === 'close' || 
                  ariaLabel.includes('close') || className.includes('close')) {
                button.click();
                closedCount++;
                console.log('Closed popup with close button:', text);
                continue;
              }
              
              // Look for other accept buttons
              if (lowerText.includes('accept') || lowerText.includes('ok') || 
                  lowerText.includes('got it') || lowerText.includes('agree') || 
                  lowerText.includes('continue')) {
                button.click();
                closedCount++;
                console.log('Clicked Accept/OK button:', text);
                continue;
              }
              
              // Look for "Learn more" or similar buttons that might close popups
              if (lowerText.includes('learn more') || lowerText.includes('dismiss') ||
                  lowerText.includes('skip') || lowerText.includes('not now')) {
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
          
          // Click on "Create new project" button
          addDebugStep('Create Project', 'info', 'Looking for and clicking Create new project button...');
          
          try {
            // Wait a bit for the page to settle after popup handling
            await sleep(2000);
            
            // Look for and click the "Create new project" button
            const createProjectClicked = await page.evaluate(() => {
              // Get all buttons and clickable elements
              const allButtons = document.querySelectorAll('button, a, [role="button"], div[onclick]');
              
              for (const button of allButtons) {
                if (button.offsetParent === null) continue; // Skip hidden elements
                
                const text = (button.innerText || button.textContent || '').trim();
                const lowerText = text.toLowerCase();
                
                console.log('Checking create project button:', text);
                
                // Look for "Create new project" button (exact match)
                if (text === 'Create new project' || lowerText === 'create new project') {
                  button.click();
                  console.log('Clicked Create new project button:', text);
                  return true;
                }
                
                // Look for buttons containing "create" and "project"
                if (lowerText.includes('create') && lowerText.includes('project')) {
                  button.click();
                  console.log('Clicked Create project button (partial match):', text);
                  return true;
                }
                
                // Look for buttons containing "new project"
                if (lowerText.includes('new project')) {
                  button.click();
                  console.log('Clicked New project button:', text);
                  return true;
                }
              }
              
              return false;
            });
            
            if (createProjectClicked) {
              addDebugStep('Create Project', 'success', 'Successfully clicked Create new project button');
              await sleep(2000);
              await takeScreenshot('After Clicking Create Project', page);
            } else {
              addDebugStep('Create Project', 'warning', 'Could not find Create new project button');
            }
            
          } catch (error) {
            addDebugStep('Create Project', 'error', 'Error clicking Create new project button', null, error.message);
          }
          
        } catch (error) {
          addDebugStep('Popup Handling', 'warning', 'Error handling popups', null, error.message);
        }
        
        break;
      }
      
      // Check if we're stuck on auth pages
      if (pageInfo.url.includes('keycloak') || pageInfo.url.includes('auth') || 
          pageInfo.title.toLowerCase().includes('sign in') || pageInfo.title.toLowerCase().includes('login')) {
        addDebugStep('Auth Page', 'warning', 'Still on authentication page, continuing...');
      }
      
      // Execute AI action
      const actionSuccess = await executeAIAction(page, aiResponse);
      
      if (!actionSuccess && aiResponse.action === 'click') {
        addDebugStep(`AI Step ${currentStep}`, 'warning', 'AI action failed, trying fallback detection...');
        
        // Fallback: try to find and click any visible button
        const fallbackSuccess = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
          for (const button of buttons) {
            if (button.offsetParent !== null && !button.disabled) {
              button.click();
              return true;
            }
          }
          return false;
        });
        
        if (fallbackSuccess) {
          addDebugStep(`AI Step ${currentStep}`, 'success', 'Fallback button click successful');
        } else {
          addDebugStep(`AI Step ${currentStep}`, 'error', 'Both AI and fallback actions failed');
        }
      }
      
      // Wait for page changes
      await sleep(3000);
      
      // Take screenshot after action
      await takeScreenshot(`After AI Step ${currentStep}`, page);
    }
    
    if (currentStep >= maxSteps) {
      addDebugStep('Warning', 'warning', 'Reached maximum steps, stopping AI guidance');
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
      addDebugStep('Result', 'success', 'AI-guided Recraft.ai login completed successfully!');
    } else {
      addDebugStep('Result', 'warning', 'AI-guided login completed but may not have reached dashboard');
    }
    
    return {
      ok: true,
      success: isSuccess,
      finalUrl: finalUrl,
      finalTitle: finalTitle,
      steps: debugSteps,
      message: isSuccess ? 'AI-guided login successful!' : 'AI-guided login completed with warnings'
    };
    
  } catch (error) {
    addDebugStep('Error', 'error', 'AI-guided scraper failed', null, error.message);
    console.error('❌ AI-guided scraper error:', error);
    
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

module.exports = { scrapeRecraftWithAI };
