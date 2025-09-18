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
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
};

export const EDITABLE_EXTENSIONS = [
  'tex', 'bib', 'txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'xml', 'yaml', 'yml',
  'py', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'java', 'kt', 'swift', 'php', 'rb', 'sh', 'bat',
  'ps1', 'dockerfile', 'gitignore', 'toml', 'ini', 'cfg', 'conf', 'log'
];

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'ico', 'webp'];
export const BINARY_EXTENSIONS = ['pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib'];

export const isEditableFile = (filename) => {
  const extension = getFileExtension(filename);
  return EDITABLE_EXTENSIONS.includes(extension);
};

export const isImageFile = (filename) => {
  const extension = getFileExtension(filename);
  return IMAGE_EXTENSIONS.includes(extension);
};

export const isBinaryFile = (filename) => {
  const extension = getFileExtension(filename);
  return BINARY_EXTENSIONS.includes(extension);
};

export const getFileType = (filename) => {
  if (isImageFile(filename)) return 'image';
  if (isBinaryFile(filename)) return 'binary';
  if (isEditableFile(filename)) return 'text';
  return 'unknown';
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

  async createFile(name, content = '', path = '/', isBase64 = false) {
    const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
    const fileType = getFileType(name);
    const file = {
      id: createFileId(fullPath),
      name,
      content,
      path: fullPath,
      type: 'file',
      fileType,
      isBase64,
      size: isBase64 ? Math.ceil(content.length * 3 / 4) : new Blob([content]).size,
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

  async uploadFiles(files, targetPath = '/') {
    const uploadedFiles = [];
    
    for (const file of files) {
      const extension = getFileExtension(file.name);
      const fileType = getFileType(file.name);
      const maxSize = fileType === 'image' ? 5 * 1024 * 1024 : 
                     fileType === 'binary' ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
      
      if (file.size > maxSize) {
        const sizeLimit = fileType === 'image' ? '5MB' : 
                         fileType === 'binary' ? '10MB' : '2MB';
        throw new Error(`File ${file.name} is too large. Max size: ${sizeLimit}`);
      }
      
      let content;
      let isBase64 = false;
      
      if (fileType === 'image' || fileType === 'binary') {
        // Convert to base64 for binary files
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        content = btoa(String.fromCharCode.apply(null, uint8Array));
        isBase64 = true;
      } else {
        content = await file.text();
      }
      
      const uploadedFile = await this.createFile(file.name, content, targetPath, isBase64);
      uploadedFiles.push(uploadedFile);
    }
    
    return uploadedFiles;
  }

  async getFilePreviewData(path) {
    const file = await this.getFile(path);
    if (!file) throw new Error('File not found');
    
    const fileType = file.fileType || getFileType(file.name);
    
    if (fileType === 'image' && file.isBase64) {
      const extension = getFileExtension(file.name);
      const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      return {
        type: 'image',
        url: `data:${mimeType};base64,${file.content}`,
        size: file.size
      };
    } else if (fileType === 'text') {
      return {
        type: 'text',
        content: file.content,
        language: getLanguageFromExtension(getFileExtension(file.name))
      };
    } else {
      return {
        type: 'unsupported',
        message: `Preview not supported for ${fileType} files`,
        size: file.size
      };
    }
  }

  async downloadFile(path) {
    const file = await this.getFile(path);
    if (file) {
      let blob;
      if (file.isBase64) {
        const binaryString = atob(file.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes]);
      } else {
        blob = new Blob([file.content], { type: 'text/plain' });
      }
      saveAs(blob, file.name);
    } else {
      throw new Error('File not found');
    }
  }

  async importZipFile(zipFile) {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipFile);
    const importedFiles = [];
    
    for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
      if (!zipEntry.dir) {
        const fileName = relativePath.split('/').pop();
        const folderPath = '/' + relativePath.split('/').slice(0, -1).join('/');
        
        // Create folder structure if needed
        if (folderPath !== '/') {
          const folderParts = folderPath.split('/').filter(Boolean);
          let currentPath = '';
          for (const part of folderParts) {
            currentPath += '/' + part;
            try {
              await this.createFolder(part, currentPath.substring(0, currentPath.lastIndexOf('/')));
            } catch (e) {
              // Folder might already exist, continue
            }
          }
        }
        
        const fileType = getFileType(fileName);
        let content;
        let isBase64 = false;
        
        if (fileType === 'image' || fileType === 'binary') {
          const arrayBuffer = await zipEntry.async('arraybuffer');
          const uint8Array = new Uint8Array(arrayBuffer);
          content = btoa(String.fromCharCode.apply(null, uint8Array));
          isBase64 = true;
        } else {
          content = await zipEntry.async('text');
        }
        
        const importedFile = await this.createFile(
          fileName, 
          content, 
          folderPath === '/' ? '/' : folderPath,
          isBase64
        );
        importedFiles.push(importedFile);
      }
    }
    
    return importedFiles;
  }

  async downloadAllFiles() {
    const files = await this.getAllFiles();
    const zip = new JSZip();
    
    files.forEach(file => {
      if (file.type === 'file') {
        // Remove leading slash and create folder structure
        const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        
        if (file.isBase64) {
          // Convert base64 back to binary for ZIP
          const binaryString = atob(file.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          zip.file(path, bytes);
        } else {
          zip.file(path, file.content);
        }
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