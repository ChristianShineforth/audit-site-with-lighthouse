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
    const { folder } = req.query;
    
    if (!folder) {
      // List all report folders
      const reportsDir = path.join(process.cwd(), 'reports');
      
      if (!fs.existsSync(reportsDir)) {
        return res.status(200).json({ folders: [] });
      }
      
      const folders = fs.readdirSync(reportsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => ({
          name: dirent.name,
          path: dirent.name,
          created: fs.statSync(path.join(reportsDir, dirent.name)).mtime
        }))
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      return res.status(200).json({ folders });
    } else {
      // List files in specific folder
      const folderPath = path.join(process.cwd(), 'reports', folder);
      
      if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      
      const files = fs.readdirSync(folderPath)
        .map(file => {
          const filePath = path.join(folderPath, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            created: stats.mtime,
            isDirectory: stats.isDirectory()
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      return res.status(200).json({ files });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to read files', error: error.message });
  }
}