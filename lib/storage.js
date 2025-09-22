import fs from 'fs';
import path from 'path';
import { put, list, del } from '@vercel/blob';
import { useBlob } from './env.js';

// Local file system operations
const localStorage = {
  async writeFile(filePath, content) {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content);
    return { url: `/api/files?file=${filePath}` };
  },

  async readFile(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    return fs.readFileSync(fullPath);
  },

  async listFolders(prefix = 'reports/') {
    const reportsDir = path.join(process.cwd(), prefix);
    if (!fs.existsSync(reportsDir)) return { folders: [] };
    
    const folders = fs.readdirSync(reportsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const folderPath = path.join(reportsDir, dirent.name);
        const files = fs.readdirSync(folderPath);
        const stats = fs.statSync(folderPath);
        
        return {
          name: dirent.name,
          created: stats.birthtime,
          fileCount: files.length,
          size: files.reduce((total, file) => {
            const fileStats = fs.statSync(path.join(folderPath, file));
            return total + fileStats.size;
          }, 0)
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return { folders };
  },

  async listFiles(folder) {
    const folderPath = path.join(process.cwd(), 'reports', folder);
    if (!fs.existsSync(folderPath)) return { files: [] };
    
    const files = fs.readdirSync(folderPath).map(file => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime,
        url: `/api/files?file=reports/${folder}/${file}`,
        downloadUrl: `/api/files?file=reports/${folder}/${file}&download=true`
      };
    });
    
    return { files };
  },

  async deleteFolder(folder) {
    const folderPath = path.join(process.cwd(), 'reports', folder);
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
    return { success: true };
  }
};

// Vercel Blob operations
const blobStorage = {
  async writeFile(filePath, content) {
    const blob = await put(filePath, content, {
      access: 'public',
    });
    return { url: blob.url };
  },

  async readFile(filePath) {
    // For blob, we return the URL instead of content
    return filePath;
  },

  async listFolders(prefix = 'reports/') {
    const { blobs } = await list({ prefix });
    const folders = new Map();
    
    blobs.forEach(blob => {
      const pathParts = blob.pathname.split('/');
      if (pathParts.length >= 3) {
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
    
    return { folders: folderList };
  },

  async listFiles(folder) {
    const { blobs } = await list({ prefix: `reports/${folder}/` });
    
    const files = blobs.map(blob => ({
      name: blob.pathname.split('/').pop(),
      size: blob.size,
      created: blob.uploadedAt,
      url: blob.url,
      downloadUrl: blob.downloadUrl
    }));
    
    return { files };
  },

  async deleteFolder(folder) {
    const { blobs } = await list({ prefix: `reports/${folder}/` });
    
    for (const blob of blobs) {
      await del(blob.url);
    }
    
    return { success: true };
  }
};

// Export the appropriate storage based on environment
export const storage = useBlob ? blobStorage : localStorage;