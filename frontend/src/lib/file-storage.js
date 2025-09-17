import { openDB } from 'idb';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const DB_NAME = 'TexCompilerDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

// Initialize IndexedDB
async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('path', 'path', { unique: true });
      }
    },
  });
}

// File structure helpers
export const createFileId = (path) => path.replace(/[^a-zA-Z0-9]/g, '_');

export const getFileExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
};

export const getLanguageFromExtension = (extension) => {
  switch (extension) {
    case 'tex':
      return 'latex';
    case 'bib':
      return 'bibtex';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'txt':
      return 'plaintext';
    default:
      return 'plaintext';
  }
};

// File operations
export class FileStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await initDB();
    
    // Check if main.tex exists, if not create it
    const files = await this.getAllFiles();
    if (!files.find(f => f.name === 'main.tex')) {
      await this.createFile('main.tex', `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}

\\title{My Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Write your content here.

\\end{document}`, '/')
    }
  }

  async createFile(name, content = '', path = '/') {
    const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
    const file = {
      id: createFileId(fullPath),
      name,
      content,
      path: fullPath,
      type: 'file',
      size: new Blob([content]).size,
      created: new Date(),
      modified: new Date()
    };
    
    await this.db.put(STORE_NAME, file);
    return file;
  }

  async createFolder(name, path = '/') {
    const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
    const folder = {
      id: createFileId(fullPath),
      name,
      path: fullPath,
      type: 'folder',
      created: new Date(),
      modified: new Date()
    };
    
    await this.db.put(STORE_NAME, folder);
    return folder;
  }

  async getFile(path) {
    return await this.db.get(STORE_NAME, createFileId(path));
  }

  async getAllFiles() {
    return await this.db.getAll(STORE_NAME);
  }

  async updateFile(path, content) {
    const file = await this.getFile(path);
    if (file) {
      file.content = content;
      file.size = new Blob([content]).size;
      file.modified = new Date();
      await this.db.put(STORE_NAME, file);
      return file;
    }
    throw new Error('File not found');
  }

  async renameFile(oldPath, newName) {
    const file = await this.getFile(oldPath);
    if (file) {
      // Delete old file
      await this.deleteFile(oldPath);
      
      // Create new file with updated path
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');
      
      file.id = createFileId(newPath);
      file.name = newName;
      file.path = newPath;
      file.modified = new Date();
      
      await this.db.put(STORE_NAME, file);
      return file;
    }
    throw new Error('File not found');
  }

  async copyFile(path, newName) {
    const file = await this.getFile(path);
    if (file) {
      const pathParts = path.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');
      
      const newFile = {
        ...file,
        id: createFileId(newPath),
        name: newName,
        path: newPath,
        created: new Date(),
        modified: new Date()
      };
      
      await this.db.put(STORE_NAME, newFile);
      return newFile;
    }
    throw new Error('File not found');
  }

  async moveFile(oldPath, newPath) {
    const file = await this.getFile(oldPath);
    if (file) {
      await this.deleteFile(oldPath);
      
      file.id = createFileId(newPath);
      file.path = newPath;
      file.name = newPath.split('/').pop();
      file.modified = new Date();
      
      await this.db.put(STORE_NAME, file);
      return file;
    }
    throw new Error('File not found');
  }

  async deleteFile(path) {
    await this.db.delete(STORE_NAME, createFileId(path));
  }

  async uploadFiles(files) {
    const uploadedFiles = [];
    
    for (const file of files) {
      const extension = getFileExtension(file.name);
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp'].includes(extension);
      const maxSize = isImage ? 5 * 1024 * 1024 : 1024 * 1024; // 5MB for images, 1MB for others
      
      if (file.size > maxSize) {
        throw new Error(`File ${file.name} is too large. Max size: ${isImage ? '5MB' : '1MB'}`);
      }
      
      const content = await file.text();
      const uploadedFile = await this.createFile(file.name, content);
      uploadedFiles.push(uploadedFile);
    }
    
    return uploadedFiles;
  }

  async downloadFile(path) {
    const file = await this.getFile(path);
    if (file) {
      const blob = new Blob([file.content], { type: 'text/plain' });
      saveAs(blob, file.name);
    } else {
      throw new Error('File not found');
    }
  }

  async downloadAllFiles() {
    const files = await this.getAllFiles();
    const zip = new JSZip();
    
    files.forEach(file => {
      if (file.type === 'file') {
        // Remove leading slash and create folder structure
        const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        zip.file(path, file.content);
      }
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'tex-project.zip');
  }

  // Build tree structure for navigation
  buildFileTree() {
    return this.getAllFiles().then(files => {
      const tree = { name: 'root', type: 'folder', children: [], path: '/' };
      
      files.forEach(file => {
        const pathParts = file.path.split('/').filter(Boolean);
        let current = tree;
        
        // Navigate/create folder structure
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderName = pathParts[i];
          let folder = current.children.find(child => 
            child.name === folderName && child.type === 'folder'
          );
          
          if (!folder) {
            folder = {
              name: folderName,
              type: 'folder',
              children: [],
              path: '/' + pathParts.slice(0, i + 1).join('/')
            };
            current.children.push(folder);
          }
          current = folder;
        }
        
        // Add file to current folder
        current.children.push({
          ...file,
          children: file.type === 'folder' ? [] : undefined
        });
      });
      
      return tree;
    });
  }
}

// Export singleton instance
export const fileStorage = new FileStorage();