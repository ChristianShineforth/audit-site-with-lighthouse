import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
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
    const { folder } = req.query;
    
    if (!folder) {
      return res.status(400).json({ message: 'Folder parameter required' });
    }
    
    const folderPath = path.join(process.cwd(), 'reports', folder);
    const zipPath = path.join(process.cwd(), 'reports', `${folder}.zip`);
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Create zip file
    await execAsync(`cd "${process.cwd()}/reports" && zip -r "${folder}.zip" "${folder}"`);
    
    if (!fs.existsSync(zipPath)) {
      return res.status(500).json({ message: 'Failed to create zip file' });
    }
    
    const stats = fs.statSync(zipPath);
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${folder}.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stats.size);
    
    // Stream the zip file
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);
    
    // Clean up zip file after streaming
    fileStream.on('end', () => {
      fs.unlinkSync(zipPath);
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create zip file', error: error.message });
  }
}