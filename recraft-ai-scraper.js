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
              
              // Wait for dashboard to fully load
              addDebugStep('Dashboard Loading', 'info', 'Waiting for dashboard to fully load...');
              
              try {
                // Wait for the dashboard content to load (look for specific elements)
                await page.waitForFunction(() => {
                  // Check if we're on a project page and content has loaded
                  const hasProjectContent = document.querySelector('[class*="project"], [class*="editor"], [class*="canvas"], [class*="workspace"]');
                  const hasLoadedContent = document.querySelector('[class*="loading"]') === null;
                  const hasMainContent = document.body.innerText.length > 1000; // Substantial content loaded
                  
                  return hasProjectContent || (hasLoadedContent && hasMainContent);
                }, { timeout: 30000 });
                
                addDebugStep('Dashboard Loading', 'success', 'Dashboard content loaded successfully');
                
                // Take another screenshot after content loads
                await sleep(2000);
                await takeScreenshot('Dashboard Fully Loaded', page);
                
              } catch (error) {
                addDebugStep('Dashboard Loading', 'warning', 'Dashboard loading timeout, continuing...', null, error.message);
              }
              
              // Try to close any remaining popups after dashboard loads
              addDebugStep('Final Popup Cleanup', 'info', 'Checking for any remaining popups...');
              
              try {
                const remainingPopupsClosed = await page.evaluate(() => {
                  let closedCount = 0;
                  
                  // Get all buttons on the page
                  const allButtons = document.querySelectorAll('button, a, [role="button"]');
                  
                  for (const button of allButtons) {
                    if (button.offsetParent === null) continue; // Skip hidden buttons
                    
                    const text = (button.innerText || button.textContent || '').trim();
                    const lowerText = text.toLowerCase();
                    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                    
                    // Look for "Accept All" buttons in cookie popups (exact match first)
                    if (text === 'Accept All' || lowerText === 'accept all') {
                      button.click();
                      closedCount++;
                      console.log('Clicked Accept All button (final cleanup):', text);
                      continue;
                    }
                    
                    // Look for close buttons
                    if (text === '×' || text === '✕' || text === 'Close' || lowerText === 'close' || 
                        ariaLabel.includes('close')) {
                      button.click();
                      closedCount++;
                      console.log('Closed popup (final cleanup):', text);
                      continue;
                    }
                  }
                  
                  return closedCount;
                });
                
                if (remainingPopupsClosed > 0) {
                  addDebugStep('Final Popup Cleanup', 'success', `Closed ${remainingPopupsClosed} remaining popup(s)`);
                  await sleep(1000);
                  await takeScreenshot('After Final Popup Cleanup', page);
                } else {
                  addDebugStep('Final Popup Cleanup', 'info', 'No remaining popups found');
                }
                
              } catch (error) {
                addDebugStep('Final Popup Cleanup', 'warning', 'Error in final popup cleanup', null, error.message);
              }
              
              // Click on "Accept All" for privacy policy - TARGET SPECIFIC BUTTON
              addDebugStep('Privacy Accept', 'info', 'TARGETING SPECIFIC BUTTON: button.dg-button.accept_all');
              
              try {
                // Wait for privacy popup to appear
                await sleep(3000);
                
                // Take screenshot to see current state
                await takeScreenshot('Before Privacy Popup Handling', page);
                
                let privacyAccepted = false;
                
                // Method 1: Direct click on specific button using Puppeteer
                addDebugStep('Privacy Accept', 'info', 'Method 1: Direct click on button.dg-button.accept_all...');
                try {
                  await page.waitForSelector('button.dg-button.accept_all', { visible: true, timeout: 5000 });
                  await page.click('button.dg-button.accept_all');
                  privacyAccepted = true;
                  addDebugStep('Privacy Accept', 'success', 'Successfully clicked specific Accept All button via Puppeteer');
                  await sleep(3000);
                  await takeScreenshot('After Direct Accept All Click', page);
                } catch (error) {
                  addDebugStep('Privacy Accept', 'warning', `Direct click failed: ${error.message}`);
                }
                
                // Method 2: If direct click failed, try page.evaluate with specific selector
                if (!privacyAccepted) {
                  addDebugStep('Privacy Accept', 'info', 'Method 2: Using page.evaluate with specific selector...');
                  privacyAccepted = await page.evaluate(() => {
                    const specificButton = document.querySelector('button.dg-button.accept_all');
                    if (specificButton && specificButton.offsetParent !== null) {
                      console.log('Found specific button:', specificButton);
                      specificButton.click();
                      return true;
                    }
                    console.log('Specific button not found or not visible');
                    return false;
                  });
                  
                  if (privacyAccepted) {
                    addDebugStep('Privacy Accept', 'success', 'Successfully clicked specific Accept All button via page.evaluate');
                    await sleep(3000);
                    await takeScreenshot('After Evaluate Accept All Click', page);
                  }
                }
                
                // Method 3: Fallback - look for any button with "Accept All" text
                if (!privacyAccepted) {
                  addDebugStep('Privacy Accept', 'info', 'Method 3: Fallback - looking for any Accept All button...');
                  privacyAccepted = await page.evaluate(() => {
                    const allButtons = document.querySelectorAll('button');
                    console.log('All buttons found:', allButtons.length);
                    
                    for (const button of allButtons) {
                      if (button.offsetParent === null) continue;
                      const text = (button.innerText || button.textContent || '').trim();
                      console.log('Button text:', text, 'classes:', button.className);
                      
                      if (text === 'Accept All') {
                        console.log('Found Accept All button:', button);
                        button.click();
                        return true;
                      }
                    }
                    return false;
                  });
                  
                  if (privacyAccepted) {
                    addDebugStep('Privacy Accept', 'success', 'Successfully clicked Accept All button (fallback)');
                    await sleep(3000);
                    await takeScreenshot('After Fallback Accept All Click', page);
                  } else {
                    addDebugStep('Privacy Accept', 'error', 'Could not find or click any Accept All button');
                    await takeScreenshot('Accept All Button Not Found', page);
                  }
                }
                
                // Verify privacy popup is closed
                if (privacyAccepted) {
                  const popupStillVisible = await page.evaluate(() => {
                    // Check if the specific button is still visible
                    const specificButton = document.querySelector('button.dg-button.accept_all');
                    const privacyText = document.body.innerText.toLowerCase();
                    return (specificButton && specificButton.offsetParent !== null) || 
                           privacyText.includes('privacy settings') || 
                           privacyText.includes('accept all') || 
                           privacyText.includes('cookies');
                  });
                  
                  if (popupStillVisible) {
                    addDebugStep('Privacy Accept', 'warning', 'Privacy popup may still be visible');
                  } else {
                    addDebugStep('Privacy Accept', 'success', 'Privacy popup successfully closed');
                  }
                }
                
              } catch (error) {
                addDebugStep('Privacy Accept', 'error', 'Error clicking Accept All button', null, error.message);
              }
              
              // CRITICAL: Force close any remaining popups before proceeding
              addDebugStep('Force Popup Close', 'info', 'Force closing any remaining popups...');
              try {
                // Try multiple aggressive methods to close popups
                const popupClosed = await page.evaluate(() => {
                  // Method 1: Click any visible "Accept All" button
                  const acceptButtons = document.querySelectorAll('button[class*="accept"], button:contains("Accept All"), button:contains("Accept")');
                  for (const btn of acceptButtons) {
                    if (btn.offsetParent !== null) {
                      btn.click();
                      console.log('Clicked accept button:', btn);
                      return true;
                    }
                  }
                  
                  // Method 2: Click any close buttons (X, Close, etc.)
                  const closeButtons = document.querySelectorAll('button[class*="close"], button:contains("×"), button:contains("✕"), [aria-label*="close"]');
                  for (const btn of closeButtons) {
                    if (btn.offsetParent !== null) {
                      btn.click();
                      console.log('Clicked close button:', btn);
                      return true;
                    }
                  }
                  
                  // Method 3: Press Escape key
                  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
                  console.log('Pressed Escape key');
                  
                  return false;
                });
                
                if (popupClosed) {
                  addDebugStep('Force Popup Close', 'success', 'Successfully closed popup');
                  await sleep(2000);
                  await takeScreenshot('After Force Popup Close', page);
                }
              } catch (error) {
                addDebugStep('Force Popup Close', 'warning', 'Error force closing popup', null, error.message);
              }
              
              // Check if privacy popup is closed
              addDebugStep('Privacy Check', 'info', 'Checking if privacy popup is closed before proceeding...');
              const privacyPopupClosed = await page.evaluate(() => {
                const privacyText = document.body.innerText.toLowerCase();
                const hasPrivacyPopup = privacyText.includes('privacy settings') || 
                                       privacyText.includes('accept all') || 
                                       privacyText.includes('cookies') ||
                                       document.querySelector('[class*="privacy"], [class*="cookie"], [class*="popup"], [class*="modal"]') !== null;
                return !hasPrivacyPopup;
              });
              
              if (!privacyPopupClosed) {
                addDebugStep('Privacy Check', 'warning', 'Privacy popup may still be visible - continuing anyway');
                await takeScreenshot('Privacy Popup May Still Be Visible', page);
              } else {
                addDebugStep('Privacy Check', 'success', 'Privacy popup is closed - proceeding with next steps');
              }
              
              // Click on the "Image" icon
              addDebugStep('Image Icon', 'info', 'Looking for and clicking Image icon...');
              
              try {
                const imageIconClicked = await page.evaluate(() => {
                  // First try to find by data-testid (most reliable)
                  const imageButton = document.querySelector('button[data-testid="new-raster"]');
                  if (imageButton && imageButton.offsetParent !== null) {
                    imageButton.click();
                    console.log('Clicked Image button by data-testid');
                    return true;
                  }
                  
                  // Fallback: Get all clickable elements
                  const allElements = document.querySelectorAll('button, a, [role="button"], div[onclick]');
                  
                  for (const element of allElements) {
                    if (element.offsetParent === null) continue; // Skip hidden elements
                    
                    const text = (element.innerText || element.textContent || '').trim();
                    const lowerText = text.toLowerCase();
                    const className = element.className || '';
                    const tagName = element.tagName.toLowerCase();
                    const testId = element.getAttribute('data-testid');
                    
                    console.log('Checking image element:', text, 'tag:', tagName, 'class:', className, 'testid:', testId);
                    
                    // Look for "Image" text (exact match)
                    if (text === 'Image' || lowerText === 'image') {
                      // Check if it's clickable or in a clickable container
                      const isClickable = element.onclick || element.getAttribute('role') === 'button' || 
                                        tagName === 'button' || tagName === 'a' || 
                                        element.closest('button, a, [role="button"], [onclick]');
                      
                      if (isClickable) {
                        element.click();
                        console.log('Clicked Image icon:', text);
                        return true;
                      }
                    }
                    
                    // Look for elements with image-related classes or attributes
                    if (className.includes('image') || element.getAttribute('data-type') === 'image' ||
                        element.getAttribute('data-name') === 'image' || testId === 'new-raster') {
                      element.click();
                      console.log('Clicked Image element by class/attribute/testid:', text);
                      return true;
                    }
                    
                    // Look for elements containing image icons (SVG, img tags)
                    const hasImageIcon = element.querySelector('svg, img') && text.toLowerCase().includes('image');
                    if (hasImageIcon) {
                      element.click();
                      console.log('Clicked Image element with icon:', text);
                      return true;
                    }
                  }
                  
                  return false;
                });
                
              if (imageIconClicked) {
                addDebugStep('Image Icon', 'success', 'Successfully clicked Image icon');
                await sleep(2000);
                await takeScreenshot('After Clicking Image Icon', page);

                // --- NEW STEP 1: Click "Recraft V3 Raw" button ---
                addDebugStep('Recraft V3 Raw Button', 'info', 'Looking for and clicking "Recraft V3 Raw" button...');
                try {
                  const recraftV3RawClicked = await page.evaluate(() => {
                    // First try to find by data-testid
                    const button = document.querySelector('button[data-testid="recraft-preset"]');
                    if (button && (button.innerText || button.textContent || '').includes('Recraft V3 Raw')) {
                      button.click();
                      console.log('Clicked "Recraft V3 Raw" button by data-testid.');
                      return true;
                    }
                    
                    // Fallback: search all buttons for "Recraft V3 Raw" text
                    const allButtons = document.querySelectorAll('button');
                    for (const btn of allButtons) {
                      if (btn.offsetParent === null) continue;
                      const text = (btn.innerText || btn.textContent || '').trim();
                      if (text.includes('Recraft V3 Raw')) {
                        btn.click();
                        console.log('Clicked "Recraft V3 Raw" button by text search:', text);
                        return true;
                      }
                    }
                    
                    return false;
                  });

                  if (recraftV3RawClicked) {
                    addDebugStep('Recraft V3 Raw Button', 'success', 'Clicked "Recraft V3 Raw" button successfully');
                    await sleep(3000); // Wait for the styles page to load
                    await takeScreenshot('After Recraft V3 Raw Click', page);

                    // --- NEW STEP 2: Click "Apply" button for "Photorealism" ---
                    addDebugStep('Photorealism Apply Button', 'info', 'Looking for and clicking "Apply" button for "Photorealism"...');
                    try {
                      // Wait for the styles page to load
                      await sleep(2000);
                      
                      const photorealismApplyClicked = await page.evaluate(() => {
                        let clicked = false;
                        
                        // Method 1: Find by class and text
                        const applyButtons = document.querySelectorAll('button.c-jilBjW');
                        for (const btn of applyButtons) {
                          if (btn.offsetParent === null) continue;
                          const text = (btn.innerText || btn.textContent || '').trim();
                          if (text === 'Apply') {
                            // Check if this Apply button is near a Photorealism element
                            const parent = btn.closest('div, section, article');
                            if (parent) {
                              const parentText = (parent.innerText || parent.textContent || '').toLowerCase();
                              if (parentText.includes('photorealism')) {
                                btn.click();
                                console.log('Clicked Apply button for Photorealism (method 1)');
                                clicked = true;
                                break;
                              }
                            }
                          }
                        }
                        
                        if (!clicked) {
                          // Method 2: Find Photorealism text first, then look for Apply button nearby
                          const photorealismElements = Array.from(document.querySelectorAll('*')).filter(el => {
                            if (el.offsetParent === null) return false;
                            const text = (el.innerText || el.textContent || '').trim();
                            return text === 'Photorealism';
                          });
                          
                          for (const photorealismEl of photorealismElements) {
                            // Look for Apply button in the same container or nearby
                            let container = photorealismEl.closest('div, section, article, [class*="card"], [class*="style"]');
                            if (!container) container = photorealismEl.parentElement;
                            
                            const applyBtn = container.querySelector('button');
                            if (applyBtn && (applyBtn.innerText || applyBtn.textContent || '').trim() === 'Apply') {
                              applyBtn.click();
                              console.log('Clicked Apply button for Photorealism (method 2)');
                              clicked = true;
                              break;
                            }
                          }
                        }
                        
                        return clicked;
                      });

                      if (photorealismApplyClicked) {
                        addDebugStep('Photorealism Apply Button', 'success', 'Clicked "Apply" button for "Photorealism" successfully');
                        await sleep(5000); // Wait for redirection/dashboard update
                        await takeScreenshot('After Photorealism Apply Click', page);

                        // --- NEW STEP 3: Adjust image count slider to 1 image ---
                        addDebugStep('Image Count Slider', 'info', 'Adjusting image count slider to 1 image...');
                        try {
                          const sliderAdjusted = await page.evaluate(() => {
                            // Find the range input for numberOfImages
                            const slider = document.querySelector('input[name="numberOfImages"][type="range"]');
                            if (slider) {
                              console.log('Found slider, current value:', slider.value);
                              
                              // Get slider dimensions
                              const rect = slider.getBoundingClientRect();
                              
                              // Method 1: Try clicking on the rounded button in the middle and dragging left
                              const currentPosition = rect.left + (rect.width * 0.75); // Current position (right side for value 2)
                              const targetPosition = rect.left + (rect.width * 0.25); // Target position (left side for value 1)
                              const centerY = rect.top + (rect.height / 2);
                              
                              // Simulate mouse down on current position (middle of slider)
                              const mouseDownEvent = new MouseEvent('mousedown', {
                                bubbles: true,
                                cancelable: true,
                                clientX: currentPosition,
                                clientY: centerY,
                                button: 0
                              });
                              
                              // Simulate mouse move to left (drag)
                              const mouseMoveEvent = new MouseEvent('mousemove', {
                                bubbles: true,
                                cancelable: true,
                                clientX: targetPosition,
                                clientY: centerY,
                                button: 0
                              });
                              
                              // Simulate mouse up at target position
                              const mouseUpEvent = new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                clientX: targetPosition,
                                clientY: centerY,
                                button: 0
                              });
                              
                              // Dispatch events in sequence to simulate drag
                              slider.dispatchEvent(mouseDownEvent);
                              slider.dispatchEvent(mouseMoveEvent);
                              slider.dispatchEvent(mouseUpEvent);
                              
                              // Set the value to 1 after dragging
                              slider.value = '1';
                              
                              // Trigger change events
                              const changeEvent = new Event('change', { bubbles: true });
                              const inputEvent = new Event('input', { bubbles: true });
                              slider.dispatchEvent(changeEvent);
                              slider.dispatchEvent(inputEvent);
                              
                              console.log('Dragged slider from right to left, new value:', slider.value);
                              return true;
                            }
                            console.log('Slider not found');
                            return false;
                          });

                          if (sliderAdjusted) {
                            addDebugStep('Image Count Slider', 'success', 'Successfully adjusted slider to 1 image');
                            
                            // Wait for UI to update visually
                            await sleep(3000);
                            
                            // Wait for the slider value to be visually updated
                            try {
                              await page.waitForFunction(() => {
                                const slider = document.querySelector('input[name="numberOfImages"][type="range"]');
                                return slider && slider.value === '1';
                              }, { timeout: 5000 });
                            } catch (error) {
                              console.log('Slider value verification timeout, continuing...');
                            }
                            
                            await takeScreenshot('After Slider Adjustment', page);

                            // --- NEW STEP 4: Input prompt text ---
                            addDebugStep('Prompt Input', 'info', 'Clicking on textarea and entering prompt...');
                            try {
                              const promptEntered = await page.evaluate(() => {
                                // Find the textarea
                                const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
                                if (textarea) {
                                  console.log('Found textarea, current value:', textarea.value);
                                  
                                  // Scroll to textarea to ensure it's visible
                                  textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  
                                  // Click on the textarea to focus it
                                  textarea.focus();
                                  textarea.click();
                                  
                                  // Clear and set longer prompt to avoid length error
                                  textarea.value = '';
                                  textarea.value = 'banana bread in kitchen with sun light';
                                  
                                  // Trigger multiple events to ensure UI updates
                                  const events = ['input', 'change', 'keyup', 'keydown', 'blur', 'focus'];
                                  events.forEach(eventType => {
                                    const event = new Event(eventType, { bubbles: true, cancelable: true });
                                    textarea.dispatchEvent(event);
                                  });
                                  
                                  // Also trigger React events if needed
                                  const reactEvent = new Event('input', { bubbles: true, cancelable: true });
                                  Object.defineProperty(reactEvent, 'target', { value: textarea, enumerable: true });
                                  textarea.dispatchEvent(reactEvent);
                                  
                                  console.log('Entered prompt: banana bread in kitchen with sun light, new value:', textarea.value);
                                  return true;
                                }
                                console.log('Textarea not found');
                                return false;
                              });

                              if (promptEntered) {
                                addDebugStep('Prompt Input', 'success', 'Successfully entered prompt: banana pancake');
                                await sleep(2000);
                                await takeScreenshot('After Prompt Input', page);

                                // Check if Generate button is now active
                                const generateButtonActive = await page.evaluate(() => {
                                  const generateBtn = document.querySelector('button[data-testid="recraft-button"]');
                                  if (generateBtn) {
                                    const isDisabled = generateBtn.disabled || generateBtn.classList.contains('disabled') || 
                                                     generateBtn.style.pointerEvents === 'none' || 
                                                     generateBtn.style.opacity === '0.5';
                                    const isClickable = !isDisabled && generateBtn.offsetParent !== null;
                                    console.log('Generate button state:', {
                                      disabled: generateBtn.disabled,
                                      classes: generateBtn.className,
                                      style: generateBtn.style.cssText,
                                      clickable: isClickable
                                    });
                                    return isClickable;
                                  }
                                  return false;
                                });

                                if (generateButtonActive) {
                                  addDebugStep('Generate Button Check', 'success', 'Generate button is now active and clickable');
                                } else {
                                  addDebugStep('Generate Button Check', 'warning', 'Generate button is still not active - may need to close privacy popup');
                                  
                                  // Try to close privacy popup one more time
                                  const popupClosed = await page.evaluate(() => {
                                    const allElements = document.querySelectorAll('button, [role="button"]');
                                    for (const element of allElements) {
                                      if (element.offsetParent === null) continue;
                                      const text = (element.innerText || element.textContent || '').trim();
                                      if (text === 'Accept All' || text.toLowerCase().includes('accept all')) {
                                        element.click();
                                        console.log('Clicked Accept All button (retry)');
                                        return true;
                                      }
                                    }
                                    return false;
                                  });
                                  
                                  if (popupClosed) {
                                    addDebugStep('Privacy Popup Retry', 'success', 'Closed privacy popup on retry');
                                    await sleep(2000);
                                    await takeScreenshot('After Privacy Popup Retry', page);
                                  }
                                }

                                // --- NEW STEP 5: Click Generate button ---
                                addDebugStep('Generate Images', 'info', 'Clicking Generate button...');
                                try {
                                  const generateClicked = await page.evaluate(() => {
                                    // Find the Generate button
                                    const generateBtn = document.querySelector('button[data-testid="recraft-button"]');
                                    if (generateBtn) {
                                      console.log('Found Generate button, clicking...');
                                      generateBtn.click();
                                      return true;
                                    }
                                    console.log('Generate button not found');
                                    return false;
                                  });

                                  if (generateClicked) {
                                    addDebugStep('Generate Images', 'success', 'Clicked Generate button');
                                    
                                    // Wait for generation to start
                                    await sleep(3000);
                                    await takeScreenshot('Generation Started', page);
                                    
                                    // Wait for generation to complete (look for generated images or completion indicators)
                                    addDebugStep('Generation Wait', 'info', 'Waiting for image generation to complete...');
                                    
                                    try {
                                      // Wait for either generated images to appear or generation to complete
                                      await page.waitForFunction(() => {
                                        // Look for generated images or completion indicators
                                        const hasImages = document.querySelectorAll('img[src*="recraft"], [class*="generated"], [class*="result"]').length > 0;
                                        const hasLoading = document.querySelector('[class*="loading"], [class*="generating"]') !== null;
                                        const hasProgress = document.querySelector('[class*="progress"], [class*="status"]') !== null;
                                        
                                        return hasImages || (!hasLoading && !hasProgress);
                                      }, { timeout: 60000 }); // Wait up to 60 seconds
                                      
                                      addDebugStep('Generation Wait', 'success', 'Image generation completed');
                                      await sleep(2000);
                                      await takeScreenshot('Generation Completed', page);
                                      
                                      // --- NEW STEP 6: Click on the generated image ---
                                      addDebugStep('Click Generated Image', 'info', 'Looking for and clicking on generated image...');
                                      try {
                                        const imageClicked = await page.evaluate(() => {
                                          // Look for generated images in the canvas area
                                          const images = document.querySelectorAll('img[src*="recraft"], [class*="generated"] img, [class*="result"] img, canvas img');
                                          for (const img of images) {
                                            if (img.offsetParent !== null) { // Visible image
                                              console.log('Found generated image, clicking...');
                                              img.click();
                                              return true;
                                            }
                                          }
                                          console.log('No generated image found to click');
                                          return false;
                                        });

                                        if (imageClicked) {
                                          addDebugStep('Click Generated Image', 'success', 'Successfully clicked on generated image');
                                          await sleep(2000);
                                          await takeScreenshot('After Clicking Image', page);
                                        } else {
                                          addDebugStep('Click Generated Image', 'warning', 'Could not find generated image to click');
                                        }
                                      } catch (error) {
                                        addDebugStep('Click Generated Image', 'error', 'Error clicking generated image', null, error.message);
                                      }
                                      
                                      // Try to get the generated image link
                                      const imageLink = await page.evaluate(() => {
                                        const images = document.querySelectorAll('img[src*="recraft"], [class*="generated"] img, [class*="result"] img');
                                        if (images.length > 0) {
                                          return images[0].src;
                                        }
                                        return null;
                                      });
                                      
                                      if (imageLink) {
                                        addDebugStep('Image Link', 'success', `Generated image link: ${imageLink}`);
                                      } else {
                                        addDebugStep('Image Link', 'warning', 'Could not find generated image link');
                                      }
                                      
                                    } catch (error) {
                                      addDebugStep('Generation Wait', 'warning', 'Generation timeout, continuing...', null, error.message);
                                      await takeScreenshot('Generation Timeout', page);
                                    }
                                  } else {
                                    addDebugStep('Generate Images', 'warning', 'Could not find Generate button');
                                  }
                                  
                                } catch (error) {
                                  addDebugStep('Generate Images', 'error', 'Error clicking Generate button', null, error.message);
                                }

                              } else {
                                addDebugStep('Prompt Input', 'warning', 'Could not find or interact with prompt textarea');
                                await takeScreenshot('Prompt Input Failed', page);
                              }
                            } catch (error) {
                              addDebugStep('Prompt Input', 'error', 'Error entering prompt', null, error.message);
                            }

                          } else {
                            addDebugStep('Image Count Slider', 'warning', 'Could not find or adjust image count slider');
                            await takeScreenshot('Slider Adjustment Failed', page);
                          }
                        } catch (error) {
                          addDebugStep('Image Count Slider', 'error', 'Error adjusting image count slider', null, error.message);
                        }

                      } else {
                        addDebugStep('Photorealism Apply Button', 'warning', 'Could not find or click "Apply" button for "Photorealism"');
                        await takeScreenshot('Photorealism Apply Failed', page);
                      }
                    } catch (error) {
                      addDebugStep('Photorealism Apply Button', 'error', 'Error clicking "Apply" button for "Photorealism"', null, error.message);
                    }

                  } else {
                    addDebugStep('Recraft V3 Raw Button', 'warning', 'Could not find or click "Recraft V3 Raw" button');
                  }
                } catch (error) {
                  addDebugStep('Recraft V3 Raw Button', 'error', 'Error clicking "Recraft V3 Raw" button', null, error.message);
                }

              } else {
                addDebugStep('Image Icon', 'warning', 'Could not find Image icon');
              }
                
              } catch (error) {
                addDebugStep('Image Icon', 'error', 'Error clicking Image icon', null, error.message);
              }
              
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
