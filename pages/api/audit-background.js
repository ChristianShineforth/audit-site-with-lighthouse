import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import formidable from 'formidable';
import { storage } from '../../lib/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vercel-optimized configurations
const configs = [
  { 
    name: 'mobile', 
    formFactor: 'mobile', 
    screenEmulation: { disabled: false },
    emulatedUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X)',
    // Reduced categories for faster execution
    categories: {
      performance: { weight: 1 },
      accessibility: { weight: 1 },
      'best-practices': { weight: 1 },
      seo: { weight: 1 }
    }
  },
  { 
    name: 'desktop', 
    formFactor: 'desktop', 
    screenEmulation: { disabled: true },
    emulatedUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    categories: {
      performance: { weight: 1 },
      accessibility: { weight: 1 },
      'best-practices': { weight: 1 },
      seo: { weight: 1 }
    }
  }
];

// Chrome launcher options optimized for Vercel
const chromeOptions = {
  chromeFlags: [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--memory-pressure-off',
    '--max_old_space_size=4096'
  ]
};

export default async function handler(req, res) {
  // Set longer timeout for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  let chrome = null;
  
  try {
    // Parse form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);
    const configFile = files.config?.[0];
    
    if (!configFile) {
      return res.status(400).json({ message: 'No configuration file provided' });
    }

    // Read and parse config
    const configContent = fs.readFileSync(configFile.filepath, 'utf8');
    const config = JSON.parse(configContent);
    
    if (!config.urls || !Array.isArray(config.urls)) {
      return res.status(400).json({ message: 'Invalid configuration: urls array is required' });
    }

    // Limit URLs for Vercel (to prevent timeout)
    const urls = config.urls.slice(0, 3); // Limit to 3 URLs max
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `${config.name || 'audit'}-${timestamp}`;

    // Launch Chrome
    chrome = await chromeLauncher.launch(chromeOptions);
    const port = chrome.port;

    const results = [];

    // Process each URL with each configuration
    for (const config of configs) {
      for (const url of urls) {
        try {
          console.log(`Running ${config.name} audit for ${url}...`);
          
          const options = {
            logLevel: 'error', // Reduce logging
            output: 'html',
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            port: port,
            ...config
          };

          const report = await lighthouse(url, options);
          
          if (report) {
            const html = report.report;
            const filename = `${url.replace(/[^a-zA-Z0-9]/g, '-')}-${config.name}-${timestamp}.html`;
            const filePath = `reports/${folderName}/${filename}`;
            
            // Use storage abstraction
            await storage.writeFile(filePath, html);
            
            results.push({
              url,
              config: config.name,
              filename,
              success: true
            });
          }
        } catch (error) {
          console.error(`Error auditing ${url} with ${config.name}:`, error);
          results.push({
            url,
            config: config.name,
            success: false,
            error: error.message
          });
        }
      }
    }

    // Clean up Chrome
    if (chrome) {
      await chrome.kill();
    }

    return res.status(200).json({
      success: true,
      folderName,
      results,
      message: `Audit completed. Generated ${results.filter(r => r.success).length} reports.`
    });

  } catch (error) {
    console.error('Audit error:', error);
    
    // Clean up Chrome if it's running
    if (chrome) {
      try {
        await chrome.kill();
      } catch (killError) {
        console.error('Error killing Chrome:', killError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Audit failed',
      error: error.message
    });
  }
}

// Configure API route for Vercel
export const config = {
  api: {
    bodyParser: false, // Disable body parsing for formidable
    responseLimit: false,
  },
  maxDuration: 60, // 60 seconds max duration
};
