const puppeteer = require('puppeteer');

// Recraft.ai Login Scraper - Separate from main server.js
async function scrapeRecraftLogin(discordToken, recraftEmail) {
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
    console.log('🔑 Discord Token:', discordToken ? 'Provided' : 'Not provided');
    console.log('📧 Recraft Email:', recraftEmail);

    addDebugStep('Scraper Started', 'info', 'Initializing Recraft.ai login scraper');

    // Launch browser
    addDebugStep('Browser Launch', 'info', 'Launching Puppeteer browser');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    addDebugStep('Browser Launch', 'success', 'Browser launched successfully');

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // STEP 1: Login to Discord with token
    console.log('🔐 STEP 1: Logging into Discord with token...');
    addDebugStep('Discord Login', 'info', 'Starting Discord token authentication');

    try {
      // Navigate to Discord login page
      console.log('🌐 Navigating to Discord login page...');
      await page.goto('https://discord.com/login', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      await sleep(3000);
      await takeScreenshot('Discord Login Page');
      addDebugStep('Discord Navigation', 'success', 'Navigated to Discord login page');

      // Inject Discord token into browser storage
      console.log('🔑 Injecting Discord token...');
      const tokenInjection = await page.evaluate((token) => {
        try {
          // Set token in localStorage
          localStorage.setItem('token', token);
          localStorage.setItem('auth_token', token);
          localStorage.setItem('discord_token', token);
          
          // Set token in sessionStorage
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('auth_token', token);
          sessionStorage.setItem('discord_token', token);
          
          // Set token in cookies
          document.cookie = `token=${token}; domain=.discord.com; path=/; secure; samesite=none`;
          document.cookie = `auth_token=${token}; domain=.discord.com; path=/; secure; samesite=none`;
          document.cookie = `discord_token=${token}; domain=.discord.com; path=/; secure; samesite=none`;
          
          return { success: true, message: 'Token injected successfully' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, discordToken);

      console.log('Token injection result:', tokenInjection);
      addDebugStep('Token Injection', tokenInjection.success ? 'success' : 'error', 
        tokenInjection.success ? 'Token injected successfully' : 'Token injection failed', tokenInjection);

      // Wait for token to be processed
      await sleep(2000);
      await takeScreenshot('After Token Injection');

      // Validate token via Discord API
      console.log('🔍 Validating Discord token...');
      const tokenValidation = await page.evaluate(async (token) => {
        try {
          const response = await fetch('https://discord.com/api/v9/users/@me', {
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            return { success: true, user: userData };
          } else {
            return { success: false, status: response.status };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, discordToken);

      console.log('Token validation result:', tokenValidation);
      addDebugStep('Token Validation', tokenValidation.success ? 'success' : 'error', 
        tokenValidation.success ? `Token valid for user: ${tokenValidation.user?.username}` : 'Token validation failed', tokenValidation);

      // Refresh page to apply token
      console.log('🔄 Refreshing page to apply token...');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(3000);
      await takeScreenshot('After Page Refresh');

      // Check if Discord login was successful
      const discordLoginStatus = await page.evaluate(() => {
        const userElements = document.querySelectorAll('[class*="user"], [class*="avatar"], [class*="profile"]');
        const channelElements = document.querySelectorAll('[class*="channel"], [class*="server"]');
        const sidebarElements = document.querySelectorAll('[class*="sidebar"], [class*="guild"]');
        
        return {
          userElementsFound: userElements.length > 0,
          channelElementsFound: channelElements.length > 0,
          sidebarElementsFound: sidebarElements.length > 0,
          currentUrl: window.location.href,
          pageTitle: document.title,
          hasToken: !!localStorage.getItem('token') || !!sessionStorage.getItem('token')
        };
      });

      console.log('Discord login status:', discordLoginStatus);
      
      if (discordLoginStatus.userElementsFound || discordLoginStatus.channelElementsFound || discordLoginStatus.sidebarElementsFound) {
        console.log('✅ Discord login successful!');
        addDebugStep('Discord Login', 'success', 'Discord login successful', discordLoginStatus);
      } else {
        console.log('⚠️ Discord login may have failed');
        addDebugStep('Discord Login', 'warning', 'Discord login may have failed', discordLoginStatus);
      }

      await takeScreenshot('Discord Login Final Status');

    } catch (e) {
      console.log('❌ Discord login failed:', e.message);
      addDebugStep('Discord Login', 'error', 'Discord login failed', null, e.message);
      await takeScreenshot('Discord Login Error');
    }

    // STEP 2: Navigate to Recraft.ai
    console.log('🌐 STEP 2: Navigating to Recraft.ai...');
    addDebugStep('Recraft Navigation', 'info', 'Navigating to Recraft.ai');

    try {
      await page.goto('https://www.recraft.ai/', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      
      await sleep(3000);
      await takeScreenshot('Recraft.ai Homepage');
      addDebugStep('Recraft Navigation', 'success', 'Successfully navigated to Recraft.ai', `URL: ${page.url()}`);

    } catch (e) {
      console.log('❌ Failed to navigate to Recraft.ai:', e.message);
      addDebugStep('Recraft Navigation', 'error', 'Failed to navigate to Recraft.ai', null, e.message);
      await takeScreenshot('Recraft Navigation Error');
    }

    // STEP 3: Handle cookie consent
    console.log('🍪 STEP 3: Handling cookie consent...');
    addDebugStep('Cookie Consent', 'info', 'Checking for cookie consent popup');

    try {
      await sleep(2000);
      
      const cookieSelectors = [
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept all cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button[data-testid="accept-all-cookies"]',
        'button[data-testid="accept-cookies"]',
        '.cookie-accept-all',
        '.accept-all-cookies'
      ];
      
      let cookieAccepted = false;
      for (const selector of cookieSelectors) {
        try {
          const cookieButton = await page.$(selector);
          if (cookieButton) {
            console.log('🍪 Found cookie consent, clicking accept...');
            await cookieButton.click();
            await sleep(1000);
            cookieAccepted = true;
            addDebugStep('Cookie Consent', 'success', 'Cookie consent accepted');
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!cookieAccepted) {
        console.log('ℹ️ No cookie consent popup found');
        addDebugStep('Cookie Consent', 'info', 'No cookie consent popup found');
      }
      
      await takeScreenshot('After Cookie Handling');

    } catch (e) {
      console.log('ℹ️ Cookie consent handling failed:', e.message);
      addDebugStep('Cookie Consent', 'warning', 'Cookie consent handling failed', null, e.message);
    }

    // STEP 4: Click Sign In button
    console.log('🔑 STEP 4: Looking for Sign In button...');
    addDebugStep('Sign In Button', 'info', 'Looking for Sign In button');

    try {
      const signInSelectors = [
        'a[data-testid="main-page-login"]',
        'a[href*="/auth/login"]',
        'a:has-text("Sign in")',
        'a:has-text("Sign In")',
        'button:has-text("Sign in")',
        'button:has-text("Sign In")',
        '[href*="sign-in"]',
        '[href*="login"]',
        '.sign-in-button',
        '.login-button'
      ];
      
      let signInClicked = false;
      for (const selector of signInSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          signInClicked = true;
          console.log('✅ Sign in button clicked with selector:', selector);
          addDebugStep('Sign In Button', 'success', 'Sign in button clicked', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Sign in selector failed:', selector, e.message);
        }
      }
      
      if (!signInClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, a, [role="button"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            console.log('✅ Found Sign in button by text:', text);
            await button.click();
            signInClicked = true;
            addDebugStep('Sign In Button', 'success', 'Sign in button clicked by text', `Text: ${text}`);
            break;
          }
        }
      }
      
      if (!signInClicked) {
        throw new Error('Could not find Sign In button');
      }
      
      await sleep(3000);
      await takeScreenshot('After Sign In Click');

    } catch (e) {
      console.log('❌ Could not click Sign In button:', e.message);
      addDebugStep('Sign In Button', 'error', 'Could not click Sign In button', null, e.message);
      await takeScreenshot('Sign In Error');
    }

    // STEP 5: Handle "Sorry, nothing to see here" error page
    console.log('🚫 STEP 5: Checking for error page...');
    addDebugStep('Error Page Check', 'info', 'Checking for error page');

    try {
      const isErrorPage = await page.evaluate(() => {
        const pageText = document.body.innerText || '';
        return pageText.includes('Sorry, nothing to see here') || 
               pageText.includes('Go back to recraft') ||
               pageText.includes('error') ||
               pageText.includes('Error');
      });
      
      if (isErrorPage) {
        console.log('🚫 Found error page, looking for "Go back to recraft" button...');
        addDebugStep('Error Page', 'warning', 'Found error page, looking for Go back button');
        
        const goBackSelectors = [
          'a[href="/projects"]',
          'a.c-bZNrxE',
          'a[class*="c-bZNrxE"]',
          'a[class*="c-cfmRqm"]',
          'a:has-text("Go back to recraft")',
          'a:has-text("Go back to Recraft")',
          'button:has-text("Go back to recraft")',
          'button:has-text("Go back to Recraft")',
          '[href*="recraft"]',
          'button[class*="back"]',
          'a[class*="back"]'
        ];
        
        let goBackClicked = false;
        for (const selector of goBackSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            await page.click(selector);
            goBackClicked = true;
            console.log('✅ Go back button clicked with selector:', selector);
            addDebugStep('Go Back Button', 'success', 'Go back button clicked', `Selector: ${selector}`);
            break;
          } catch (e) {
            console.log('⚠️ Go back selector failed:', selector, e.message);
          }
        }
        
        if (goBackClicked) {
          await sleep(3000);
          await takeScreenshot('After Go Back Button');
        } else {
          console.log('⚠️ Could not find Go back button');
          addDebugStep('Go Back Button', 'error', 'Could not find Go back button');
        }
      } else {
        console.log('✅ No error page detected');
        addDebugStep('Error Page Check', 'success', 'No error page detected');
      }
      
    } catch (e) {
      console.log('ℹ️ Error page check failed:', e.message);
      addDebugStep('Error Page Check', 'warning', 'Error page check failed', null, e.message);
    }

    // STEP 6: Fill email and continue
    console.log('📧 STEP 6: Filling email address...');
    addDebugStep('Email Entry', 'info', 'Filling in email address');

    try {
      await sleep(3000);
      
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="Email" i]',
        'input[autocomplete="email"]',
        '#email',
        '.email-input'
      ];
      
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.type(selector, recraftEmail, { delay: 50 });
          emailFilled = true;
          console.log('✅ Email filled with selector:', selector);
          addDebugStep('Email Entry', 'success', 'Email filled successfully', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Email selector failed:', selector, e.message);
        }
      }
      
      if (!emailFilled) {
        throw new Error('Could not find email input field');
      }
      
      await sleep(1000);
      await takeScreenshot('After Email Entry');

    } catch (e) {
      console.log('❌ Could not fill email:', e.message);
      addDebugStep('Email Entry', 'error', 'Could not fill email', null, e.message);
      await takeScreenshot('Email Entry Error');
    }

    // STEP 7: Check verification checkbox
    console.log('🤖 STEP 7: Checking verification checkbox...');
    addDebugStep('Human Verification', 'info', 'Checking human verification checkbox');

    try {
      const checkboxSelectors = [
        'input[type="checkbox"]',
        'input[name*="human" i]',
        'input[name*="verify" i]',
        'input[name*="captcha" i]',
        '.human-verify',
        '.verify-human',
        '[data-testid="human-verify"]'
      ];
      
      let checkboxChecked = false;
      for (const selector of checkboxSelectors) {
        try {
          const checkbox = await page.$(selector);
          if (checkbox) {
            const isChecked = await page.evaluate(el => el.checked, checkbox);
            if (!isChecked) {
              await checkbox.click();
              checkboxChecked = true;
              console.log('✅ Human verification checkbox checked with selector:', selector);
              addDebugStep('Human Verification', 'success', 'Human verification checkbox checked', `Selector: ${selector}`);
              break;
            } else {
              console.log('ℹ️ Human verification checkbox already checked');
              addDebugStep('Human Verification', 'info', 'Human verification checkbox already checked');
              checkboxChecked = true;
              break;
            }
          }
        } catch (e) {
          console.log('⚠️ Checkbox selector failed:', selector, e.message);
        }
      }
      
      if (!checkboxChecked) {
        console.log('⚠️ Could not find human verification checkbox');
        addDebugStep('Human Verification', 'warning', 'Could not find human verification checkbox');
      }
      
      await sleep(1000);
      await takeScreenshot('After Human Verification');

    } catch (e) {
      console.log('ℹ️ Human verification checkbox handling failed:', e.message);
      addDebugStep('Human Verification', 'warning', 'Human verification checkbox handling failed', null, e.message);
    }

    // STEP 8: Click Continue button
    console.log('➡️ STEP 8: Clicking Continue button...');
    addDebugStep('Continue Button', 'info', 'Clicking Continue button');

    try {
      const continueSelectors = [
        'button:has-text("Continue")',
        'button:has-text("continue")',
        'button[type="submit"]',
        '.continue-button'
      ];
      
      let continueClicked = false;
      for (const selector of continueSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          continueClicked = true;
          console.log('✅ Continue button clicked with selector:', selector);
          addDebugStep('Continue Button', 'success', 'Continue button clicked', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Continue selector failed:', selector, e.message);
        }
      }
      
      if (!continueClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value || '', button);
          if (text && text.toLowerCase().includes('continue')) {
            console.log('✅ Continue button clicked by text:', text);
            await button.click();
            continueClicked = true;
            addDebugStep('Continue Button', 'success', 'Continue button clicked by text', `Text: ${text}`);
            break;
          }
        }
      }
      
      if (!continueClicked) {
        throw new Error('Could not find Continue button');
      }
      
      await sleep(3000);
      await takeScreenshot('After Continue Click');

    } catch (e) {
      console.log('❌ Could not click Continue button:', e.message);
      addDebugStep('Continue Button', 'error', 'Could not click Continue button', null, e.message);
      await takeScreenshot('Continue Button Error');
    }

    // STEP 9: Look for Discord button
    console.log('🎮 STEP 9: Looking for Discord button...');
    addDebugStep('Discord Button', 'info', 'Looking for Discord login button');

    try {
      await sleep(3000);
      
      const discordSelectors = [
        'button[aria-label*="Discord"]',
        'button:has-text("Discord")',
        'a[href*="discord"]',
        'button svg path[d*="M20.3303"]',
        'button:has(svg path[d*="M20.3303"])',
        '[data-testid*="discord"]',
        'button[class*="discord"]'
      ];
      
      let discordClicked = false;
      for (const selector of discordSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          discordClicked = true;
          console.log('✅ Discord button clicked with selector:', selector);
          addDebugStep('Discord Button', 'success', 'Discord button clicked', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Discord selector failed:', selector, e.message);
        }
      }
      
      if (!discordClicked) {
        // Fallback: search all buttons for Discord
        const buttons = await page.$$('button, a');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          const innerHTML = await page.evaluate(el => el.innerHTML || '', button);
          
          if (text.toLowerCase().includes('discord') || innerHTML.includes('M20.3303')) {
            console.log('✅ Found Discord button by content:', text);
            await button.click();
            discordClicked = true;
            addDebugStep('Discord Button', 'success', 'Discord button clicked by content', `Text: ${text}`);
            break;
          }
        }
      }
      
      if (discordClicked) {
        await sleep(3000);
        await takeScreenshot('After Discord Button Click');
        
        // Check if we're on Discord OAuth page
        const currentUrl = page.url();
        console.log('📍 Current URL after Discord click:', currentUrl);
        
        if (currentUrl.includes('discord.com') && currentUrl.includes('oauth')) {
          console.log('✅ Successfully redirected to Discord OAuth page');
          addDebugStep('Discord OAuth Redirect', 'success', 'Successfully redirected to Discord OAuth page', `URL: ${currentUrl}`);
          
          await takeScreenshot('Discord OAuth Page');
          
          // Look for Authorize button
          try {
            const authorizeSelectors = [
              'button:has-text("Authorize")',
              'button:has-text("authorize")',
              'button:has-text("Allow")',
              'button:has-text("allow")',
              'button[type="submit"]',
              'button[class*="authorize"]',
              'button[class*="allow"]'
            ];
            
            let authorized = false;
            for (const selector of authorizeSelectors) {
              try {
                await page.waitForSelector(selector, { timeout: 3000 });
                await page.click(selector);
                authorized = true;
                console.log('✅ Authorize button clicked with selector:', selector);
                addDebugStep('Discord Authorization', 'success', 'Authorize button clicked', `Selector: ${selector}`);
                break;
              } catch (e) {
                console.log('⚠️ Authorize selector failed:', selector, e.message);
              }
            }
            
            if (authorized) {
              await sleep(5000);
              await takeScreenshot('After Discord Authorization');
              
              // Check if we're back on Recraft.ai
              const finalUrl = page.url();
              console.log('📍 Final URL after authorization:', finalUrl);
              
              if (finalUrl.includes('recraft.ai')) {
                console.log('✅ Successfully returned to Recraft.ai after Discord auth');
                addDebugStep('Return to Recraft', 'success', 'Successfully returned to Recraft.ai after Discord auth', `URL: ${finalUrl}`);
              } else {
                console.log('⚠️ Did not return to Recraft.ai after Discord auth');
                addDebugStep('Return to Recraft', 'warning', 'Did not return to Recraft.ai after Discord auth', `URL: ${finalUrl}`);
              }
            } else {
              addDebugStep('Discord Authorization', 'warning', 'Could not find Authorize button on OAuth page');
            }
          } catch (e) {
            console.log('⚠️ Discord authorization failed:', e.message);
            addDebugStep('Discord Authorization', 'error', 'Discord authorization failed', null, e.message);
          }
        } else if (currentUrl.includes('recraft.ai')) {
          console.log('✅ Already on Recraft.ai - Discord session may be established');
          addDebugStep('Discord Session Check', 'success', 'Already on Recraft.ai - Discord session may be established', `URL: ${currentUrl}`);
        } else {
          console.log('⚠️ Did not redirect to Discord OAuth page');
          addDebugStep('Discord OAuth Redirect', 'warning', 'Did not redirect to Discord OAuth page', `Current URL: ${currentUrl}`);
        }
      } else {
        addDebugStep('Discord Button', 'error', 'Could not find Discord button');
        console.log('⚠️ Could not find Discord button');
      }
      
    } catch (e) {
      console.log('⚠️ Discord button handling failed:', e.message);
      addDebugStep('Discord Button', 'error', 'Discord button handling failed', null, e.message);
      await takeScreenshot('Discord Button Error');
    }

    // STEP 10: Check if we're logged in to Recraft.ai
    console.log('🔍 STEP 10: Checking Recraft.ai login status...');
    addDebugStep('Recraft Login Check', 'info', 'Checking if logged into Recraft.ai');

    try {
      const isLoggedIn = await page.evaluate(() => {
        const userMenu = document.querySelector('[class*="user"]') || document.querySelector('[data-testid*="user"]');
        const dashboard = document.querySelector('[class*="dashboard"]') || document.querySelector('[data-testid*="dashboard"]');
        const credits = document.querySelector('[class*="credit"]') || document.querySelector('[class*="balance"]');
        
        return !!(userMenu || dashboard || credits);
      });
      
      if (isLoggedIn) {
        console.log('✅ Successfully logged into Recraft.ai!');
        addDebugStep('Recraft Login Check', 'success', 'Successfully logged into Recraft.ai');
      } else {
        console.log('⚠️ Not logged into Recraft.ai yet');
        addDebugStep('Recraft Login Check', 'warning', 'Not logged into Recraft.ai yet');
      }
      
      await takeScreenshot('Final Recraft.ai Status');
      
    } catch (e) {
      console.log('⚠️ Recraft.ai login check failed:', e.message);
      addDebugStep('Recraft Login Check', 'error', 'Recraft.ai login check failed', null, e.message);
    }

    // Return success response with debug data
    return {
      ok: true,
      message: 'Recraft.ai login process completed',
      finalUrl: page.url(),
      debugSteps: debugSteps,
      screenshots: screenshots
    };

  } catch (error) {
    console.error('❌ Scraping error:', error);
    
    // Take error screenshot if possible
    let errorScreenshot = null;
    try {
      if (page) {
        errorScreenshot = await page.screenshot({ fullPage: true });
      }
    } catch (e) {
      console.log('Could not take error screenshot:', e.message);
    }

    return {
      ok: false,
      error: error.message,
      debugSteps: debugSteps,
      screenshots: screenshots,
      errorScreenshot: errorScreenshot ? errorScreenshot.toString('base64') : null
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeRecraftLogin };
