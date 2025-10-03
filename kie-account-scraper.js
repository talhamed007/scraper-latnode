const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Global variable for Socket.IO instance
let globalIO = null;

// Helper function to add debug steps
function addDebugStep(step, type, message, screenshot = null, error = null) {
  const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const logEntry = {
    timestamp,
    step,
    type,
    message,
    screenshot,
    error
  };
  
  console.log(`[${timestamp}] ${step}: ${message}`);
  
  if (globalIO) {
    globalIO.emit('debugStep', logEntry);
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
    const filename = `kie-account-${timestamp}-${name}.png`;
    const screenshotPath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Verify screenshot was actually saved
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      addDebugStep('Screenshot', 'info', `Screenshot saved: ${filename} (${stats.size} bytes)`, filename);
    } else {
      addDebugStep('Screenshot', 'error', `Screenshot file not found after saving: ${filename}`);
    }
    
    return filename;
  } catch (error) {
    addDebugStep('Screenshot', 'error', `Failed to take screenshot: ${error.message}`);
    return null;
  }
}

// Human-like mouse movement and behavior functions
async function humanLikeMouseMove(page, fromX, fromY, toX, toY) {
  const steps = Math.floor(Math.random() * 10) + 5; // 5-15 steps
  const stepDelay = Math.random() * 50 + 20; // 20-70ms between steps
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Add some randomness to the path
    const randomOffsetX = (Math.random() - 0.5) * 20;
    const randomOffsetY = (Math.random() - 0.5) * 20;
    
    const currentX = fromX + (toX - fromX) * progress + randomOffsetX;
    const currentY = fromY + (toY - fromY) * progress + randomOffsetY;
    
    await page.mouse.move(currentX, currentY);
    await page.waitForTimeout(stepDelay);
  }
}

async function humanLikeClick(page, x, y, element = null) {
  // Move mouse to element first if provided
  if (element) {
    const box = await element.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await humanLikeMouseMove(page, 0, 0, centerX, centerY);
      await page.waitForTimeout(Math.random() * 200 + 100); // 100-300ms pause
    }
  } else if (x && y) {
    await humanLikeMouseMove(page, 0, 0, x, y);
    await page.waitForTimeout(Math.random() * 200 + 100);
  }
  
  // Click with slight delay
  await page.mouse.click(x || 0, y || 0, { 
    delay: Math.random() * 50 + 50 // 50-100ms delay
  });
}

async function humanLikeType(page, selector, text, options = {}) {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Focus the element
  await element.focus();
  await page.waitForTimeout(Math.random() * 100 + 50);
  
  // Clear existing text
  await element.click({ clickCount: 3 }); // Select all
  await page.waitForTimeout(Math.random() * 50 + 25);
  
  // Type character by character with human-like delays
  for (let i = 0; i < text.length; i++) {
    await element.type(text[i], { 
      delay: Math.random() * 100 + 50 // 50-150ms per character
    });
    
    // Occasional longer pauses (like human thinking)
    if (Math.random() < 0.1) {
      await page.waitForTimeout(Math.random() * 500 + 200);
    }
  }
  
  // Trigger events to simulate real typing
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }, selector);
}

async function humanLikeScroll(page, direction = 'down', distance = 300) {
  const scrollSteps = Math.floor(Math.random() * 5) + 3; // 3-8 steps
  const stepDistance = distance / scrollSteps;
  const stepDelay = Math.random() * 100 + 50; // 50-150ms between steps
  
  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel({ 
      deltaY: direction === 'down' ? stepDistance : -stepDistance 
    });
    await page.waitForTimeout(stepDelay);
  }
}

async function randomHumanDelay(min = 500, max = 2000) {
  const delay = Math.random() * (max - min) + min;
  await page.waitForTimeout(delay);
}

// Sleep function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// AI-powered decision making using GPT Vision
async function getAIDecision(page, context, step, email = '', password = '') {
  try {
    addDebugStep('AI Decision', 'info', `Getting AI decision for: ${context}`);
    
    // Take screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    const base64 = screenshot.toString('base64');
    
    // Get page content for additional context
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.textContent.substring(0, 1000),
        allButtons: Array.from(document.querySelectorAll('button, a, input[type="submit"]')).map(b => ({
          text: b.textContent?.trim() || b.value || '',
          tagName: b.tagName,
          classes: b.className,
          id: b.id
        })).filter(b => b.text.length > 0)
      };
    });
    
    // Call OpenAI API
    const { default: fetch } = await import('node-fetch');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant helping with web scraping for Kie.ai account creation. 

SCENARIO: We are creating a Kie.ai account by following these EXACT steps:
1. Go to https://kie.ai/ (DONE)
2. Look for and click the "Get Started" button (usually in top-right corner or main hero section)
3. Wait for a popup/modal to appear with sign-in options
4. Look for either "Sign in with Microsoft" or "Sign in with Google" button in the popup
5. Click the sign-in button (Microsoft preferred, Google as fallback)
6. Wait for the sign-in page to load
7. Fill in the email field with the provided email
8. Click Next/Continue button
9. Fill in the password field
10. Complete the account creation process

CURRENT STEP: ${step}
CONTEXT: ${context}

CREDENTIALS TO USE:
- Email: ${email}
- Password: ${password}

Page Information:
- Title: ${pageInfo.title}
- URL: ${pageInfo.url}
- Available buttons: ${JSON.stringify(pageInfo.allButtons, null, 2)}

IMPORTANT INSTRUCTIONS:
- Look for buttons with text like "Get Started", "Start", "Sign Up", "Create Account" (usually in top-right corner or main hero section)
- Look for sign-in buttons with "Microsoft", "Google", "Sign in with" (usually in a popup/modal)
- If you see a popup/modal, look inside it for sign-in options
- If you see email/password fields, fill them with the provided credentials
- Always provide coordinates for clicking when possible
- Be very specific about what you're looking for and why
- If you see "Get Started" button, click it immediately
- If you see sign-in options, prefer Microsoft over Google
- If you see email field, type the provided email
- If you see password field, type the provided password

Please analyze the screenshot and page information, then respond with a JSON object containing:
{
  "action": "click" | "type" | "wait" | "error" | "success",
  "target": "button text or selector",
  "coordinates": {"x": number, "y": number} (if clicking),
  "text": "text to type" (if typing),
  "reasoning": "detailed explanation of what you see and what you're clicking",
  "nextStep": "what should happen next"
}

Be very specific about what element to click and provide coordinates if possible.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this screenshot of the Kie.ai website and tell me exactly what to do next. 

Look for:
1. "Get Started" button (if we haven't clicked it yet)
2. Sign-in popup with Microsoft/Google options (if popup is visible)
3. Email/password input fields (if we're on a sign-in page)
4. Any other relevant buttons or forms

Be very specific about what you see and what you want to click. Provide exact coordinates if possible.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    addDebugStep('AI Decision', 'info', `AI Response: ${aiResponse}`);
    
    // Parse JSON response
    try {
      const decision = JSON.parse(aiResponse);
      addDebugStep('AI Decision', 'success', `AI Decision: ${decision.action} - ${decision.reasoning}`);
      
      // Take screenshot for AI decision
      const screenshotPath = await takeScreenshot('AI-Decision', page);
      
      // Emit AI decision with screenshot to UI
      if (globalIO) {
        globalIO.emit('log', {
          step: 'AI Decision',
          type: 'info',
          message: `AI wants to ${decision.action}: ${decision.reasoning}`,
          timestamp: new Date().toLocaleString(),
          screenshot: screenshotPath
        });
      }
      
      return decision;
    } catch (parseError) {
      addDebugStep('AI Decision', 'error', `Failed to parse AI response: ${parseError.message}`);
      return null;
    }
    
  } catch (error) {
    addDebugStep('AI Decision', 'error', `AI decision failed: ${error.message}`);
    return null;
  }
}

// AI-powered CAPTCHA solving using GPT Vision
async function solveCaptchaWithAI(page) {
  try {
    addDebugStep('CAPTCHA', 'info', 'Taking screenshot for AI analysis...');
    
    // Take screenshot of the CAPTCHA
    const screenshotPath = await takeScreenshot('CAPTCHA-Challenge', page);
    if (!screenshotPath) {
      throw new Error('Failed to take CAPTCHA screenshot');
    }
    
    // Read the screenshot file
    const screenshotBuffer = fs.readFileSync(path.join(__dirname, 'screenshots', screenshotPath));
    const base64Image = screenshotBuffer.toString('base64');
    
    // Call OpenAI GPT Vision API
    const { default: fetch } = await import('node-fetch');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Look at this CAPTCHA image. The instruction says "Tap on the item that you can turn on and off". Analyze the 3x3 grid of images and tell me which items can be turned on and off. Return ONLY the numbers (1-9) of the correct items, separated by commas if multiple. For example: "5,9" if items 5 and 9 can be turned on and off.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 50
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    addDebugStep('CAPTCHA', 'info', `AI Analysis: ${aiResponse}`);
    
    // Parse the AI response to get item numbers
    const itemNumbers = aiResponse.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num) && num >= 1 && num <= 9);
    
    if (itemNumbers.length === 0) {
      throw new Error('AI could not identify any clickable items');
    }
    
    addDebugStep('CAPTCHA', 'info', `Clicking on items: ${itemNumbers.join(', ')}`);
    
    // Click on the identified items
    for (const itemNumber of itemNumbers) {
      try {
        // Calculate grid position (1-based to 0-based)
        const row = Math.floor((itemNumber - 1) / 3);
        const col = (itemNumber - 1) % 3;
        
        // Find the image grid container
        const gridContainer = await page.$('[class*="grid"], [class*="captcha"], [class*="challenge"]');
        if (!gridContainer) {
          throw new Error('Could not find CAPTCHA grid container');
        }
        
        // Get grid dimensions
        const gridBox = await gridContainer.boundingBox();
        if (!gridBox) {
          throw new Error('Could not get grid dimensions');
        }
        
        // Calculate click position within the grid
        const itemWidth = gridBox.width / 3;
        const itemHeight = gridBox.height / 3;
        const clickX = gridBox.x + (col * itemWidth) + (itemWidth / 2);
        const clickY = gridBox.y + (row * itemHeight) + (itemHeight / 2);
        
        // Click on the calculated position
        await page.mouse.click(clickX, clickY);
        addDebugStep('CAPTCHA', 'info', `Clicked item ${itemNumber} at position (${Math.round(clickX)}, ${Math.round(clickY)})`);
        
        // Small delay between clicks
        await sleep(500);
        
      } catch (error) {
        addDebugStep('CAPTCHA', 'error', `Failed to click item ${itemNumber}: ${error.message}`);
      }
    }
    
    return true;
    
  } catch (error) {
    addDebugStep('CAPTCHA', 'error', `AI CAPTCHA solving failed: ${error.message}`);
    return false;
  }
}

// Main function to create Kie.ai account
// AI-powered Kie.ai account creation
async function createKieAccountAI(io, email, password) {
  let browser = null;
  let page = null;
  
  try {
    // Set global IO instance for logging
    globalIO = io;
    
    addDebugStep('AI Account Creation', 'info', 'Starting AI-powered Kie.ai account creation...');
    
    // Launch browser
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
    
    // Step 1: Navigate to Kie.ai
    addDebugStep('Navigation', 'info', 'Navigating to Kie.ai...');
    await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
    addDebugStep('Navigation', 'success', 'Successfully navigated to Kie.ai');
    
    // Human-like behavior: random delay after page load
    await randomHumanDelay(1000, 3000);
    
    const homepageScreenshot = await takeScreenshot('Kie-Homepage', page);
    addDebugStep('Navigation', 'info', `Homepage screenshot: ${homepageScreenshot || 'Failed to take screenshot'}`);
    
    // AI Decision Loop
    let step = 1;
    let maxSteps = 20; // Prevent infinite loops
    let currentContext = "We're on the Kie.ai homepage and need to start the account creation process";
    
    while (step <= maxSteps) {
      addDebugStep('AI Loop', 'info', `Step ${step}: Getting AI decision...`);
      
      // Emit AI loop step with screenshot
      const loopScreenshot = await takeScreenshot(`AI-Loop-Step-${step}`, page);
      if (globalIO) {
        globalIO.emit('log', {
          step: 'AI Loop',
          type: 'info',
          message: `Step ${step}: Getting AI decision for: ${currentContext}`,
          timestamp: new Date().toLocaleString(),
          screenshot: loopScreenshot
        });
      }
      
      const aiDecision = await getAIDecision(page, currentContext, step, email, password);
      
      if (!aiDecision) {
        addDebugStep('AI Loop', 'error', 'AI decision failed, falling back to manual process');
        
        // Emit error with screenshot
        const errorScreenshot = await takeScreenshot('AI-Decision-Failed', page);
        if (globalIO) {
          globalIO.emit('log', {
            step: 'AI Loop',
            type: 'error',
            message: 'AI decision failed, falling back to manual process',
            timestamp: new Date().toLocaleString(),
            screenshot: errorScreenshot
          });
        }
        break;
      }
      
      addDebugStep('AI Loop', 'info', `AI wants to: ${aiDecision.action} - ${aiDecision.reasoning}`);
      
      try {
        switch (aiDecision.action) {
          case 'click':
            if (aiDecision.coordinates) {
              // Human-like click at specific coordinates
              await humanLikeClick(page, aiDecision.coordinates.x, aiDecision.coordinates.y);
              addDebugStep('AI Action', 'success', `Human-like clicked at coordinates (${aiDecision.coordinates.x}, ${aiDecision.coordinates.y})`);
              
              // Take screenshot after click action
              const clickScreenshot = await takeScreenshot(`AI-Click-${step}`, page);
              addDebugStep('AI Action', 'info', `Screenshot after click: ${clickScreenshot || 'Failed'}`);
              
              if (globalIO) {
                globalIO.emit('log', {
                  step: 'AI Action',
                  type: 'success',
                  message: `Human-like clicked at coordinates (${aiDecision.coordinates.x}, ${aiDecision.coordinates.y})`,
                  timestamp: new Date().toLocaleString(),
                  screenshot: clickScreenshot
                });
              }
            } else if (aiDecision.target) {
              // Human-like click by selector
              const element = await page.$(aiDecision.target);
              if (element) {
                await humanLikeClick(page, null, null, element);
              } else {
                await page.click(aiDecision.target);
              }
              addDebugStep('AI Action', 'success', `Human-like clicked: ${aiDecision.target}`);
              
              // Take screenshot after click action
              const clickScreenshot = await takeScreenshot(`AI-Click-${step}`, page);
              addDebugStep('AI Action', 'info', `Screenshot after click: ${clickScreenshot || 'Failed'}`);
              
              if (globalIO) {
                globalIO.emit('log', {
                  step: 'AI Action',
                  type: 'success',
                  message: `Human-like clicked: ${aiDecision.target}`,
                  timestamp: new Date().toLocaleString(),
                  screenshot: clickScreenshot
                });
              }
            }
            break;
            
          case 'type':
            if (aiDecision.text && aiDecision.target) {
              await humanLikeType(page, aiDecision.target, aiDecision.text);
              addDebugStep('AI Action', 'success', `Human-like typed: ${aiDecision.text} into ${aiDecision.target}`);
              
              // Take screenshot after typing action
              const typeScreenshot = await takeScreenshot(`AI-Type-${step}`, page);
              addDebugStep('AI Action', 'info', `Screenshot after typing: ${typeScreenshot || 'Failed'}`);
              
              if (globalIO) {
                globalIO.emit('log', {
                  step: 'AI Action',
                  type: 'success',
                  message: `Typed: ${aiDecision.text} into ${aiDecision.target}`,
                  timestamp: new Date().toLocaleString(),
                  screenshot: typeScreenshot
                });
              }
            }
            break;
            
          case 'wait':
            await randomHumanDelay(1000, 3000);
            addDebugStep('AI Action', 'info', 'Human-like waited as requested by AI');
            
            // Take screenshot after wait action
            const waitScreenshot = await takeScreenshot(`AI-Wait-${step}`, page);
            addDebugStep('AI Action', 'info', `Screenshot after wait: ${waitScreenshot || 'Failed'}`);
            
            if (globalIO) {
              globalIO.emit('log', {
                step: 'AI Action',
                type: 'info',
                message: 'Waited as requested by AI',
                timestamp: new Date().toLocaleString(),
                screenshot: waitScreenshot
              });
            }
            break;
            
          case 'success':
            addDebugStep('AI Action', 'success', 'AI reports success!');
            
            // Emit success with screenshot
            const successScreenshot = await takeScreenshot('AI-Success', page);
            if (globalIO) {
              globalIO.emit('log', {
                step: 'AI Action',
                type: 'success',
                message: 'AI reports success! Account created successfully with AI assistance',
                timestamp: new Date().toLocaleString(),
                screenshot: successScreenshot
              });
            }
            
            return {
              success: true,
              email: email,
              password: password,
              message: 'Account created successfully with AI assistance'
            };
            
          case 'error':
            addDebugStep('AI Action', 'error', `AI reports error: ${aiDecision.reasoning}`);
            
            // Emit error with screenshot
            const errorScreenshot = await takeScreenshot('AI-Error', page);
            if (globalIO) {
              globalIO.emit('log', {
                step: 'AI Action',
                type: 'error',
                message: `AI reports error: ${aiDecision.reasoning}`,
                timestamp: new Date().toLocaleString(),
                screenshot: errorScreenshot
              });
            }
            
            throw new Error(`AI detected error: ${aiDecision.reasoning}`);
        }
        
        // Update context for next step
        currentContext = aiDecision.nextStep || "Continue with the next step in the account creation process";
        step++;
        
        // Small delay between steps
        await sleep(1000);
        
      } catch (actionError) {
        addDebugStep('AI Action', 'error', `Action failed: ${actionError.message}`);
        
        // Emit action error with screenshot
        const actionErrorScreenshot = await takeScreenshot(`AI-Action-Error-${step}`, page);
        if (globalIO) {
          globalIO.emit('log', {
            step: 'AI Action',
            type: 'error',
            message: `Action failed: ${actionError.message}`,
            timestamp: new Date().toLocaleString(),
            screenshot: actionErrorScreenshot
          });
        }
        
        // Try to continue with next step
        step++;
      }
    }
    
    addDebugStep('AI Loop', 'warning', 'Reached maximum steps, falling back to manual process');
    
    // Emit fallback warning with screenshot
    const fallbackScreenshot = await takeScreenshot('AI-Fallback', page);
    if (globalIO) {
      globalIO.emit('log', {
        step: 'AI Loop',
        type: 'warning',
        message: 'Reached maximum steps, falling back to manual process',
        timestamp: new Date().toLocaleString(),
        screenshot: fallbackScreenshot
      });
    }
    
    // Fallback to manual process if AI loop completes
    return await createKieAccount(io, email, password);
    
  } catch (error) {
    addDebugStep('AI Account Creation', 'error', `AI account creation failed: ${error.message}`);
    
    // Emit final error with screenshot if page is still available
    try {
      if (page) {
        const finalErrorScreenshot = await takeScreenshot('AI-Final-Error', page);
        if (globalIO) {
          globalIO.emit('log', {
            step: 'AI Account Creation',
            type: 'error',
            message: `AI account creation failed: ${error.message}`,
            timestamp: new Date().toLocaleString(),
            screenshot: finalErrorScreenshot
          });
        }
      }
    } catch (screenshotError) {
      // Screenshot failed, just emit the error without screenshot
      if (globalIO) {
        globalIO.emit('log', {
          step: 'AI Account Creation',
          type: 'error',
          message: `AI account creation failed: ${error.message}`,
          timestamp: new Date().toLocaleString()
        });
      }
    }
    
    return {
      success: false,
      error: error.message,
      message: 'AI-powered account creation failed'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function createKieAccount(io, email, password) {
  let browser = null;
  let page = null;
  
  try {
    // Set global IO instance
    globalIO = io;
    
    addDebugStep('Account Creation', 'info', '🚀 Starting Kie.ai account creation process...');
    
    // Generate password if not provided
    const generatedPassword = password || Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '123!';
    
    addDebugStep('Account Creation', 'info', `📧 Email: ${email}`);
    addDebugStep('Account Creation', 'info', `🔑 Password: ${generatedPassword}`);
    
    // Launch browser with timeout
    addDebugStep('Browser', 'info', 'Launching browser...');
    
    const browserPromise = puppeteer.launch({
      headless: true,
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
    
    // Add timeout to browser launch
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Browser launch timeout after 30 seconds')), 30000)
    );
    
    browser = await Promise.race([browserPromise, timeoutPromise]);
    
    addDebugStep('Browser', 'success', 'Browser launched successfully');
    
    // Create new page
    addDebugStep('Browser', 'info', 'Creating new page...');
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    addDebugStep('Browser', 'success', 'Page created and viewport set');
    
    // Debug: Verify page is created properly
    console.log('DEBUG: Page created successfully:', typeof page, page);
    console.log('DEBUG: Page URL after creation:', await page.url());
    
    // Verify page is created
    if (!page) {
      throw new Error('Page was not created successfully');
    }
    
    // Step 1: Navigate to Kie.ai
    addDebugStep('Navigation', 'info', 'Navigating to Kie.ai...');
    await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
    addDebugStep('Navigation', 'success', 'Successfully navigated to Kie.ai');
    
    // Human-like behavior: random delay after page load
    await randomHumanDelay(1000, 3000);
    
    // Debug: Check page variable before screenshot
    console.log('DEBUG: page variable before takeScreenshot:', typeof page, page);
    
    let homepageScreenshot = null;
    try {
      homepageScreenshot = await takeScreenshot('Kie-Homepage', page);
      console.log('DEBUG: Screenshot taken successfully:', homepageScreenshot);
    } catch (screenshotError) {
      console.log('DEBUG: Screenshot failed:', screenshotError.message);
      addDebugStep('Navigation', 'error', `Screenshot failed: ${screenshotError.message}`);
    }
    
    addDebugStep('Navigation', 'info', `Homepage screenshot: ${homepageScreenshot || 'Failed to take screenshot'}`);
    
    // Debug: Check page variable after screenshot
    console.log('DEBUG: page variable after takeScreenshot:', typeof page, page);
    
    // Step 2: Click "Get Started" button
    addDebugStep('Get Started', 'info', 'Looking for Get Started button...');
    
    // Debug: Check page variable before Get Started click
    console.log('DEBUG: page variable before Get Started click:', typeof page, page);
    
    // Verify page is still available
    if (!page) {
      console.log('ERROR: Page is undefined before Get Started click!');
      throw new Error('Page became undefined before Get Started click');
    }
    
    // Wait for the page to be fully loaded
    await sleep(3000);
    
    // Try multiple selectors for the Get Started button
    const getStartedSelectors = [
      '//button[contains(text(), "Get Started")]',
      '//a[contains(text(), "Get Started")]',
      'button[class*="Get Started"]',
      'a[class*="Get Started"]'
    ];
    
    let getStartedButton = null;
    let usedSelector = '';
    
    for (const selector of getStartedSelectors) {
      try {
        if (selector.startsWith('//')) {
          // XPath selector
          getStartedButton = await page.waitForXPath(selector, { timeout: 5000 });
        } else {
          // CSS selector
          getStartedButton = await page.waitForSelector(selector, { timeout: 5000 });
        }
        
        if (getStartedButton) {
          usedSelector = selector;
          addDebugStep('Get Started', 'info', `Found Get Started button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
        addDebugStep('Get Started', 'info', `Selector ${selector} failed: ${e.message}`);
      }
    }
    
    if (!getStartedButton) {
      // Fallback: try to find by text content using evaluate
      addDebugStep('Get Started', 'info', 'Trying fallback method to find Get Started button...');
      
      const buttonFound = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const getStartedBtn = buttons.find(btn => 
          btn.textContent && btn.textContent.trim().toLowerCase().includes('get started')
        );
        
        if (getStartedBtn) {
          getStartedBtn.click();
          return true;
        }
        return false;
      });
      
      if (buttonFound) {
        addDebugStep('Get Started', 'success', 'Clicked Get Started button using fallback method');
      } else {
        throw new Error('Could not find Get Started button with any method');
      }
    } else {
      // Click the found button
      if (usedSelector.startsWith('//')) {
        await getStartedButton.click();
      } else {
        await page.click(selector);
      }
      addDebugStep('Get Started', 'success', `Clicked Get Started button using selector: ${usedSelector}`);
    }
    
    // Take screenshot after Get Started click
    const getStartedScreenshot = await takeScreenshot('Get-Started-Clicked', page);
    addDebugStep('Get Started', 'info', `Screenshot after Get Started click: ${getStartedScreenshot || 'Failed'}`);
    
    // Step 3: Wait for popup to appear and load fully
    addDebugStep('Popup Wait', 'info', 'Waiting for popup to appear after Get Started click...');
    
    // Wait for any popup/modal to appear with multiple detection methods
    await page.waitForFunction(() => {
      // Check for common popup indicators
      const modals = document.querySelectorAll('[role="dialog"], [role="modal"], .modal, .popup, .overlay');
      const hasVisibleModal = Array.from(modals).some(modal => {
        const style = window.getComputedStyle(modal);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      
      // Check for Google sign-in specific elements
      const googleElements = document.querySelectorAll('[class*="google"], [class*="signin"], [class*="login"]');
      const hasGoogleElements = googleElements.length > 0;
      
      // Check for the specific Google span we're looking for
      const specificSpan = document.querySelector('span.nsm7Bb-HzV7m-LgbsSe-BPrWId');
      const hasSpecificSpan = specificSpan !== null;
      
      // Check for any text containing "inloggen" or "sign in"
      const signInText = document.body.textContent.toLowerCase();
      const hasSignInText = signInText.includes('inloggen') || signInText.includes('sign in') || signInText.includes('google');
      
      return hasVisibleModal || hasGoogleElements || hasSpecificSpan || hasSignInText;
    }, { timeout: 20000 });
    
    addDebugStep('Popup Wait', 'success', 'Popup detected, waiting for full load...');
    
    // Additional wait for content to fully load
    await sleep(5000);
    
    // Take screenshot of the popup
    await takeScreenshot('Popup-Appeared', page);
    
    // Debug: Check what's actually on the page
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.textContent.substring(0, 500),
        allSpans: Array.from(document.querySelectorAll('span')).map(s => s.textContent.trim()).filter(t => t.length > 0).slice(0, 10),
        allButtons: Array.from(document.querySelectorAll('button, a')).map(b => b.textContent.trim()).filter(t => t.length > 0).slice(0, 10)
      };
    });
    
    addDebugStep('Popup Wait', 'info', `Page content: ${JSON.stringify(pageContent, null, 2)}`);
    
    // Step 4: Click "Sign in with Microsoft" button (using fallback method directly)
    addDebugStep('Microsoft Sign-in', 'info', 'Looking for Sign in with Microsoft button using fallback method...');
    
    // Debug: Check what elements are available
    const debugInfo = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span')).filter(s => 
        s.textContent && s.textContent.toLowerCase().includes('microsoft')
      );
      const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]')).filter(b => 
        b.textContent && b.textContent.toLowerCase().includes('microsoft')
      );
      
      return {
        microsoftSpans: spans.map(s => ({
          text: s.textContent.trim(),
          classes: s.className,
          tagName: s.tagName
        })),
        microsoftButtons: buttons.map(b => ({
          text: b.textContent.trim(),
          tagName: b.tagName,
          classes: b.className
        }))
      };
    });
    
    addDebugStep('Microsoft Sign-in', 'info', `Debug info: ${JSON.stringify(debugInfo, null, 2)}`);
    
    try {
      // Use fallback method with human-like mouse movement
      const buttonFound = await page.evaluate(() => {
        // Try to find Microsoft sign-in button by text content
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        const microsoftBtn = buttons.find(btn => 
          btn.textContent && (
            btn.textContent.trim().toLowerCase().includes('sign in with microsoft') ||
            btn.textContent.trim().toLowerCase().includes('microsoft') ||
            btn.textContent.trim().toLowerCase().includes('sign in')
          )
        );
        
        if (microsoftBtn) {
          // Get button position for human-like movement
          const rect = microsoftBtn.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Store position for mouse movement
          window.microsoftButtonPosition = { x: centerX, y: centerY };
          return true;
        }
        
        // Fallback: try to find any element containing "microsoft" or "sign in"
        const allElements = Array.from(document.querySelectorAll('*'));
        const microsoftElement = allElements.find(el => 
          el.textContent && (
            el.textContent.trim().toLowerCase().includes('sign in with microsoft') ||
            el.textContent.trim().toLowerCase().includes('microsoft')
          )
        );
        
        if (microsoftElement) {
          const rect = microsoftElement.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Store position for mouse movement
          window.microsoftButtonPosition = { x: centerX, y: centerY };
          return true;
        }
        
        return false;
      });
      
      if (buttonFound) {
        // Human-like mouse movement to the button
        const buttonPos = await page.evaluate(() => window.microsoftButtonPosition);
        
        // Move mouse to button with human-like path
        await page.mouse.move(buttonPos.x - 50, buttonPos.y - 20, { steps: 10 });
        await sleep(200);
        await page.mouse.move(buttonPos.x - 20, buttonPos.y - 10, { steps: 5 });
        await sleep(100);
        await page.mouse.move(buttonPos.x, buttonPos.y, { steps: 3 });
        await sleep(300);
        
        // Click the button
        await page.mouse.click(buttonPos.x, buttonPos.y);
        
        addDebugStep('Microsoft Sign-in', 'success', 'Clicked Microsoft sign-in button with human-like movement');
        
        // Take screenshot immediately after clicking
        await takeScreenshot('Microsoft-Signin-Clicked', page);
        
        // Wait a bit for any redirects or new windows
        await sleep(2000);
        
        // Check if page is still accessible
        try {
          await page.evaluate(() => document.title);
          addDebugStep('Microsoft Sign-in', 'info', 'Page is still accessible after Microsoft sign-in click');
        } catch (e) {
          addDebugStep('Microsoft Sign-in', 'warning', 'Page became inaccessible after Microsoft sign-in click - this is normal for redirects');
        }
        
      } else {
        throw new Error('Could not find Sign in with Microsoft button with fallback method');
      }
      
    } catch (error) {
      addDebugStep('Microsoft Sign-in', 'error', `Microsoft sign-in failed: ${error.message}`);
      
      // Try to take screenshot even if there's an error
      try {
        await takeScreenshot('Microsoft-Signin-Error', page);
      } catch (screenshotError) {
        addDebugStep('Microsoft Sign-in', 'error', `Screenshot failed: ${screenshotError.message}`);
      }
      
      throw error;
    }
    
    // Step 5: Wait for Microsoft login popup to appear and load
    addDebugStep('Microsoft Login Popup', 'info', 'Waiting for Microsoft login popup to appear...');
    
    try {
      // Wait for Microsoft login page/popup to load
      await page.waitForFunction(() => {
        // Check for Microsoft login specific elements
        const microsoftElements = document.querySelectorAll('input[name="loginfmt"], input[id="i0116"], input[type="email"]');
        const hasMicrosoftLogin = microsoftElements.length > 0;
        
        // Also check for Microsoft login page indicators
        const microsoftPageIndicators = document.querySelectorAll('[class*="microsoft"], [class*="login"], [class*="signin"]');
        const hasMicrosoftPage = microsoftPageIndicators.length > 0;
        
        // Check for Microsoft-specific text
        const microsoftText = document.body.textContent.toLowerCase();
        const hasMicrosoftText = microsoftText.includes('microsoft') || microsoftText.includes('outlook') || microsoftText.includes('account');
        
        return hasMicrosoftLogin || hasMicrosoftPage || hasMicrosoftText;
      }, { timeout: 15000 });
      
      addDebugStep('Microsoft Login Popup', 'success', 'Microsoft login popup detected, waiting for full load...');
      
      // Additional wait for content to fully load
      await sleep(3000);
      
      // Take screenshot of the Microsoft login popup
      await takeScreenshot('Microsoft-Login-Popup', page);
      
    } catch (error) {
      addDebugStep('Microsoft Login Popup', 'error', `Microsoft login popup wait failed: ${error.message}`);
      
      // Take screenshot to see what's happening after timeout
      await takeScreenshot('Microsoft-Login-Timeout', page);
      
      // Try to continue anyway - maybe the popup is there but our detection failed
      addDebugStep('Microsoft Login Popup', 'info', 'Attempting to continue despite timeout...');
    }
    
    // Step 6: Enter email
    addDebugStep('Email Entry', 'info', 'Entering email address...');
    
    try {
      // First check if page is still accessible
      try {
        await page.evaluate(() => document.title);
        addDebugStep('Email Entry', 'info', 'Page is accessible, proceeding with email entry');
      } catch (e) {
        addDebugStep('Email Entry', 'error', 'Page is not accessible - session may have closed');
        throw new Error('Page session closed - cannot proceed with email entry');
      }
      
      // Take screenshot to see current page state
      await takeScreenshot('Before-Email-Entry', page);
      
      // Get all input fields on the page for debugging
      const allInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className,
          visible: input.offsetParent !== null,
          value: input.value
        }));
      });
      
      addDebugStep('Email Entry', 'info', `Found ${allInputs.length} input fields on page: ${JSON.stringify(allInputs)}`);
      
      // Comprehensive email field detection
      const emailSelectors = [
        // Microsoft-specific selectors
        'input[name="loginfmt"]',
        'input[id="i0116"]',
        'input[name="email"]',
        'input[id="email"]',
        
        // Generic email selectors
        'input[type="email"]',
        'input[type="text"][name*="email" i]',
        'input[type="text"][id*="email" i]',
        'input[type="text"][class*="email" i]',
        
        // Placeholder-based selectors
        'input[placeholder*="email" i]',
        'input[placeholder*="Email" i]',
        'input[placeholder*="mail" i]',
        'input[placeholder*="Mail" i]',
        'input[placeholder*="e-mail" i]',
        'input[placeholder*="E-mail" i]',
        'input[placeholder*="Enter your email" i]',
        
        // Aria-label based selectors
        'input[aria-label*="email" i]',
        'input[aria-label*="Email" i]',
        'input[aria-label*="mail" i]',
        'input[aria-label*="Mail" i]',
        'input[aria-label*="e-mail" i]',
        'input[aria-label*="E-mail" i]',
        
        // Google-specific selectors
        'input[name="identifier"]',
        'input[id="identifierId"]',
        
        // Generic text input selectors (fallback)
        'input[type="text"]',
        'input:not([type])'
      ];
      
      let emailField = null;
      let usedEmailSelector = '';
      
      // Try each selector with shorter timeout
      for (const selector of emailSelectors) {
        try {
          addDebugStep('Email Entry', 'info', `Trying email selector: ${selector}`);
          
          // Wait for selector with shorter timeout
          emailField = await page.waitForSelector(selector, { timeout: 2000 });
          
          if (emailField) {
            // Check if element is visible and interactable
            const isVisible = await emailField.isIntersectingViewport();
            const isEnabled = await emailField.isEnabled();
            
            if (isVisible && isEnabled) {
              usedEmailSelector = selector;
              addDebugStep('Email Entry', 'success', `Found visible and enabled email field with selector: ${selector}`);
              break;
            } else {
              addDebugStep('Email Entry', 'info', `Email field found but not visible/enabled: ${selector}`);
              emailField = null;
            }
          }
        } catch (e) {
          addDebugStep('Email Entry', 'info', `Email selector ${selector} failed: ${e.message}`);
        }
      }
      
      // If no specific email field found, try to find any text input
      if (!emailField) {
        addDebugStep('Email Entry', 'info', 'No specific email field found, looking for any text input...');
        
        const textInputs = await page.$$('input[type="text"], input:not([type])');
        for (let i = 0; i < textInputs.length; i++) {
          const input = textInputs[i];
          const isVisible = await input.isIntersectingViewport();
          const isEnabled = await input.isEnabled();
          
          if (isVisible && isEnabled) {
            emailField = input;
            usedEmailSelector = `text-input-${i}`;
            addDebugStep('Email Entry', 'info', `Using text input ${i} as email field`);
            break;
          }
        }
      }
      
      if (!emailField) {
        // Fallback: try to find by attributes using evaluate
        addDebugStep('Email Entry', 'info', 'Trying fallback method to find email field...');
        
        try {
          const emailFieldFound = await page.evaluate((email) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const emailInput = inputs.find(input => 
              input.type === 'email' || 
              input.name === 'loginfmt' || 
              input.id === 'i0116' ||
              input.placeholder && input.placeholder.toLowerCase().includes('email')
            );
            
            if (emailInput) {
              emailInput.focus();
              emailInput.value = email;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              emailInput.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          }, email);
          
          if (emailFieldFound) {
            addDebugStep('Email Entry', 'success', 'Email entered using fallback method');
          } else {
            // Try XPath fallback
            addDebugStep('Email Entry', 'info', 'Trying XPath fallback for email field...');
            const xpathResult = await page.$x('//input[@type="text" or @type="email" or not(@type)]');
            if (xpathResult.length > 0) {
              const xpathField = xpathResult[0];
              const isVisible = await xpathField.isIntersectingViewport();
              const isEnabled = await xpathField.isEnabled();
              
              if (isVisible && isEnabled) {
                emailField = xpathField;
                usedEmailSelector = 'xpath-fallback';
                addDebugStep('Email Entry', 'info', 'Found email field using XPath fallback');
              }
            }
            
            if (!emailField) {
              throw new Error('Could not find email field with any method');
            }
          }
        } catch (e) {
          addDebugStep('Email Entry', 'error', `Fallback method failed: ${e.message}`);
          throw e;
        }
      } else {
        // Human-like email entry
        try {
          // Get element position for human-like interaction
          const box = await emailField.boundingBox();
          if (box) {
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            
            // Human-like mouse movement to field
            await humanLikeMouseMove(page, 0, 0, centerX, centerY);
            await randomHumanDelay(200, 500);
          }
          
          // Click to focus the field
          await emailField.click();
          await randomHumanDelay(100, 300);
          
          // Clear any existing text
          await emailField.click({ clickCount: 3 });
          await randomHumanDelay(50, 150);
          
          // Use human-like typing
          await humanLikeType(page, usedEmailSelector, email);
          addDebugStep('Email Entry', 'success', `Human-like entered email using selector: ${usedEmailSelector}`);
          
          // Take screenshot after email entry
          const emailScreenshot = await takeScreenshot('Email-Entered', page);
          addDebugStep('Email Entry', 'info', `Screenshot after email entry: ${emailScreenshot || 'Failed'}`);
          
          // Trigger events to ensure validation
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              el.dispatchEvent(new Event('keyup', { bubbles: true }));
              el.dispatchEvent(new Event('keydown', { bubbles: true }));
            }
          }, usedEmailSelector);
          
          // Wait a bit for validation
          await randomHumanDelay(500, 1000);
          
        } catch (e) {
          addDebugStep('Email Entry', 'error', `Human-like email entry failed: ${e.message}`);
          throw e;
        }
      }
      
      // Take screenshot after successful email entry
      try {
        await takeScreenshot('Email-Entered', page);
      } catch (screenshotError) {
        addDebugStep('Email Entry', 'warning', `Screenshot failed: ${screenshotError.message}`);
      }
      
    } catch (error) {
      addDebugStep('Email Entry', 'error', `Email entry failed: ${error.message}`);
      
      // Try to take screenshot even if there's an error
      try {
        await takeScreenshot('Email-Entry-Failed', page);
      } catch (screenshotError) {
        addDebugStep('Email Entry', 'error', `Screenshot failed: ${screenshotError.message}`);
      }
      
      throw error;
    }
    
    // Click Next button
    addDebugStep('Email Entry', 'info', 'Clicking Next button...');
    await page.click('input[type="submit"], //button[contains(text(), "Next")]');
    addDebugStep('Email Entry', 'success', 'Clicked Next button');
    await takeScreenshot('Email-Next-Clicked', page);
    
    // Step 5: Enter password
    addDebugStep('Password Entry', 'info', 'Entering password...');
    await page.waitForSelector('input[name="passwd"], input[id="passwordEntry"]', { timeout: 10000 });
    await page.type('input[name="passwd"], input[id="passwordEntry"]', generatedPassword, { delay: 100 });
    addDebugStep('Password Entry', 'success', 'Password entered successfully');
    await takeScreenshot('Password-Entered', page);
    
    // Click Next button
    addDebugStep('Password Entry', 'info', 'Clicking Next button...');
    await page.click('input[type="submit"], //button[contains(text(), "Next")]');
    addDebugStep('Password Entry', 'success', 'Clicked Next button');
    await takeScreenshot('Password-Next-Clicked', page);
    
    // Step 6: Handle "Save password?" popup - click "Never"
    try {
      addDebugStep('Password Save', 'info', 'Checking for password save popup...');
      await page.waitForSelector('//button[contains(text(), "Never")] | //button[contains(text(), "Don\'t save")]', { timeout: 5000 });
      await page.click('//button[contains(text(), "Never")] | //button[contains(text(), "Don\'t save")]');
      addDebugStep('Password Save', 'success', 'Clicked Never on password save popup');
      await takeScreenshot('Password-Save-Never', page);
    } catch (error) {
      addDebugStep('Password Save', 'info', 'No password save popup appeared');
    }
    
    // Step 7: Handle "Let's protect your account" - click "Skip for now"
    addDebugStep('Account Protection', 'info', 'Looking for account protection popup...');
    await page.waitForSelector('//a[contains(text(), "Skip for now")] | //button[contains(text(), "Skip for now")]', { timeout: 10000 });
    await page.click('//a[contains(text(), "Skip for now")] | //button[contains(text(), "Skip for now")]');
    addDebugStep('Account Protection', 'success', 'Clicked Skip for now on account protection');
    await takeScreenshot('Account-Protection-Skipped', page);
    
    // Step 8: Handle "Sign in faster" popup - click "Skip for now"
    addDebugStep('Sign-in Faster', 'info', 'Looking for sign-in faster popup...');
    await page.waitForSelector('//button[contains(text(), "Skip for now")]', { timeout: 10000 });
    await page.click('//button[contains(text(), "Skip for now")]');
    addDebugStep('Sign-in Faster', 'success', 'Clicked Skip for now on sign-in faster');
    await takeScreenshot('Signin-Faster-Skipped', page);
    
    // Step 9: Handle "Stay signed in?" - click "Yes"
    addDebugStep('Stay Signed In', 'info', 'Looking for stay signed in popup...');
    await page.waitForSelector('//button[contains(text(), "Yes")]', { timeout: 10000 });
    await page.click('//button[contains(text(), "Yes")]');
    addDebugStep('Stay Signed In', 'success', 'Clicked Yes on stay signed in');
    await takeScreenshot('Stay-Signed-In-Yes', page);
    
    // Step 10: Handle "Let this app access your info?" - scroll and click "Accept"
    addDebugStep('App Access', 'info', 'Looking for app access consent popup...');
    await page.waitForSelector('//button[contains(text(), "Accept")]', { timeout: 10000 });
    
    // Scroll down to make sure Accept button is visible
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(1000);
    
    await page.click('//button[contains(text(), "Accept")]');
    addDebugStep('App Access', 'success', 'Clicked Accept on app access consent');
    await takeScreenshot('App-Access-Accepted', page);
    
    // Step 11: Handle "I am human" checkbox
    addDebugStep('Human Verification', 'info', 'Looking for I am human checkbox...');
    await page.waitForSelector('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]', { timeout: 10000 });
    await page.click('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]');
    addDebugStep('Human Verification', 'success', 'Clicked I am human checkbox');
    await takeScreenshot('Human-Verification-Checked', page);
    
    // Step 12: Handle CAPTCHA challenges
    let captchaAttempts = 0;
    const maxCaptchaAttempts = 3;
    
    while (captchaAttempts < maxCaptchaAttempts) {
      try {
        addDebugStep('CAPTCHA', 'info', `CAPTCHA attempt ${captchaAttempts + 1}/${maxCaptchaAttempts}`);
        
        // Check if CAPTCHA challenge is present
        const captchaPresent = await page.$('text="Tap on the item that you can turn on and off"') !== null;
        
        if (captchaPresent) {
          addDebugStep('CAPTCHA', 'info', 'CAPTCHA challenge detected, solving with AI...');
          
          const solved = await solveCaptchaWithAI(page);
          if (solved) {
            // Click Next button after solving CAPTCHA
            await page.click('//button[contains(text(), "Next")] | //button[contains(text(), "Continue")]');
            addDebugStep('CAPTCHA', 'success', 'CAPTCHA solved and Next clicked');
            await takeScreenshot('CAPTCHA-Solved', page);
            break;
          } else {
            captchaAttempts++;
            if (captchaAttempts < maxCaptchaAttempts) {
              addDebugStep('CAPTCHA', 'warning', 'CAPTCHA solving failed, retrying...');
              await sleep(2000);
            }
          }
        } else {
          addDebugStep('CAPTCHA', 'info', 'No CAPTCHA challenge detected');
          break;
        }
      } catch (error) {
        addDebugStep('CAPTCHA', 'error', `CAPTCHA handling error: ${error.message}`);
        captchaAttempts++;
        if (captchaAttempts < maxCaptchaAttempts) {
          await sleep(2000);
        }
      }
    }
    
    if (captchaAttempts >= maxCaptchaAttempts) {
      throw new Error('Failed to solve CAPTCHA after maximum attempts');
    }
    
    // Step 13: Final "I am human" checkbox
    try {
      addDebugStep('Final Verification', 'info', 'Looking for final I am human checkbox...');
      await page.waitForSelector('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]', { timeout: 5000 });
      await page.click('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]');
      addDebugStep('Final Verification', 'success', 'Clicked final I am human checkbox');
      await takeScreenshot('Final-Human-Verification', page);
    } catch (error) {
      addDebugStep('Final Verification', 'info', 'No final human verification needed');
    }
    
    // Step 14: Wait for dashboard
    addDebugStep('Dashboard', 'info', 'Waiting for dashboard...');
    
    await page.waitForFunction(() => {
      const url = window.location.href;
      return url.includes('kie.ai') && (url.includes('dashboard') || url.includes('home') || url.includes('console') || 
             document.querySelector('[class*="dashboard"], [class*="welcome"], [class*="console"]') !== null);
    }, { timeout: 30000 });
    
    addDebugStep('Dashboard', 'success', 'Successfully reached Kie.ai dashboard');
    await takeScreenshot('Dashboard-Reached', page);
    
    addDebugStep('Account Creation', 'success', '✅ Kie.ai account creation process completed successfully!');
    addDebugStep('Account Creation', 'info', `📧 Email: ${email}`);
    addDebugStep('Account Creation', 'info', `🔑 Password: ${generatedPassword}`);
    
    return {
      success: true,
      email: email,
      password: generatedPassword,
      message: 'Kie.ai account creation process completed successfully!'
    };
    
  } catch (error) {
    addDebugStep('Account Creation', 'error', '❌ Kie.ai account creation failed', null, error.message);
    
    // Add more detailed error logging
    console.error('Detailed error:', error);
    console.error('Error stack:', error.stack);
    
    // Check if page was created
    if (!page) {
      addDebugStep('Account Creation', 'error', 'Page was never created - browser launch or page creation failed');
    }
    
    // Check if browser was created
    if (!browser) {
      addDebugStep('Account Creation', 'error', 'Browser was never created - puppeteer launch failed');
    }
    
    // Return a more user-friendly error message for Railway
    if (error.message.includes('Failed to launch the browser process')) {
      throw new Error('Browser launch failed. This may be due to server environment limitations. Please try again or contact support.');
    } else if (error.message.includes('Missing X server')) {
      throw new Error('Display server not available. This is a server environment limitation.');
    } else if (error.message.includes('page is not defined')) {
      throw new Error('Page creation failed. Browser may not have launched properly. Please try again.');
    } else {
      throw new Error(`Kie.ai account creation failed: ${error.message}`);
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}

module.exports = { createKieAccount, createKieAccountAI };
