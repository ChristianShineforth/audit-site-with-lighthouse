import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configFile = process.argv[2] || './condo-world.json';
const configPath = path.resolve(__dirname, configFile);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Device configurations
const configs = [
    { name: 'mobile', formFactor: 'mobile', screenEmulation: { disabled: false }, emulatedUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X)' },
    { name: 'desktop', formFactor: 'desktop', screenEmulation: { disabled: true }, emulatedUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  ];

const baseURL = config.base;
const pathnames = config.paths

const outputDir = path.join(__dirname, 'reports');


async function runLighthouse(url, configName, configOverrides) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: ['html', 'json'],
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
    emulatedFormFactor: configOverrides.formFactor,
    screenEmulation: configOverrides.screenEmulation,
    userAgent: configOverrides.emulatedUserAgent
  };

  const result = await lighthouse(url, options);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const urlPath = new URL(url).pathname;
  const pathnameSlug = urlPath === '/' ? 'home' : urlPath.replace(/\W+/g, '-').replace(/^-|-$/g, '');
  const filename = `${pathnameSlug}-${configName}-${timestamp}`;
  const basePath = path.resolve(outputDir, filename);

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  fs.writeFileSync(`${basePath}.html`, result.report[0]);

  console.log(`✅ Saved: ${basePath}`);
  await chrome.kill();
}

async function runBatch() {
  for (const pathname of pathnames) {
    const fullURL = `${baseURL}${pathname}`;
    for (const config of configs) {
      await runLighthouse(fullURL, config.name, config);
    }
  }
}

runBatch().catch(console.error);
