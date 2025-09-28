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

async function takeScreenshot(description) {
  try {
    screenshotCounter++;
    const filename = `recraft-ai-${screenshotCounter}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const filepath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    const screenshot = await page.screenshot({ 
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
    
    // Launch browser with stealth settings
    addDebugStep('Browser Launch', 'info', 'Launching browser with AI guidance...');
    
    browser = await puppeteer.launch({
      headless: false, // Keep visible for AI analysis
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
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { width: 1366, height: 768 }
    });
    
    page = await browser.newPage();
    
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
    await takeScreenshot('Recraft.ai Login Page');
    
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
           pageInfo.title.toLowerCase().includes('recraft') && !pageInfo.title.toLowerCase().includes('login'))) {
        addDebugStep('Success', 'success', 'Successfully reached Recraft.ai dashboard!');
        await takeScreenshot('Recraft.ai Dashboard');
        break;
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
      await takeScreenshot(`After AI Step ${currentStep}`);
    }
    
    if (currentStep >= maxSteps) {
      addDebugStep('Warning', 'warning', 'Reached maximum steps, stopping AI guidance');
    }
    
    // Final page analysis
    const finalUrl = page.url();
    const finalTitle = await page.title();
    
    addDebugStep('Final Analysis', 'info', `Final URL: ${finalUrl}`);
    addDebugStep('Final Analysis', 'info', `Final Title: ${finalTitle}`);
    
    // Determine success
    const isSuccess = finalUrl.includes('recraft.ai') && 
                     (finalUrl.includes('/dashboard') || finalUrl.includes('/workspace') || 
                      finalTitle.toLowerCase().includes('recraft') && !finalTitle.toLowerCase().includes('login'));
    
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
