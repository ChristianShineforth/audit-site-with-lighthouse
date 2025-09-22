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
    const auditSitesDir = path.join(process.cwd(), 'audit-sites');
    
    if (!fs.existsSync(auditSitesDir)) {
      return res.status(200).json({ sites: [] });
    }
    
    const files = fs.readdirSync(auditSitesDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(auditSitesDir, file);
        const stats = fs.statSync(filePath);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        return {
          name: file.replace('.json', ''),
          filename: file,
          displayName: content.base ? new URL(content.base).hostname : file.replace('.json', ''),
          base: content.base,
          pathCount: content.paths ? content.paths.length : 0,
          created: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return res.status(200).json({ sites: files });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to read audit sites', error: error.message });
  }
}