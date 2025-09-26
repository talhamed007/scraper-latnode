const puppeteer = require('puppeteer');

// Recraft.ai Login Scraper - Google Login
async function scrapeRecraftLogin(googleEmail, googlePassword) {
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
    console.log('🚀 Starting Recraft.ai Google Login Scraper...');
    console.log('📧 Google Email:', googleEmail);

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

    // Look for Google login button
    addDebugStep('Google Login Button', 'info', 'Looking for Google login button');
    console.log('🔍 Looking for Google login button...');
    
    try {
      // Wait for Google login button
      await page.waitForSelector('button:has-text("Google"), a:has-text("Google"), [data-testid*="google"], [class*="google"], svg[viewBox*="24"]', { timeout: 15000 });
      
      // Try to click Google button
      const googleClicked = await page.evaluate(() => {
        const selectors = [
          'button:has-text("Google")',
          'a:has-text("Google")',
          '[data-testid*="google"]',
          '[class*="google"]',
          'svg[viewBox*="24"]'
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

      if (googleClicked) {
        addDebugStep('Google Login Button', 'success', 'Clicked Google login button');
        console.log('✅ Google login button clicked');
      } else {
        addDebugStep('Google Login Button', 'error', 'Could not find or click Google login button');
        console.log('❌ Could not find Google login button');
      }
    } catch (error) {
      addDebugStep('Google Login Button', 'error', 'Error finding Google login button', null, error.message);
      console.log('❌ Error finding Google login button:', error.message);
    }

    await sleep(5000);
    await takeScreenshot('After Google Button Click');
    addDebugStep('Google Login Button', 'success', 'Navigated to Google login page');

    // Wait for Google login page to load
    addDebugStep('Google Login Page', 'info', 'Waiting for Google login page');
    console.log('⏳ Waiting for Google login page to load...');
    
    await sleep(5000);
    await takeScreenshot('Google Login Page');

    // Wait for Google email input field
    addDebugStep('Google Email Input', 'info', 'Waiting for Google email input field');
    console.log('📧 Waiting for Google email input field...');
    
    try {
      await page.waitForSelector('input[type="email"], input[name="identifier"], input[id="identifierId"], input[placeholder*="email"], input[placeholder*="Email"]', { timeout: 15000 });
      addDebugStep('Google Email Input', 'success', 'Found Google email input field');
      console.log('✅ Found Google email input field');
    } catch (error) {
      addDebugStep('Google Email Input', 'error', 'Could not find Google email input field', null, error.message);
      console.log('❌ Could not find Google email input field:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Email Input Found');

    // Fill Google email
    addDebugStep('Google Email Entry', 'info', 'Filling Google email field');
    console.log('✍️ Filling Google email field...');
    
    try {
      await page.type('input[type="email"], input[name="identifier"], input[id="identifierId"], input[placeholder*="email"], input[placeholder*="Email"]', googleEmail, { delay: 100 });
      addDebugStep('Google Email Entry', 'success', 'Google email filled successfully');
      console.log('✅ Google email filled successfully');
    } catch (error) {
      addDebugStep('Google Email Entry', 'error', 'Failed to fill Google email', null, error.message);
      console.log('❌ Failed to fill Google email:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Email Filled');

    // Click Next/Continue button for email
    addDebugStep('Google Email Next', 'info', 'Looking for Next button after email');
    console.log('➡️ Looking for Next button after email...');
    
    try {
      await page.waitForSelector('button:has-text("Next"), input[type="submit"], button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")', { timeout: 10000 });
      
      const nextClicked = await page.evaluate(() => {
        const selectors = [
          'button:has-text("Next")',
          'input[type="submit"]',
          'button[type="submit"]',
          'button:has-text("Continue")',
          'button:has-text("Sign in")'
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

      if (nextClicked) {
        addDebugStep('Google Email Next', 'success', 'Clicked Next button after email');
        console.log('✅ Next button clicked after email');
      } else {
        addDebugStep('Google Email Next', 'error', 'Could not find or click Next button');
        console.log('❌ Could not find Next button');
      }
    } catch (error) {
      addDebugStep('Google Email Next', 'error', 'Error finding Next button', null, error.message);
      console.log('❌ Error finding Next button:', error.message);
    }

    await sleep(5000);
    await takeScreenshot('After Email Next Click');

    // Wait for Google password input field
    addDebugStep('Google Password Input', 'info', 'Waiting for Google password input field');
    console.log('🔒 Waiting for Google password input field...');
    
    try {
      await page.waitForSelector('input[type="password"], input[name="password"], input[id="password"], input[placeholder*="password"], input[placeholder*="Password"]', { timeout: 15000 });
      addDebugStep('Google Password Input', 'success', 'Found Google password input field');
      console.log('✅ Found Google password input field');
    } catch (error) {
      addDebugStep('Google Password Input', 'error', 'Could not find Google password input field', null, error.message);
      console.log('❌ Could not find Google password input field:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Password Input Found');

    // Fill Google password
    addDebugStep('Google Password Entry', 'info', 'Filling Google password field');
    console.log('🔐 Filling Google password field...');
    
    try {
      await page.type('input[type="password"], input[name="password"], input[id="password"], input[placeholder*="password"], input[placeholder*="Password"]', googlePassword, { delay: 100 });
      addDebugStep('Google Password Entry', 'success', 'Google password filled successfully');
      console.log('✅ Google password filled successfully');
    } catch (error) {
      addDebugStep('Google Password Entry', 'error', 'Failed to fill Google password', null, error.message);
      console.log('❌ Failed to fill Google password:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Password Filled');

    // Click Next/Continue button for password
    addDebugStep('Google Password Next', 'info', 'Looking for Next button after password');
    console.log('➡️ Looking for Next button after password...');
    
    try {
      await page.waitForSelector('button:has-text("Next"), input[type="submit"], button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")', { timeout: 10000 });
      
      const nextClicked = await page.evaluate(() => {
        const selectors = [
          'button:has-text("Next")',
          'input[type="submit"]',
          'button[type="submit"]',
          'button:has-text("Continue")',
          'button:has-text("Sign in")'
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

      if (nextClicked) {
        addDebugStep('Google Password Next', 'success', 'Clicked Next button after password');
        console.log('✅ Next button clicked after password');
      } else {
        addDebugStep('Google Password Next', 'error', 'Could not find or click Next button');
        console.log('❌ Could not find Next button');
      }
    } catch (error) {
      addDebugStep('Google Password Next', 'error', 'Error finding Next button', null, error.message);
      console.log('❌ Error finding Next button:', error.message);
    }

    await sleep(10000);
    await takeScreenshot('After Password Next Click');

    // Check if we're redirected back to Recraft.ai
    const redirectCheck = await page.evaluate(() => {
      const currentUrl = window.location.href;
      const isRecraft = currentUrl.includes('recraft.ai');
      const isGoogle = currentUrl.includes('google.com') || currentUrl.includes('accounts.google.com');
      
      return {
        currentUrl,
        isRecraft,
        isGoogle,
        pageTitle: document.title
      };
    });

    console.log('Redirect check:', redirectCheck);
    addDebugStep('Redirect Check', 'info', 'Checking if redirected back to Recraft.ai', redirectCheck);

    if (redirectCheck.isRecraft) {
      addDebugStep('Recraft.ai Redirect', 'success', 'Successfully redirected back to Recraft.ai');
      console.log('✅ Successfully redirected back to Recraft.ai');
    } else if (redirectCheck.isGoogle) {
      addDebugStep('Google Redirect', 'warning', 'Still on Google page, may need additional steps');
      console.log('⚠️ Still on Google page, may need additional steps');
    } else {
      addDebugStep('Unknown Redirect', 'warning', 'Unknown redirect location');
      console.log('⚠️ Unknown redirect location');
    }

    await sleep(5000);
    await takeScreenshot('Final State');

    // Final status
    const finalStatus = await page.evaluate(() => {
      return {
        currentUrl: window.location.href,
        pageTitle: document.title,
        hasRecraftElements: !!document.querySelector('[class*="recraft"], [id*="recraft"]'),
        hasGoogleElements: !!document.querySelector('[class*="google"], [id*="google"]'),
        bodyText: document.body.innerText.substring(0, 200)
      };
    });

    console.log('Final status:', finalStatus);
    addDebugStep('Final Status', 'info', 'Google login process completed', finalStatus);

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
