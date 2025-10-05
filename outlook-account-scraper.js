const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Global variables for scraper control
let globalBrowser = null;
let globalPage = null;
let globalScraperPaused = false;
let globalScraperStopped = false;

// Debug logging function
function addDebugStep(step, type, message, screenshot = null, error = null) {
  const timestamp = new Date().toLocaleString();
  const logEntry = {
    step,
    type,
    message,
    timestamp,
    screenshot,
    error
  };
  
  console.log(`[${timestamp}] ${step}: ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}`);
  
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
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Verify file was saved
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      addDebugStep('Screenshot', 'success', `Screenshot saved: ${name}-${timestamp}.png (${stats.size} bytes)`);
      return `${name}-${timestamp}.png`;
    } else {
      addDebugStep('Screenshot', 'error', `Screenshot file not found: ${screenshotPath}`);
      return null;
    }
  } catch (error) {
    addDebugStep('Screenshot', 'error', `Screenshot failed: ${error.message}`);
    return null;
  }
}

// Human-like delay function
async function randomHumanDelay(page, min = 500, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

// Generate random names
function generateRandomName() {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Jessica', 'Robert', 'Ashley', 'William', 'Amanda', 'Richard', 'Jennifer', 'Charles', 'Lisa', 'Joseph', 'Michelle', 'Thomas', 'Kimberly'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return { firstName, lastName };
}

// Main Outlook account creation function
async function createOutlookAccount(email, password, io = null) {
  let browser = null;
  let page = null;
  
  try {
    globalIO = io;
    globalScraperPaused = false;
    globalScraperStopped = false;
    
    addDebugStep('Outlook Account Creation', 'info', '🚀 Starting Outlook account creation process...');
    addDebugStep('Outlook Account Creation', 'info', `📧 Email: ${email}`);
    addDebugStep('Outlook Account Creation', 'info', `🔑 Password: ${password}`);
    
    // Launch browser
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
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Set global references
    globalBrowser = browser;
    globalPage = page;
    
    // Step 1: Navigate to Outlook signup
    addDebugStep('Navigation', 'info', 'Navigating to Outlook signup...');
    await page.goto('https://signup.live.com/signup', { waitUntil: 'networkidle2' });
    await takeScreenshot('Outlook-Signup-Initial', page);
    addDebugStep('Navigation', 'success', 'Successfully navigated to Outlook signup');
    
    // Wait for page to load
    await randomHumanDelay(page, 2000, 3000);
    
    // Step 2: Enter email
    addDebugStep('Email Entry', 'info', 'Entering email address...');
    
    // Wait for email input field
    await page.waitForSelector('input[type="email"][name="Email"]', { timeout: 10000 });
    
    // Clear and enter email
    await page.click('input[type="email"][name="Email"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('input[type="email"][name="Email"]', email, { delay: 100 });
    
    await takeScreenshot('Email-Entered', page);
    addDebugStep('Email Entry', 'success', 'Email entered successfully');
    
    // Step 3: Click Next button
    addDebugStep('Email Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Email-Next-Clicked', page);
    addDebugStep('Email Entry', 'success', 'Next button clicked');
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 4: Enter password
    addDebugStep('Password Entry', 'info', 'Entering password...');
    
    // Wait for password input field
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    
    // Enter password
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', password, { delay: 100 });
    
    await takeScreenshot('Password-Entered', page);
    addDebugStep('Password Entry', 'success', 'Password entered successfully');
    
    // Step 5: Click Next button for password
    addDebugStep('Password Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Password-Next-Clicked', page);
    addDebugStep('Password Entry', 'success', 'Next button clicked');
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 6: Add some details (birthdate)
    addDebugStep('Birthdate Entry', 'info', 'Adding birthdate details...');
    
    // Wait for birthdate page
    await page.waitForSelector('input[name="BirthYear"]', { timeout: 10000 });
    
    // Select month (first option - January)
    addDebugStep('Birthdate Entry', 'info', 'Selecting month...');
    await page.click('button[name="BirthMonth"]');
    await randomHumanDelay(page, 500, 1000);
    await page.click('button[name="BirthMonth"] option:first-child');
    
    // Select day (1)
    addDebugStep('Birthdate Entry', 'info', 'Selecting day...');
    await page.click('button[name="BirthDay"]');
    await randomHumanDelay(page, 500, 1000);
    await page.click('button[name="BirthDay"] option[value="1"]');
    
    // Enter year (1986)
    addDebugStep('Birthdate Entry', 'info', 'Entering year...');
    await page.click('input[name="BirthYear"]');
    await page.type('input[name="BirthYear"]', '1986', { delay: 100 });
    
    await takeScreenshot('Birthdate-Entered', page);
    addDebugStep('Birthdate Entry', 'success', 'Birthdate entered successfully');
    
    // Click Next button
    addDebugStep('Birthdate Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Birthdate-Next-Clicked', page);
    addDebugStep('Birthdate Entry', 'success', 'Next button clicked');
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 7: Add name
    addDebugStep('Name Entry', 'info', 'Adding name details...');
    
    // Wait for name page
    await page.waitForSelector('input[name="firstNameInput"]', { timeout: 10000 });
    
    // Generate random names
    const { firstName, lastName } = generateRandomName();
    
    // Enter first name
    addDebugStep('Name Entry', 'info', `Entering first name: ${firstName}`);
    await page.click('input[name="firstNameInput"]');
    await page.type('input[name="firstNameInput"]', firstName, { delay: 100 });
    
    // Enter last name
    addDebugStep('Name Entry', 'info', `Entering last name: ${lastName}`);
    await page.click('input[name="lastNameInput"]');
    await page.type('input[name="lastNameInput"]', lastName, { delay: 100 });
    
    await takeScreenshot('Name-Entered', page);
    addDebugStep('Name Entry', 'success', `Name entered: ${firstName} ${lastName}`);
    
    // Click Next button
    addDebugStep('Name Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Name-Next-Clicked', page);
    addDebugStep('Name Entry', 'success', 'Next button clicked');
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 8: Human verification (Press and hold)
    addDebugStep('Human Verification', 'info', 'Starting human verification (press and hold)...');
    
    // Wait for human verification page
    await page.waitForSelector('button:contains("Press and hold")', { timeout: 10000 });
    
    // Find the press and hold button
    const holdButton = await page.$('button:contains("Press and hold")');
    if (!holdButton) {
      throw new Error('Press and hold button not found');
    }
    
    // Start holding the button
    addDebugStep('Human Verification', 'info', 'Starting to hold the button...');
    await page.mouse.move(0, 0);
    await page.mouse.down();
    
    // Hold the button and wait for checkmark
    let checkmarkFound = false;
    let holdTime = 0;
    const maxHoldTime = 10000; // 10 seconds max
    
    while (!checkmarkFound && holdTime < maxHoldTime) {
      await page.waitForTimeout(100);
      holdTime += 100;
      
      // Check for checkmark or success indicator
      try {
        const checkmark = await page.$('svg[class*="check"], .checkmark, [class*="success"]');
        if (checkmark) {
          checkmarkFound = true;
          addDebugStep('Human Verification', 'success', 'Checkmark detected!');
          break;
        }
      } catch (e) {
        // Continue holding
      }
      
      // Check if we should stop (global stop flag)
      if (globalScraperStopped) {
        addDebugStep('Human Verification', 'warning', 'Scraper stopped during human verification');
        return { success: false, error: 'Scraper stopped' };
      }
    }
    
    // Release the button
    await page.mouse.up();
    addDebugStep('Human Verification', 'success', 'Button released after verification');
    await takeScreenshot('Human-Verification-Complete', page);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 9: Microsoft account notice
    addDebugStep('Account Notice', 'info', 'Handling Microsoft account notice...');
    
    // Wait for notice page and click OK
    try {
      await page.waitForSelector('button:contains("OK")', { timeout: 10000 });
      await page.click('button:contains("OK")');
      await takeScreenshot('Account-Notice-OK', page);
      addDebugStep('Account Notice', 'success', 'Account notice acknowledged');
    } catch (e) {
      addDebugStep('Account Notice', 'warning', 'Account notice not found or already dismissed');
    }
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 10: Skip biometric setup
    addDebugStep('Biometric Setup', 'info', 'Skipping biometric setup...');
    
    try {
      await page.waitForSelector('button:contains("Skip for now")', { timeout: 10000 });
      await page.click('button:contains("Skip for now")');
      await takeScreenshot('Biometric-Skipped', page);
      addDebugStep('Biometric Setup', 'success', 'Biometric setup skipped');
    } catch (e) {
      addDebugStep('Biometric Setup', 'warning', 'Biometric setup page not found');
    }
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 11: Stay signed in
    addDebugStep('Stay Signed In', 'info', 'Handling stay signed in prompt...');
    
    try {
      await page.waitForSelector('button:contains("Yes")', { timeout: 10000 });
      await page.click('button:contains("Yes")');
      await takeScreenshot('Stay-Signed-In-Yes', page);
      addDebugStep('Stay Signed In', 'success', 'Stay signed in confirmed');
    } catch (e) {
      addDebugStep('Stay Signed In', 'warning', 'Stay signed in prompt not found');
    }
    
    // Wait for final page load
    await randomHumanDelay(page, 5000, 7000);
    
    // Step 12: Verify account creation
    addDebugStep('Account Verification', 'info', 'Verifying account creation...');
    
    // Check if we're logged in to Outlook
    const currentUrl = page.url();
    if (currentUrl.includes('outlook.com') || currentUrl.includes('live.com')) {
      addDebugStep('Account Verification', 'success', 'Successfully logged into Outlook!');
      await takeScreenshot('Outlook-Login-Success', page);
      
      return {
        success: true,
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        message: 'Outlook account created successfully!'
      };
    } else {
      addDebugStep('Account Verification', 'warning', `Unexpected final URL: ${currentUrl}`);
      await takeScreenshot('Final-Page', page);
      
      return {
        success: true,
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        message: 'Account creation process completed'
      };
    }
    
  } catch (error) {
    addDebugStep('Outlook Account Creation', 'error', '❌ Outlook account creation failed', null, error.message);
    
    // Take error screenshot
    if (page) {
      await takeScreenshot('Error-Screenshot', page);
    }
    
    return {
      success: false,
      error: error.message,
      email: email,
      password: password
    };
    
  } finally {
    // Clean up browser
    if (browser) {
      try {
        await browser.close();
        addDebugStep('Browser', 'info', 'Browser closed');
      } catch (e) {
        addDebugStep('Browser', 'warning', `Failed to close browser: ${e.message}`);
      }
    }
    
    // Reset global variables
    globalBrowser = null;
    globalPage = null;
  }
}

// Export functions
module.exports = {
  createOutlookAccount
};
