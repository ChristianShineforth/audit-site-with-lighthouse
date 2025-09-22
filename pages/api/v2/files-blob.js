import { list } from '@vercel/blob';

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
      // List all report folders
      const { blobs } = await list({ prefix: 'reports/' });
      const folders = new Map();
      
      blobs.forEach(blob => {
        const pathParts = blob.pathname.split('/');
        if (pathParts.length >= 3) { // reports/folder-name/file.html
          const folderName = pathParts[1];
          if (!folders.has(folderName)) {
            folders.set(folderName, {
              name: folderName,
              created: blob.uploadedAt,
              fileCount: 0,
              size: 0
            });
          }
          const folder = folders.get(folderName);
          folder.fileCount++;
          folder.size += blob.size;
        }
      });
      
      const folderList = Array.from(folders.values())
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      return res.status(200).json({ folders: folderList });
    } else {
      // List files in specific folder
      const { blobs } = await list({ prefix: `reports/${folder}/` });
      
      const files = blobs.map(blob => ({
        name: blob.pathname.split('/').pop(),
        size: blob.size,
        created: blob.uploadedAt,
        url: blob.url,
        downloadUrl: blob.downloadUrl
      }));
      
      return res.status(200).json({ files });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to read files', error: error.message });
  }
}