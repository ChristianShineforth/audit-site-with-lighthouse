import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import formidable from 'formidable';
import { storage } from '../../lib/storage.js';
import { useBlob } from '../../lib/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Device configurations
const configs = [
  { name: 'mobile', formFactor: 'mobile', screenEmulation: { disabled: false }, emulatedUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X)' },
  { name: 'desktop', formFactor: 'desktop', screenEmulation: { disabled: true }, emulatedUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
];

// Store running tasks - using a simple object instead of Map for better serialization
const tasks = {};

async function runLighthouse(url, configName, configOverrides, outputDir) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless',
      '--incognito',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });
  
  const options = {
    logLevel: 'info',
    output: ['html', 'json'],
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
    emulatedFormFactor: configOverrides.formFactor,
    screenEmulation: configOverrides.screenEmulation,
    throttlingMethod: 'provided',
    throttling: {
      rttMs: 0, throughputKbps: 0, cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0
    },
    disableStorageReset: true,
  };

  const result = await lighthouse(url, options);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const urlPath = new URL(url).pathname;
  const pathnameSlug = urlPath === '/' ? 'home' : urlPath.replace(/\W+/g, '-').replace(/^-|-$/g, '');
  const filename = `${pathnameSlug}-${configName}-${timestamp}`;
  const basePath = path.resolve(outputDir, filename);

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, {recursive: true});
  
  fs.writeFileSync(`${basePath}.html`, result.report[0]);
  
  await chrome.kill();
  return basePath;
}

async function runBatch(config, taskId, configName = 'audit') {
  try {
    tasks[taskId] = { status: 'running', message: 'Starting audit...', progress: 0 };
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const dateFolder = `${configName}-${dateStr}`;
    const outputDir = path.join(process.cwd(), 'reports', dateFolder);
    
    const totalPages = config.paths.length * configs.length;
    let completed = 0;
    
    for (const pathname of config.paths) {
      const fullURL = `${config.base}${pathname}`;
      for (const deviceConfig of configs) {
        await runLighthouse(fullURL, deviceConfig.name, deviceConfig, outputDir);
        completed++;
        tasks[taskId] = {
          status: 'running',
          message: `Processing ${completed}/${totalPages} pages...`,
          progress: (completed / totalPages) * 100
        };
      }
    }
    
    tasks[taskId] = {
      status: 'completed',
      message: 'Audit completed successfully!',
      progress: 100,
      reportPath: outputDir,
      folderName: dateFolder
    };
  } catch (error) {
    tasks[taskId] = {
      status: 'error',
      message: error.message
    };
  }
}

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle status check
  if (req.method === 'GET') {
    const { taskId } = req.query;
    
    if (!taskId) {
      return res.status(400).json({ message: 'Task ID required' });
    }
    
    const task = tasks[taskId];
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    return res.status(200).json(task);
  }

  // Handle file upload and start audit
  if (req.method === 'POST') {
    try {
      let configData;
      let configName = 'audit'; // Default name

      // Check if request has JSON content type (from pre-configured sites)
      if (req.headers['content-type']?.includes('application/json')) {
        configData = req.body;
        // Extract config name from the request body if available
        configName = req.body.configName || 'audit';
      } else {
        // Handle file upload (form data)
        const form = formidable({});
        const [fields, files] = await form.parse(req);
        
        const configFile = files.config[0];
        configData = JSON.parse(fs.readFileSync(configFile.filepath, 'utf8'));
        
        // Extract filename without extension for folder naming
        const originalFilename = configFile.originalFilename || configFile.newFilename;
        if (originalFilename) {
          configName = originalFilename.replace('.json', '');
        }
      }
      
      // Validate config
      if (!configData.base || !configData.paths || !Array.isArray(configData.paths)) {
        return res.status(400).json({ message: 'Invalid configuration format' });
      }
      
      const taskId = Date.now().toString();
      
      // Start the audit in the background
      runBatch(configData, taskId, configName);
      
      return res.status(200).json({ taskId, message: 'Audit started' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to start audit', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};