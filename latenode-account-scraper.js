const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ---- Latenode email OTP extractor (Puppeteer) ----------------------------
async function extractLatenodeOTP(page, { screenshotOnFail = true } = {}) {
  // 1) Find the frame that contains the email content
  const frame = await findEmailFrame(page);

  // 2) Give the frame a moment to paint the email
  await frame.waitForSelector('table, div, body', { visible: true, timeout: 10_000 });

  // 3) Strategy A: XPath – span after "Confirmation code"
  try {
    const [el] = await frame.$x(
      "//td/div[contains(., 'Confirmation code')]/following::span[1]"
    );
    if (el) {
      const code = (await frame.evaluate(e => e.textContent, el)).trim();
      if (isOtp(code)) return code;
      console.log('[OTP] XPath found but failed validation:', code);
    } else {
      console.log('[OTP] XPath element not found');
    }
  } catch (e) {
    console.log('[OTP] XPath error:', e.message);
  }

  // 4) Strategy B: CSS – large font-size number span (as in your screenshot)
  try {
    const selector = "span[style*='font-size:48px']";
    const el = await frame.$(selector);
    if (el) {
      const code = (await frame.evaluate(e => e.textContent, el)).trim();
      if (isOtp(code)) return code;
      console.log('[OTP] CSS 48px found but failed validation:', code);
    } else {
      console.log('[OTP] CSS element not found:', selector);
    }
  } catch (e) {
    console.log('[OTP] CSS error:', e.message);
  }

  // 5) Strategy C: Scoped text search near the label
  try {
    const { code, dump } = await frame.evaluate(() => {
      const root =
        document.querySelector('.modal, .email, .content, table') || document.body;
      const text = root.innerText || '';
      // Grab up to ~200 chars after the label and search for 4–8 digits
      const m = text.match(/Confirmation code[\s\S]{0,200}?(\b\d{4,8}\b)/i);
      return { code: m ? m[1] : null, dump: text.slice(0, 8000) };
    });
    if (code && /^\d{4,8}$/.test(code)) return code.trim();

    console.log('[OTP] Text search failed or invalid code:', code);
    // Optional: uncomment to inspect content
    // console.log('[OTP] Scoped dump:\n', dump);
  } catch (e) {
    console.log('[OTP] Text search error:', e.message);
  }

  // 6) Fail fast with artifacts to debug
  if (screenshotOnFail) {
    const file = `/tmp/otp-fail-${Date.now()}.png`;
    try { await frame.screenshot({ path: file, fullPage: true }); } catch {}
    console.log(`[OTP] Saved failure screenshot (if possible): ${file}`);
  }
  throw new Error('Could not extract confirmation code from email');
}

// ---- helpers -------------------------------------------------------------
function isOtp(s) {
  if (!s) return false;
  const t = String(s).replace(/\D+/g, '');
  return /^\d{4,8}$/.test(t);
}

// Find the frame that actually renders the email content.
// Tries: the focused/visible modal iframe; otherwise any frame whose URL/name
// looks like message/detail/preview/templates; otherwise main frame.
async function findEmailFrame(page) {
  // Wait a bit for iframes to mount
  await page.waitForTimeout(300);

  // Candidate frames by URL/name hints
  const hints = /detail|message|mail|preview|reader|tempmail|email/i;
  const frames = page.frames();

  // 1) Prefer a visible iframe element (modal) and take its contentFrame()
  const visibleIframeHandle = await page.$("iframe, [sandbox='allow-scripts']");
  if (visibleIframeHandle) {
    try {
      const f = await visibleIframeHandle.contentFrame();
      if (f) return f;
    } catch {}
  }

  // 2) Pick a child frame by URL/name heuristic
  const byHint = frames.find(f => hints.test(f.url()) || hints.test(f.name()));
  if (byHint) return byHint;

  // 3) Fallback to main frame
  return page.mainFrame();
}

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
    
    // Clear and fill the email field with smart validation
    addDebugStep('Email Input', 'info', `Filling email field with: ${tempEmail}`);
    
    // First, clear the field completely
    await page.evaluate(() => {
      const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
      if (emailInput) {
        emailInput.focus();
        emailInput.select();
        emailInput.value = '';
        // Trigger events to clear any validation state
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        emailInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    });
    
    await sleep(500);
    
    // Now type the email character by character to ensure proper validation
    addDebugStep('Email Input', 'info', 'Typing email character by character...');
    await page.type('input[data-test-id="authEmailInput"]', tempEmail, { delay: 100 });
    
    await sleep(1000);
    
    // Verify the email was entered and check if Next button is now visible
    const emailValidation = await page.evaluate((expectedEmail) => {
      const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
      const enteredEmail = emailInput ? emailInput.value : null;
      
      // Check if Next button is visible and enabled
      const nextButton = document.querySelector('button[data-test-id="authEmailButton"]');
      const isNextButtonVisible = nextButton && nextButton.offsetParent !== null;
      const isNextButtonEnabled = nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled');
      
      // Check for any validation errors
      const hasValidationError = document.querySelector('.error, .invalid, [class*="error"], [class*="invalid"]') !== null;
      
      return {
        enteredEmail: enteredEmail,
        isCorrect: enteredEmail === expectedEmail,
        isNextButtonVisible: isNextButtonVisible,
        isNextButtonEnabled: isNextButtonEnabled,
        hasValidationError: hasValidationError,
        nextButtonText: nextButton ? nextButton.innerText : null
      };
    }, tempEmail);
    
    addDebugStep('Email Input', 'info', `Email validation results:`, null, JSON.stringify(emailValidation, null, 2));
    
    if (emailValidation.isCorrect) {
      addDebugStep('Email Input', 'success', `Email successfully entered: ${emailValidation.enteredEmail}`);
    } else {
      addDebugStep('Email Input', 'error', `❌ CRITICAL: Email verification failed. Expected: ${tempEmail}, Got: ${emailValidation.enteredEmail} - stopping process`);
      throw new Error('Email input failed - this step is obligatory');
    }
    
    if (emailValidation.hasValidationError) {
      addDebugStep('Email Input', 'warning', 'Validation error detected on page');
    }
    
    if (emailValidation.isNextButtonVisible && emailValidation.isNextButtonEnabled) {
      addDebugStep('Email Input', 'success', 'Next button is visible and enabled - email validation successful!');
    } else {
      addDebugStep('Email Input', 'warning', `Next button status - Visible: ${emailValidation.isNextButtonVisible}, Enabled: ${emailValidation.isNextButtonEnabled}`);
      
      // Try alternative email input method if Next button is not visible
      addDebugStep('Email Input', 'info', 'Trying alternative email input method...');
      
      await page.evaluate((email) => {
        const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
        if (emailInput) {
          // Clear and set value using different approach
          emailInput.focus();
          emailInput.value = '';
          
          // Simulate typing
          for (let i = 0; i < email.length; i++) {
            emailInput.value = email.substring(0, i + 1);
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('keyup', { bubbles: true }));
          }
          
          // Final validation events
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          emailInput.dispatchEvent(new Event('blur', { bubbles: true }));
          emailInput.dispatchEvent(new Event('focus', { bubbles: true }));
          
          // Force validation
          if (emailInput.checkValidity) {
            emailInput.checkValidity();
          }
        }
      }, tempEmail);
      
      await sleep(2000);
      
      // Check again after alternative method
      const revalidation = await page.evaluate(() => {
        const nextButton = document.querySelector('button[data-test-id="authEmailButton"]');
        return {
          isNextButtonVisible: nextButton && nextButton.offsetParent !== null,
          isNextButtonEnabled: nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled')
        };
      });
      
      if (revalidation.isNextButtonVisible && revalidation.isNextButtonEnabled) {
        addDebugStep('Email Input', 'success', 'Next button is now visible after alternative input method!');
      } else {
        addDebugStep('Email Input', 'error', '❌ CRITICAL: Next button still not visible after alternative input method - stopping process');
        throw new Error('Email validation failed - Next button not becoming visible - this step is obligatory');
      }
    }
    
    await takeScreenshot('Email-Entered', page);
    
    // Step 5: Click Next button to proceed (we already verified it's visible and enabled)
    addDebugStep('Next Button', 'info', 'Clicking Next button...');
    
    try {
      // Since we already verified the Next button is visible and enabled, just click it
      await page.click('button[data-test-id="authEmailButton"]');
      addDebugStep('Next Button', 'success', 'Clicked Next button successfully');
      
      await sleep(1000);
      
      // Wait for page to update to confirmation code page
      addDebugStep('Next Button', 'info', 'Waiting for page to transition to confirmation code step...');
      
      try {
        // Wait for either confirmation code input OR a redirect to a different page
        await page.waitForFunction(() => {
          // Check for confirmation code input
          const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]');
          if (codeInput) return true;
          
          // Check if URL changed (might be redirecting)
          const url = window.location.href;
          if (url.includes('confirm') || url.includes('verification') || url.includes('code')) {
            return true;
          }
          
          // Check for any text mentioning confirmation or code
          const bodyText = document.body.innerText.toLowerCase();
          if (bodyText.includes('confirmation code') || bodyText.includes('verification code') || bodyText.includes('enter code')) {
            return true;
          }
          
          return false;
        }, { timeout: 20000 });
        
        addDebugStep('Next Button', 'success', 'Page transition detected');
        
      } catch (error) {
        addDebugStep('Next Button', 'warning', 'Page transition timeout, checking current state...');
        
        // Take a screenshot to see what's on the page
        await takeScreenshot('After-Next-Click', page);
        
        // Check if we're on a different page or if there's any confirmation-related content
        const currentUrl = await page.url();
        const pageContent = await page.evaluate(() => document.body.innerText);
        
        addDebugStep('Next Button', 'info', `Current URL: ${currentUrl}`);
        addDebugStep('Next Button', 'info', `Page contains confirmation text: ${pageContent.toLowerCase().includes('confirmation') || pageContent.toLowerCase().includes('code')}`);
        
        // If we can't find confirmation code input, this might be a different flow
        const hasCodeInput = await page.evaluate(() => {
          return document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]') !== null;
        });
        
        if (!hasCodeInput) {
          addDebugStep('Next Button', 'error', '❌ CRITICAL: No confirmation code input found after Next button click - stopping process');
          throw new Error('Confirmation code page not loaded - this step is obligatory');
        }
      }
      
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
    
    // Handle consent dialog if it appears
    addDebugStep('Consent Dialog', 'info', 'Checking for consent dialog...');
    try {
      // Wait for consent dialog to appear with multiple selectors
      const consentSelectors = [
        'button:has-text("Consent")',
        'button:has-text("Accept")', 
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button:has-text("Allow")',
        'button:has-text("OK")',
        'button:has-text("Continue")',
        'button:has-text("I consent")',
        'button:has-text("Accept cookies")',
        'button:has-text("Accept all cookies")',
        '[class*="consent"] button',
        '[class*="cookie"] button',
        '[class*="gdpr"] button',
        'button[class*="accept"]',
        'button[class*="consent"]',
        // More specific selectors for the actual consent button
        'button[type="button"]:has-text("Consent")',
        'button[class*="primary"]:has-text("Consent")',
        'button[class*="btn"]:has-text("Consent")',
        // Avoid clicking "Learn more" or "Manage options" buttons
        'button:not(:has-text("Learn more")):not(:has-text("Manage options")):has-text("Consent")'
      ];
      
      let consentClicked = false;
      for (const selector of consentSelectors) {
        try {
          await tempMailPage.waitForSelector(selector, { timeout: 2000 });
          
          // Check if button is visible and clickable
          const buttonInfo = await tempMailPage.evaluate((sel) => {
            const button = document.querySelector(sel);
            if (!button) return { found: false };
            
            const text = (button.innerText || button.textContent || '').trim();
            
            // Avoid clicking "Learn more", "Manage options", or other non-consent buttons
            const avoidTexts = ['Learn more', 'Manage options', 'Settings', 'Preferences', 'Details', 'More info'];
            const shouldAvoid = avoidTexts.some(avoidText => text.toLowerCase().includes(avoidText.toLowerCase()));
            
            return {
              found: true,
              visible: button.offsetParent !== null,
              enabled: !button.disabled && !button.classList.contains('disabled'),
              text: text,
              shouldAvoid: shouldAvoid
            };
          }, selector);
          
          if (buttonInfo.found && buttonInfo.visible && buttonInfo.enabled && !buttonInfo.shouldAvoid) {
            await tempMailPage.click(selector);
            addDebugStep('Consent Dialog', 'success', `Clicked consent button: "${buttonInfo.text}"`);
            consentClicked = true;
            break;
          } else if (buttonInfo.shouldAvoid) {
            addDebugStep('Consent Dialog', 'warning', `Skipping button "${buttonInfo.text}" - not a consent button`);
          }
        } catch (e) {
          // Try next selector
          continue;
        }
      }
      
      if (consentClicked) {
        await sleep(2000);
        await takeScreenshot('TempMail100-After-Consent', tempMailPage);
      } else {
        addDebugStep('Consent Dialog', 'info', 'No consent dialog found or already handled');
      }
      
    } catch (error) {
      addDebugStep('Consent Dialog', 'info', 'No consent dialog found or already handled');
    }
    
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
        
        // Debug: Check what elements are available on the page
        if (attempt === 1) {
          const pageInfo = await tempMailPage.evaluate(() => {
            const allLinks = document.querySelectorAll('a');
            const allDivs = document.querySelectorAll('div');
            const allElements = document.querySelectorAll('*');
            
            const emailRelated = Array.from(allElements).filter(el => {
              const text = (el.innerText || el.textContent || '').toLowerCase();
              return text.includes('latenode') || text.includes('confirm') || text.includes('email');
            });
            
            return {
              totalLinks: allLinks.length,
              totalDivs: allDivs.length,
              totalElements: allElements.length,
              emailRelatedElements: emailRelated.length,
              emailRelatedTexts: emailRelated.map(el => (el.innerText || el.textContent || '').substring(0, 50)).slice(0, 10)
            };
          });
          
          addDebugStep('Email Check', 'info', `Page debug info:`, null, JSON.stringify(pageInfo, null, 2));
        }
        
        // Try multiple selectors for the email
        const emailSelectors = [
          'a.email-item:has-text("Latenode")',
          'a.email-item:has-text("Confirm your email")',
          'a.email-item:has-text("latenode")',
          'a.email-item:has-text("confirm")',
          'a[href*="detail"]:has-text("Latenode")',
          'a[href*="detail"]:has-text("Confirm")',
          // More specific selectors for the email item
          'a:has-text("Latenode")',
          'a:has-text("Confirm your email address")',
          'a:has-text("Confirm your email")',
          'a:has-text("confirm")',
          // Look for any clickable element containing Latenode
          '[class*="email"]:has-text("Latenode")',
          '[class*="item"]:has-text("Latenode")',
          '[class*="mail"]:has-text("Latenode")',
          // Generic selectors for email items
          'a[href*="detail"]',
          '.email-item',
          '[class*="email-item"]'
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
        // Last resort: try JavaScript evaluation with more comprehensive search
        const emailClicked = await tempMailPage.evaluate(() => {
          // Try multiple selectors for email items
          const selectors = [
            'a.email-item',
            'a[href*="detail"]',
            '[class*="email"]',
            '[class*="item"]',
            'a[class*="email"]',
            'div[class*="email"]',
            'div[class*="item"]'
          ];
          
          let allItems = [];
          for (const selector of selectors) {
            const items = document.querySelectorAll(selector);
            allItems = allItems.concat(Array.from(items));
          }
          
          // Remove duplicates
          allItems = [...new Set(allItems)];
          
          console.log('Found', allItems.length, 'potential email items');
          
          for (const item of allItems) {
            const text = (item.innerText || item.textContent || '').toLowerCase();
            console.log('Checking item with text:', text.substring(0, 100));
            
            if (text.includes('latenode') || text.includes('confirm')) {
              console.log('Found Latenode email, clicking...');
              item.click();
              return true;
            }
          }
          
          // If no specific match, try clicking the first clickable email item
          for (const item of allItems) {
            if (item.tagName === 'A' || item.onclick || item.getAttribute('href')) {
              console.log('Clicking first available email item');
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
      
      // Extract the confirmation code with scrolling
      addDebugStep('Code Extraction', 'info', 'Extracting confirmation code from email...');
      
      // First, scroll down in the email to make sure we see all content
      addDebugStep('Code Extraction', 'info', 'Scrolling down in email to find confirmation code...');
      
      // Use Puppeteer's scrolling method for more reliable scrolling
      await tempMailPage.evaluate(() => {
        window.scrollTo(0, 0); // Start at top
      });
      
      // Scroll down gradually using Puppeteer
      for (let i = 0; i < 10; i++) {
        await tempMailPage.mouse.wheel({ deltaY: 200 });
        await sleep(200);
      }
      
      // Scroll down gradually to ensure all content is loaded
      await tempMailPage.evaluate(() => {
        // First scroll to the very bottom
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await sleep(1000);
      
      // Scroll up to find the confirmation code area
      await tempMailPage.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight - 800);
        
        // Try to find and scroll to the confirmation code specifically
        const confirmationElements = document.querySelectorAll('*');
        for (const element of confirmationElements) {
          const text = element.textContent || element.innerText || '';
          if (text.toLowerCase().includes('confirmation code') || text.toLowerCase().includes('confirm your email')) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });
      
      await sleep(3000); // Wait longer for scrolling to complete
      
      // Take a screenshot after scrolling to see the full email content
      await takeScreenshot('Email-After-Scroll', tempMailPage);
      
      // Wait for network to be idle to ensure email content is fully loaded
      addDebugStep('Code Extraction', 'info', 'Waiting for email content to fully load...');
      await tempMailPage.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
      
      // Extract confirmation code using robust iframe-aware method
      try {
        confirmationCode = await extractLatenodeOTP(tempMailPage);
        addDebugStep('Code Extraction', 'success', `✅ Confirmation code extracted: ${confirmationCode}`);
      } catch (error) {
        addDebugStep('Code Extraction', 'error', `❌ Code extraction failed: ${error.message}`);
        confirmationCode = null;
      }
      
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
    
    // Find and fill the confirmation code field with smart validation
    addDebugStep('Code Entry', 'info', `Entering confirmation code: ${confirmationCode}`);
    
    // First, clear the field completely
    await page.evaluate(() => {
      const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]');
      if (codeInput) {
        codeInput.focus();
        codeInput.select();
        codeInput.value = '';
        // Trigger events to clear any validation state
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
        codeInput.dispatchEvent(new Event('change', { bubbles: true }));
        codeInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    });
    
    await sleep(500);
    
    // Now type the code character by character to ensure proper validation
    addDebugStep('Code Entry', 'info', 'Typing confirmation code character by character...');
    
    // Find the code input field first
    const codeInputSelector = await page.evaluate(() => {
      const selectors = [
        'input[placeholder*="code" i]',
        'input[placeholder*="confirmation" i]',
        'input[data-test-id*="code" i]',
        'input[type="text"][maxlength="4"]',
        'input[type="text"]'
      ];
      
      for (const selector of selectors) {
        const input = document.querySelector(selector);
        if (input) {
          return selector;
        }
      }
      return null;
    });
    
    if (!codeInputSelector) {
      addDebugStep('Code Entry', 'error', '❌ CRITICAL: Could not find confirmation code input field - stopping process');
      throw new Error('Confirmation code input field not found - this step is obligatory');
    }
    
    addDebugStep('Code Entry', 'info', `Found code input with selector: ${codeInputSelector}`);
    
    // Type the code character by character
    await page.type(codeInputSelector, confirmationCode, { delay: 200 });
    
    await sleep(1000);
    
    // Verify the code was entered and check if Verify button is now visible
    const codeValidation = await page.evaluate((expectedCode) => {
      const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]');
      const enteredCode = codeInput ? codeInput.value : null;
      
      // Check if Verify button is visible and enabled
      const verifyButtonSelectors = [
        'button[type="submit"]',
        'button',
        'input[type="submit"]',
        '[role="button"]'
      ];
      
      let verifyButton = null;
      for (const selector of verifyButtonSelectors) {
        const button = document.querySelector(selector);
        if (button) {
          const text = (button.innerText || button.textContent || '').toLowerCase();
          if (text.includes('verify') || text.includes('vérifier') || text.includes('submit') || text.includes('continue')) {
            verifyButton = button;
            break;
          }
        }
      }
      
      const isVerifyButtonVisible = verifyButton && verifyButton.offsetParent !== null;
      const isVerifyButtonEnabled = verifyButton && !verifyButton.disabled && !verifyButton.classList.contains('disabled');
      
      // Check for any validation errors
      const hasValidationError = document.querySelector('.error, .invalid, [class*="error"], [class*="invalid"]') !== null;
      
      return {
        enteredCode: enteredCode,
        isCorrect: enteredCode === expectedCode,
        isVerifyButtonVisible: isVerifyButtonVisible,
        isVerifyButtonEnabled: isVerifyButtonEnabled,
        hasValidationError: hasValidationError,
        verifyButtonText: verifyButton ? verifyButton.innerText : null
      };
    }, confirmationCode);
    
    addDebugStep('Code Entry', 'info', `Code validation results:`, null, JSON.stringify(codeValidation, null, 2));
    
    if (codeValidation.isCorrect) {
      addDebugStep('Code Entry', 'success', `Confirmation code successfully entered: ${codeValidation.enteredCode}`);
    } else {
      addDebugStep('Code Entry', 'error', `❌ CRITICAL: Code verification failed. Expected: ${confirmationCode}, Got: ${codeValidation.enteredCode} - stopping process`);
      throw new Error('Confirmation code input failed - this step is obligatory');
    }
    
    if (codeValidation.hasValidationError) {
      addDebugStep('Code Entry', 'warning', 'Validation error detected on page');
    }
    
    if (codeValidation.isVerifyButtonVisible && codeValidation.isVerifyButtonEnabled) {
      addDebugStep('Code Entry', 'success', 'Verify button is visible and enabled - code validation successful!');
    } else {
      addDebugStep('Code Entry', 'warning', `Verify button status - Visible: ${codeValidation.isVerifyButtonVisible}, Enabled: ${codeValidation.isVerifyButtonEnabled}`);
      
      // Try alternative code input method if Verify button is not visible
      addDebugStep('Code Entry', 'info', 'Trying alternative code input method...');
      
      await page.evaluate((code) => {
        const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]');
        if (codeInput) {
          // Clear and set value using different approach
          codeInput.focus();
          codeInput.value = '';
          
          // Simulate typing
          for (let i = 0; i < code.length; i++) {
            codeInput.value = code.substring(0, i + 1);
            codeInput.dispatchEvent(new Event('input', { bubbles: true }));
            codeInput.dispatchEvent(new Event('keyup', { bubbles: true }));
          }
          
          // Final validation events
          codeInput.dispatchEvent(new Event('change', { bubbles: true }));
          codeInput.dispatchEvent(new Event('blur', { bubbles: true }));
          codeInput.dispatchEvent(new Event('focus', { bubbles: true }));
          
          // Force validation
          if (codeInput.checkValidity) {
            codeInput.checkValidity();
          }
        }
      }, confirmationCode);
      
      await sleep(2000);
      
      // Check again after alternative method
      const revalidation = await page.evaluate(() => {
        const verifyButtonSelectors = [
          'button[type="submit"]',
          'button',
          'input[type="submit"]',
          '[role="button"]'
        ];
        
        let verifyButton = null;
        for (const selector of verifyButtonSelectors) {
          const button = document.querySelector(selector);
          if (button) {
            const text = (button.innerText || button.textContent || '').toLowerCase();
            if (text.includes('verify') || text.includes('vérifier') || text.includes('submit') || text.includes('continue')) {
              verifyButton = button;
              break;
            }
          }
        }
        
        return {
          isVerifyButtonVisible: verifyButton && verifyButton.offsetParent !== null,
          isVerifyButtonEnabled: verifyButton && !verifyButton.disabled && !verifyButton.classList.contains('disabled')
        };
      });
      
      if (revalidation.isVerifyButtonVisible && revalidation.isVerifyButtonEnabled) {
        addDebugStep('Code Entry', 'success', 'Verify button is now visible after alternative input method!');
      } else {
        addDebugStep('Code Entry', 'error', '❌ CRITICAL: Verify button still not visible after alternative input method - stopping process');
        throw new Error('Confirmation code validation failed - Verify button not becoming visible - this step is obligatory');
      }
    }
    
    await takeScreenshot('Code-Entered', page);
    
    // Click Verify button (we already verified it's visible and enabled)
    addDebugStep('Code Entry', 'info', 'Clicking Verify button...');
    
    // Take a screenshot before attempting to click the Verify button
    await takeScreenshot('Before-Verify-Click', page);
    
    try {
      // Find and click the Verify button using proper selectors
      const verifyButtonClicked = await page.evaluate(() => {
        const verifyButtonSelectors = [
          'button[type="submit"]',
          'button',
          'input[type="submit"]',
          '[role="button"]'
        ];
        
        for (const selector of verifyButtonSelectors) {
          const buttons = document.querySelectorAll(selector);
          for (const button of buttons) {
            const text = (button.innerText || button.textContent || '').toLowerCase();
            if (text.includes('verify') || text.includes('vérifier') || text.includes('submit') || text.includes('continue')) {
              button.click();
              return true;
            }
          }
        }
        return false;
      });
      
      if (verifyButtonClicked) {
        addDebugStep('Code Entry', 'success', 'Clicked Verify button successfully');
      } else {
        addDebugStep('Code Entry', 'error', '❌ CRITICAL: Could not find or click Verify button - stopping process');
        throw new Error('Verify button not found or not clickable - this step is obligatory');
      }
      
      // Wait for page to update to password creation
      await page.waitForFunction(() => {
        return document.querySelector('input[type="password"], input[name="password"]') !== null;
      }, { timeout: 15000 });
      
      addDebugStep('Code Entry', 'success', 'Page updated to password creation step');
      await takeScreenshot('Password-Creation-Page', page);
      
    } catch (error) {
      // Take a screenshot before throwing the error to help with debugging
      await takeScreenshot('Code-Entry-Error', page);
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
