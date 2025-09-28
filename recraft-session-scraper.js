const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Global session storage
let activeSessions = {
  recraft: {
    browser: null,
    page: null,
    isLoggedIn: false,
    lastActivity: null,
    sessionId: null,
    userEmail: null
  }
};

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

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
  
  // Emit real-time log to connected clients
  if (global.io) {
    global.io.emit('scraper-log', stepData);
  }
  
  if (error) {
    console.error(`Error: ${error}`);
  }
}

async function takeScreenshot(description, pageInstance = null) {
  try {
    const currentPage = pageInstance || activeSessions.recraft.page;
    if (!currentPage) {
      addDebugStep(description, 'warning', 'No page instance available for screenshot');
      return null;
    }
    
    screenshotCounter++;
    const filename = `recraft-session-${screenshotCounter}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const filepath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    const screenshot = await currentPage.screenshot({ 
      fullPage: true,
      path: filepath 
    });
    
    addDebugStep(description, 'screenshot', `Screenshot saved: ${filename}`, `/screenshots/${filename}`);
    return screenshot;
  } catch (error) {
    addDebugStep(description, 'error', 'Failed to take screenshot', null, error.message);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if session is valid and not expired
function isSessionValid() {
  const session = activeSessions.recraft;
  if (!session.browser || !session.page || !session.lastActivity) {
    return false;
  }
  
  const now = Date.now();
  const timeSinceLastActivity = now - session.lastActivity;
  
  return timeSinceLastActivity < SESSION_TIMEOUT;
}

// Update session activity timestamp
function updateSessionActivity() {
  activeSessions.recraft.lastActivity = Date.now();
}

// Cleanup expired sessions
async function cleanupExpiredSessions() {
  const session = activeSessions.recraft;
  
  if (!isSessionValid() && session.browser) {
    try {
      addDebugStep('Session Cleanup', 'info', 'Cleaning up expired session...');
      await session.browser.close();
      activeSessions.recraft = {
        browser: null,
        page: null,
        isLoggedIn: false,
        lastActivity: null,
        sessionId: null,
        userEmail: null
      };
      addDebugStep('Session Cleanup', 'success', 'Expired session cleaned up');
    } catch (error) {
      addDebugStep('Session Cleanup', 'error', 'Error cleaning up session', null, error.message);
    }
  }
}

// Get or create browser session
async function getOrCreateSession(googleEmail, googlePassword, io = null) {
  // Make io available globally
  global.io = io;
  
  // Initialize debug steps
  debugSteps = [];
  screenshotCounter = 0;
  
  // Clean up expired sessions first
  await cleanupExpiredSessions();
  
  const session = activeSessions.recraft;
  
  // Check if we have a valid existing session
  if (isSessionValid() && session.isLoggedIn && session.userEmail === googleEmail) {
    addDebugStep('Session Check', 'success', `♻️ Reusing existing session for ${googleEmail}`);
    updateSessionActivity();
    
    try {
      // Verify the page is still accessible
      await session.page.evaluate(() => document.title);
      await takeScreenshot('Existing Session');
      
      return {
        browser: session.browser,
        page: session.page,
        isNewSession: false
      };
    } catch (error) {
      addDebugStep('Session Check', 'warning', 'Existing session is invalid, creating new one');
      // Fall through to create new session
    }
  }
  
  // Create new session
  addDebugStep('Session Creation', 'info', '🚀 Creating new browser session...');
  
  try {
    const browser = await puppeteer.launch({
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
    
    const page = await browser.newPage();
    
    // Basic stealth settings
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Store session
    activeSessions.recraft = {
      browser: browser,
      page: page,
      isLoggedIn: false,
      lastActivity: Date.now(),
      sessionId: `session_${Date.now()}`,
      userEmail: googleEmail
    };
    
    addDebugStep('Session Creation', 'success', 'New browser session created successfully');
    
    return {
      browser: browser,
      page: page,
      isNewSession: true
    };
    
  } catch (error) {
    addDebugStep('Session Creation', 'error', 'Failed to create browser session', null, error.message);
    throw new Error(`Failed to create browser session: ${error.message}`);
  }
}

// Login to Recraft.ai (only if not already logged in)
async function loginToRecraft(googleEmail, googlePassword, browser, page, isNewSession) {
  if (!isNewSession && activeSessions.recraft.isLoggedIn) {
    addDebugStep('Login Check', 'success', '✅ Already logged in to Recraft.ai');
    
    // Navigate directly to projects page if already logged in
    const currentUrl = await page.url();
    if (!currentUrl.includes('recraft.ai/projects')) {
      addDebugStep('Navigation', 'info', 'Navigating directly to Recraft.ai projects page...');
      await page.goto('https://www.recraft.ai/projects', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);
      await takeScreenshot('Projects Page Navigation');
    }
    
    // Verify we're actually logged in by checking for user elements
    try {
      await page.waitForFunction(() => {
        return document.querySelector('[class*="user"], [class*="profile"], [class*="avatar"]') !== null ||
               document.body.innerText.includes('Dashboard') ||
               document.body.innerText.includes('Create') ||
               document.body.innerText.includes('New');
      }, { timeout: 5000 });
      addDebugStep('Login Verification', 'success', '✅ Login verified - user elements found');
    } catch (error) {
      addDebugStep('Login Verification', 'warning', 'Login verification failed, may need to re-login');
      // Mark session as not logged in to force re-login
      activeSessions.recraft.isLoggedIn = false;
    }
    
    return true;
  }
  
  // Perform login process
  addDebugStep('Login Process', 'info', '🔐 Starting login process...');
  
  try {
    // Navigate to Recraft.ai login page
    addDebugStep('Navigation', 'info', 'Navigating to Recraft.ai login page...');
    await page.goto('https://recraft.ai/auth/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await sleep(3000);
    await takeScreenshot('Login Page');
    
    // Click Google login button
    addDebugStep('Google Button', 'info', 'Looking for Google login button...');
    await page.waitForSelector('a[data-provider="google"]', { timeout: 10000 });
    await page.click('a[data-provider="google"]');
    addDebugStep('Google Button', 'success', 'Clicked Google login button');
    
    await sleep(3000);
    await takeScreenshot('Google Login Page');
    
    // Fill Google email
    addDebugStep('Google Email', 'info', 'Filling Google email...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.click('input[type="email"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('input[type="email"]', googleEmail, { delay: 100 });
    addDebugStep('Google Email', 'success', 'Email filled successfully');
    
    await sleep(1000);
    await takeScreenshot('After Email');
    
    // Click Next button for email
    addDebugStep('Email Next', 'info', 'Clicking Next button for email...');
    await page.click('#identifierNext');
    await sleep(3000);
    await takeScreenshot('Password Page');
    
    // Fill Google password
    addDebugStep('Google Password', 'info', 'Filling Google password...');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', googlePassword, { delay: 100 });
    addDebugStep('Google Password', 'success', 'Password filled successfully');
    
    await sleep(1000);
    await takeScreenshot('After Password');
    
    // Click Next button for password
    addDebugStep('Password Next', 'info', 'Clicking Next button for password...');
    await page.click('#passwordNext');
    await sleep(5000);
    
    // Wait for redirect to Recraft.ai
    addDebugStep('Login Completion', 'info', 'Waiting for login completion...');
    await page.waitForFunction(() => {
      return window.location.href.includes('recraft.ai') && !window.location.href.includes('login');
    }, { timeout: 30000 });
    
    await sleep(3000);
    await takeScreenshot('Login Complete');
    
    // Mark session as logged in
    activeSessions.recraft.isLoggedIn = true;
    updateSessionActivity();
    
    addDebugStep('Login Process', 'success', '✅ Successfully logged in to Recraft.ai');
    return true;
    
  } catch (error) {
    addDebugStep('Login Process', 'error', 'Login failed', null, error.message);
    throw new Error(`Login failed: ${error.message}`);
  }
}

// Generate image using existing session
async function generateImageWithSession(prompt = 'banana bread in kitchen with sun light') {
  const session = activeSessions.recraft;
  const page = session.page;
  
  addDebugStep('Image Generation', 'info', `🎨 Starting image generation with prompt: "${prompt}"`);
  
  try {
    // Navigate to new project if not already there
    const currentUrl = await page.url();
    if (!currentUrl.includes('editor') && !currentUrl.includes('new')) {
      addDebugStep('Navigation', 'info', 'Navigating to new project...');
      
      // Handle privacy popup if present
      try {
        const acceptButton = await page.$('button.dg-button.accept_all');
        if (acceptButton) {
          await acceptButton.click();
          addDebugStep('Privacy Popup', 'success', 'Closed privacy popup');
          await sleep(2000);
        }
      } catch (error) {
        // Privacy popup not found, continue
      }
      
      // Click "Create new project" or "+" button
      try {
        await page.click('button:has-text("Create new project"), [class*="create"], [class*="new-project"]');
        await sleep(3000);
      } catch (error) {
        // Try alternative selectors
        await page.click('button, [role="button"]');
        await sleep(3000);
      }
      
      await takeScreenshot('New Project');
    }
    
    // Click Image button
        addDebugStep('Image Button', 'info', 'Clicking Image button...');
        try {
          // Wait for the image button to appear
          await page.waitForSelector('button[data-testid="new-raster"]', { timeout: 10000 });
          await page.click('button[data-testid="new-raster"]');
          addDebugStep('Image Button', 'success', 'Successfully clicked Image button');
        } catch (error) {
          addDebugStep('Image Button', 'warning', 'Primary selector failed, trying alternatives...');
          
          // Try alternative selectors
          const imageButtonClicked = await page.evaluate(() => {
            const selectors = [
              'button[data-testid="new-raster"]',
              'button:has-text("Image")',
              '[class*="new-raster"]',
              'button[class*="raster"]',
              'button:has(svg)',
              'button[aria-label*="Image"]'
            ];
            
            for (const selector of selectors) {
              const button = document.querySelector(selector);
              if (button && button.offsetParent !== null) {
                button.click();
                console.log('Clicked image button with selector:', selector);
                return true;
              }
            }
            return false;
          });
          
          if (!imageButtonClicked) {
            throw new Error('Could not find Image button with any selector');
          }
        }
        
        await sleep(3000);
        await takeScreenshot('Image Selection');
    
       // Click Recraft V3 Raw
       addDebugStep('Style Selection', 'info', 'Selecting Recraft V3 Raw style...');
       try {
         await page.waitForSelector('button[data-testid="recraft-preset"]', { timeout: 10000 });
         await page.click('button[data-testid="recraft-preset"]');
         addDebugStep('Style Selection', 'success', 'Successfully clicked Recraft V3 Raw');
       } catch (error) {
         addDebugStep('Style Selection', 'warning', 'Primary selector failed, trying alternatives...');
         
         const styleClicked = await page.evaluate(() => {
           const selectors = [
             'button[data-testid="recraft-preset"]',
             'button:has-text("Recraft V3 Raw")',
             'button[class*="preset"]',
             'button:has-text("Raw")'
           ];
           
           for (const selector of selectors) {
             const button = document.querySelector(selector);
             if (button && button.offsetParent !== null) {
               button.click();
               console.log('Clicked style button with selector:', selector);
               return true;
             }
           }
           return false;
         });
         
         if (!styleClicked) {
           throw new Error('Could not find Recraft V3 Raw button');
         }
       }
       await sleep(2000);
       
      // Click Apply for Photorealism
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
        } else {
          addDebugStep('Photorealism Apply Button', 'warning', 'Could not find or click "Apply" button for "Photorealism"');
          await takeScreenshot('Photorealism Apply Failed', page);
        }
      } catch (error) {
        addDebugStep('Photorealism Apply Button', 'error', 'Error clicking "Apply" button for "Photorealism"', null, error.message);
      }
       await sleep(3000);
       await takeScreenshot('Style Applied');
    
    // Adjust slider to 1 image
    addDebugStep('Slider Adjustment', 'info', 'Adjusting image count to 1...');
    await page.evaluate(() => {
      const slider = document.querySelector('input[name="numberOfImages"]');
      if (slider) {
        slider.value = '1';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(1000);
    
    // Enter prompt
    addDebugStep('Prompt Input', 'info', `Entering prompt: "${prompt}"`);
    await page.click('textarea[name="prompt"][data-testid="recraft-textarea"]');
    await sleep(1000);
    
    await page.evaluate((promptText) => {
      const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
      if (textarea) {
        textarea.value = '';
        textarea.value = promptText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, prompt);
    
    await sleep(2000);
    await takeScreenshot('Prompt Entered');
    
    // Click Generate button
    addDebugStep('Generate Button', 'info', 'Clicking Generate button...');
    await page.click('button[data-testid="recraft-button"]');
    await sleep(3000);
    await takeScreenshot('Generation Started');
    
    // Wait for generation to complete
    addDebugStep('Generation Wait', 'info', 'Waiting for image generation to complete...');
    
    await page.waitForFunction(() => {
      const generatingText = document.body.innerText.toLowerCase().includes('generating');
      const generatingIndicator = document.querySelector('[class*="generating"], [class*="loading"]');
      return generatingText || generatingIndicator;
    }, { timeout: 10000 });
    
    addDebugStep('Generation Wait', 'info', 'Generation started, waiting for completion...');
    
    await page.waitForFunction(() => {
      const images = document.querySelectorAll('img[src*="recraft"], [class*="generated"] img, canvas img');
      const hasVisibleImages = Array.from(images).some(img => img.offsetParent !== null);
      const generatingText = document.body.innerText.toLowerCase().includes('generating');
      const generatingIndicator = document.querySelector('[class*="generating"]');
      
      return hasVisibleImages && !generatingText && !generatingIndicator;
    }, { timeout: 60000 });
    
    addDebugStep('Generation Wait', 'success', 'Image generation completed!');
    await sleep(2000);
    await takeScreenshot('Generation Complete');
    
    // Click on generated image
    addDebugStep('Image Click', 'info', 'Clicking on generated image...');
    const imageClicked = await page.evaluate(() => {
      const images = document.querySelectorAll('img[src*="recraft"], [class*="generated"] img, canvas img');
      for (const img of images) {
        if (img.offsetParent !== null) {
          img.click();
          return true;
        }
      }
      return false;
    });
    
    if (imageClicked) {
      addDebugStep('Image Click', 'success', 'Successfully clicked on generated image');
      await sleep(2000);
      await takeScreenshot('Image Clicked');
    }
    
    // Extract image URL
    const imageUrl = await page.evaluate(() => {
      const images = document.querySelectorAll('img[src*="recraft"]');
      for (const img of images) {
        if (img.offsetParent !== null && img.src) {
          return img.src;
        }
      }
      return null;
    });
    
    updateSessionActivity();
    
    return {
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      sessionReused: !session.isNewSession
    };
    
  } catch (error) {
    addDebugStep('Image Generation', 'error', 'Image generation failed', null, error.message);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

// Main session-based scraping function
async function scrapeRecraftWithSession(googleEmail, googlePassword, prompt = 'banana bread in kitchen with sun light', io = null) {
  try {
    // Get or create session
    const { browser, page, isNewSession } = await getOrCreateSession(googleEmail, googlePassword, io);
    
    // Login if needed
    await loginToRecraft(googleEmail, googlePassword, browser, page, isNewSession);
    
    // Generate image
    const result = await generateImageWithSession(prompt);
    
    const finalUrl = await page.url();
    const finalTitle = await page.title();
    
    return {
      ok: true,
      success: true,
      message: `Session-based scraping completed! ${isNewSession ? 'New session created.' : 'Existing session reused.'}`,
      finalUrl: finalUrl,
      finalTitle: finalTitle,
      steps: debugSteps,
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      sessionReused: !isNewSession,
      sessionId: activeSessions.recraft.sessionId
    };
    
  } catch (error) {
    console.error('❌ Session-based scraping error:', error);
    
    return {
      ok: false,
      success: false,
      message: 'Session-based scraping failed',
      error: error.message,
      steps: debugSteps,
      finalUrl: null,
      finalTitle: null
    };
  }
}

// Get session status
function getSessionStatus() {
  const session = activeSessions.recraft;
  return {
    hasActiveSession: isSessionValid(),
    isLoggedIn: session.isLoggedIn,
    userEmail: session.userEmail,
    sessionId: session.sessionId,
    lastActivity: session.lastActivity,
    timeRemaining: session.lastActivity ? Math.max(0, SESSION_TIMEOUT - (Date.now() - session.lastActivity)) : 0
  };
}

// Manually cleanup session
async function cleanupSession() {
  await cleanupExpiredSessions();
  return { success: true, message: 'Session cleaned up successfully' };
}

module.exports = {
  scrapeRecraftWithSession,
  getSessionStatus,
  cleanupSession,
  cleanupExpiredSessions
};
