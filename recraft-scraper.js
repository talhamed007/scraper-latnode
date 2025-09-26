const puppeteer = require('puppeteer');

// Recraft.ai Login Scraper - Email Only
async function scrapeRecraftLogin(recraftEmail) {
  let browser;
  let page;
  const debugSteps = [];
  const screenshots = [];

  // Helper function to add debug step
  const addDebugStep = (title, status, description, details = null, error = null) => {
    const step = {
      title,
      status,
      description,
      details,
      error,
      timestamp: new Date().toISOString()
    };
    debugSteps.push(step);
    console.log(`📋 DEBUG STEP: ${title} - ${status.toUpperCase()}`);
  };

  // Helper function to take screenshot
  const takeScreenshot = async (title) => {
    try {
      if (page) {
        const screenshot = await page.screenshot({ fullPage: true });
        screenshots.push({
          title,
          data: screenshot.toString('base64'),
          timestamp: new Date().toISOString()
        });
        console.log(`📸 Screenshot taken: ${title}`);
        return screenshot;
      }
    } catch (e) {
      console.log(`❌ Failed to take screenshot: ${e.message}`);
    }
    return null;
  };

  try {
    console.log('🚀 Starting Recraft.ai Login Scraper...');
    console.log('📧 Recraft Email:', recraftEmail);

    addDebugStep('Scraper Started', 'info', 'Initializing Recraft.ai login scraper');

    // Launch browser
    addDebugStep('Browser Launch', 'info', 'Launching Puppeteer browser');
    browser = await puppeteer.launch({
      headless: true,
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

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    addDebugStep('Browser Launch', 'success', 'Browser launched successfully');

    // Navigate to Recraft.ai
    addDebugStep('Recraft Navigation', 'info', 'Navigating to Recraft.ai login page');
    console.log('🎯 Navigating to Recraft.ai...');
    
    await page.goto('https://www.recraft.ai/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    await sleep(3000);
    await takeScreenshot('Recraft.ai Homepage');
    addDebugStep('Recraft Navigation', 'success', 'Navigated to Recraft.ai homepage');

    // Look for and click "Sign in" button
    addDebugStep('Sign In Button', 'info', 'Looking for Sign in button');
    console.log('🔍 Looking for Sign in button...');
    
    try {
      // Wait for sign in button with multiple selectors
      await page.waitForSelector('button:has-text("Sign in"), a:has-text("Sign in"), [data-testid*="sign"], [class*="sign-in"], [class*="login"]', { timeout: 10000 });
      
      // Try to click sign in button
      const signInClicked = await page.evaluate(() => {
        const selectors = [
          'button:has-text("Sign in")',
          'a:has-text("Sign in")',
          '[data-testid*="sign"]',
          '[class*="sign-in"]',
          '[class*="login"]'
        ];
        
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              element.click();
              return true;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        return false;
      });

      if (signInClicked) {
        addDebugStep('Sign In Button', 'success', 'Clicked Sign in button');
        console.log('✅ Sign in button clicked');
      } else {
        addDebugStep('Sign In Button', 'warning', 'Could not find or click Sign in button');
        console.log('⚠️ Could not find Sign in button, trying alternative approach');
      }
    } catch (error) {
      addDebugStep('Sign In Button', 'error', 'Error finding Sign in button', null, error.message);
      console.log('❌ Error finding Sign in button:', error.message);
    }

    await sleep(3000);
    await takeScreenshot('After Sign In Click');

    // Navigate to the login URL directly
    addDebugStep('Direct Login URL', 'info', 'Navigating to Recraft.ai login URL');
    console.log('🔗 Navigating to Recraft.ai login URL...');
    
    await page.goto('https://id.recraft.ai/realms/recraft/protocol/openid-connect/auth?client_id=frontend-client&scope=openid%20email%20profile&response_type=code&redirect_uri=https%3A%2F%2Fwww.recraft.ai%2Fapi%2Fauth%2Fcallback%2Fkeycloak&grant_type=authorization_code&state=RmXXBVX5QQ-yw7gVJnQhM2a56j55TwJJzpl2MLlMQ6s&code_challenge=0xUu8RvStUZJZrXxoYEMwDJ40lZGhhZ96hqTbSc8rHI&code_challenge_method=S256', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    await sleep(3000);
    await takeScreenshot('Recraft.ai Login Page');
    addDebugStep('Direct Login URL', 'success', 'Navigated to Recraft.ai login page');

    // Check for "Sorry, nothing to see here" error page
    const errorPageCheck = await page.evaluate(() => {
      const errorText = document.body.innerText.toLowerCase();
      const hasError = errorText.includes('sorry, nothing to see here') || 
                      errorText.includes('nothing to see here') ||
                      errorText.includes('go back to recraft');
      
      if (hasError) {
        // Look for "Go back to recraft" button
        const goBackButton = document.querySelector('a[href="/projects"], a:has-text("Go back to recraft"), button:has-text("Go back to recraft")');
        return {
          hasError: true,
          goBackButton: !!goBackButton,
          buttonText: goBackButton ? goBackButton.innerText : null
        };
      }
      
      return { hasError: false };
    });

    if (errorPageCheck.hasError) {
      addDebugStep('Error Page Detection', 'warning', 'Detected error page, attempting to go back');
      console.log('⚠️ Detected error page, looking for Go back button...');
      
      if (errorPageCheck.goBackButton) {
        try {
          await page.click('a[href="/projects"], a:has-text("Go back to recraft"), button:has-text("Go back to recraft")');
          await sleep(3000);
          await takeScreenshot('After Go Back Click');
          addDebugStep('Error Page Recovery', 'success', 'Clicked Go back button');
          console.log('✅ Clicked Go back button');
        } catch (error) {
          addDebugStep('Error Page Recovery', 'error', 'Failed to click Go back button', null, error.message);
          console.log('❌ Failed to click Go back button:', error.message);
        }
      }
    }

    // Wait for email input field
    addDebugStep('Email Input', 'info', 'Waiting for email input field');
    console.log('📧 Waiting for email input field...');
    
    try {
      await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"], input[placeholder*="email"], input[placeholder*="Email"]', { timeout: 15000 });
      addDebugStep('Email Input', 'success', 'Found email input field');
      console.log('✅ Found email input field');
    } catch (error) {
      addDebugStep('Email Input', 'error', 'Could not find email input field', null, error.message);
      console.log('❌ Could not find email input field:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Email Input Field Found');

    // Fill email
    addDebugStep('Email Entry', 'info', 'Filling email field');
    console.log('✍️ Filling email field...');
    
    try {
      await page.type('input[type="email"], input[name="email"], input[id="email"], input[placeholder*="email"], input[placeholder*="Email"]', recraftEmail, { delay: 100 });
      addDebugStep('Email Entry', 'success', 'Email filled successfully');
      console.log('✅ Email filled successfully');
    } catch (error) {
      addDebugStep('Email Entry', 'error', 'Failed to fill email', null, error.message);
      console.log('❌ Failed to fill email:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Email Filled');

    // Look for and check the Cloudflare verification checkbox
    addDebugStep('Cloudflare Checkbox', 'info', 'Looking for Cloudflare verification checkbox');
    console.log('☑️ Looking for Cloudflare verification checkbox...');
    
    try {
      // Look for checkbox that's not "Remember me"
      const checkboxFound = await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const checkbox of checkboxes) {
          const label = checkbox.closest('label');
          const labelText = label ? label.innerText.toLowerCase() : '';
          const nearbyText = checkbox.parentElement.innerText.toLowerCase();
          
          // Skip "Remember me" checkbox
          if (labelText.includes('remember') || nearbyText.includes('remember')) {
            continue;
          }
          
          // Look for verification-related text
          if (labelText.includes('verify') || labelText.includes('human') || 
              nearbyText.includes('verify') || nearbyText.includes('human') ||
              labelText.includes('cloudflare') || nearbyText.includes('cloudflare')) {
            return { found: true, text: labelText || nearbyText };
          }
        }
        return { found: false };
      });

      if (checkboxFound.found) {
        console.log('✅ Found Cloudflare checkbox:', checkboxFound.text);
        await page.click('input[type="checkbox"]:not([id*="remember"]):not([name*="remember"])');
        addDebugStep('Cloudflare Checkbox', 'success', 'Checked Cloudflare verification checkbox');
        console.log('✅ Cloudflare checkbox checked');
      } else {
        addDebugStep('Cloudflare Checkbox', 'warning', 'Could not find Cloudflare checkbox');
        console.log('⚠️ Could not find Cloudflare checkbox');
      }
    } catch (error) {
      addDebugStep('Cloudflare Checkbox', 'error', 'Error with Cloudflare checkbox', null, error.message);
      console.log('❌ Error with Cloudflare checkbox:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Cloudflare Checkbox Checked');

    // Look for and click Continue button
    addDebugStep('Continue Button', 'info', 'Looking for Continue button');
    console.log('➡️ Looking for Continue button...');
    
    try {
      await page.waitForSelector('button:has-text("Continue"), input[type="submit"], button[type="submit"], button:has-text("Next"), button:has-text("Submit")', { timeout: 10000 });
      
      const continueClicked = await page.evaluate(() => {
        const selectors = [
          'button:has-text("Continue")',
          'input[type="submit"]',
          'button[type="submit"]',
          'button:has-text("Next")',
          'button:has-text("Submit")'
        ];
        
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              element.click();
              return true;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        return false;
      });

      if (continueClicked) {
        addDebugStep('Continue Button', 'success', 'Clicked Continue button');
        console.log('✅ Continue button clicked');
      } else {
        addDebugStep('Continue Button', 'error', 'Could not find or click Continue button');
        console.log('❌ Could not find Continue button');
      }
    } catch (error) {
      addDebugStep('Continue Button', 'error', 'Error finding Continue button', null, error.message);
      console.log('❌ Error finding Continue button:', error.message);
    }

    await sleep(5000);
    await takeScreenshot('After Continue Click');

    // Check if we're on verification code page
    const verificationCheck = await page.evaluate(() => {
      const pageText = document.body.innerText.toLowerCase();
      const hasVerification = pageText.includes('verification') || 
                             pageText.includes('code') || 
                             pageText.includes('enter the code') ||
                             pageText.includes('check your email');
      
      return {
        hasVerification,
        currentUrl: window.location.href,
        pageTitle: document.title
      };
    });

    if (verificationCheck.hasVerification) {
      addDebugStep('Verification Code Page', 'success', 'Reached verification code page');
      console.log('✅ Reached verification code page');
      console.log('📧 Check your email for the verification code');
    } else {
      addDebugStep('Verification Code Page', 'warning', 'Did not reach verification code page');
      console.log('⚠️ Did not reach verification code page');
    }

    await sleep(3000);
    await takeScreenshot('Final State');

    // Final status
    const finalStatus = await page.evaluate(() => {
      return {
        currentUrl: window.location.href,
        pageTitle: document.title,
        hasEmailInput: !!document.querySelector('input[type="email"]'),
        hasCodeInput: !!document.querySelector('input[type="text"], input[placeholder*="code"]'),
        hasVerificationText: document.body.innerText.toLowerCase().includes('verification')
      };
    });

    console.log('Final status:', finalStatus);
    addDebugStep('Final Status', 'info', 'Login process completed', finalStatus);

    return {
      success: true,
      message: 'Recraft.ai login process completed',
      finalUrl: finalStatus.currentUrl,
      debugSteps,
      screenshots
    };

  } catch (error) {
    console.error('❌ Recraft.ai login error:', error);
    addDebugStep('Error', 'error', 'Login process failed', null, error.message);
    
    return {
      success: false,
      error: error.message,
      debugSteps,
      screenshots
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function for sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { scrapeRecraftLogin };
