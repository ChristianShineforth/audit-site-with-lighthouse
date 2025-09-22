import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { filename } = req.query;
    
    if (!filename || !filename.endsWith('.json')) {
      return res.status(400).json({ message: 'Valid filename required' });
    }
    
    // Security check to prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'audit-sites', safeFilename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    return res.status(200).json(content);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to read audit site config', error: error.message });
  }
}