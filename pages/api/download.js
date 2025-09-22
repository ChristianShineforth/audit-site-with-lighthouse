import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';

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
    const { file, folder } = req.query;
    
    if (!file || !folder) {
      return res.status(400).json({ message: 'File and folder parameters required' });
    }
    
    const filePath = path.join(process.cwd(), 'reports', folder, file);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      return res.status(400).json({ message: 'Cannot download directory' });
    }
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file
    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    return res.status(500).json({ message: 'Failed to download file', error: error.message });
  }
}