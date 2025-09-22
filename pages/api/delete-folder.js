import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { folder } = req.query;
    
    if (!folder) {
      return res.status(400).json({ message: 'Folder parameter required' });
    }
    
    const folderPath = path.join(process.cwd(), 'reports', folder);
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Validate folder name to prevent directory traversal attacks
    const normalizedFolder = path.normalize(folder);
    if (normalizedFolder.includes('..') || normalizedFolder.includes('/') || normalizedFolder.includes('\\')) {
      return res.status(400).json({ message: 'Invalid folder name' });
    }
    
    // Remove the folder and all its contents
    await execAsync(`rm -rf "${folderPath}"`);
    
    return res.status(200).json({ message: 'Folder deleted successfully' });
    
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ message: 'Failed to delete folder', error: error.message });
  }
}