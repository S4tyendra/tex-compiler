import { fileStorage } from './file-storage';

const API_BASE = 'https://tex-compiler.devh.in';

class CompilerService {
  constructor() {
    // We'll use IndexedDB through fileStorage instead of localStorage
  }

  async compileProject(files, mainFile = 'main', compiler = 'pdflatex') {
    const formData = new FormData();
    
    // Create ZIP from files
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Add all files to ZIP
    files.forEach(file => {
      if (file.type === 'file') {
        const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        
        if (file.isBase64) {
          // Convert base64 back to binary
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
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    formData.append('file', zipBlob, 'project.zip');
    formData.append('main', mainFile);
    formData.append('compiler', compiler);
    
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success || result.job_id) {
      // Save to compilation history
      const compilation = {
        id: result.job_id,
        timestamp: new Date().toISOString(),
        mainFile,
        compiler,
        success: result.success,
        logsUrl: result.logs_url,
        pdfUrl: result.pdf_url,
        message: result.message
      };
      
      await this.addCompilation(compilation);
    }
    
    return result;
  }
  
  async compileSingleFile(content, filename, compiler = 'pdflatex') {
    const formData = new FormData();
    const blob = new Blob([content], { type: 'text/plain' });
    formData.append('file', blob, filename);
    formData.append('compiler', compiler);
    
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success || result.job_id) {
      const compilation = {
        id: result.job_id,
        timestamp: new Date().toISOString(),
        mainFile: filename.replace('.tex', ''),
        compiler,
        success: result.success,
        logsUrl: result.logs_url,
        pdfUrl: result.pdf_url,
        message: result.message
      };
      
      await this.addCompilation(compilation);
    }
    
    return result;
  }
  
  async getHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return await response.json();
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        running_jobs: 0,
        max_concurrent: 3
      };
    }
  }
  
  async downloadPDF(jobId) {
    const response = await fetch(`${API_BASE}/files/${jobId}.pdf`);
    if (!response.ok) {
      throw new Error('PDF not found');
    }
    return response.blob();
  }
  
  async getLogs(jobId) {
    const response = await fetch(`${API_BASE}/logs/${jobId}.log`);
    if (!response.ok) {
      throw new Error('Logs not found');
    }
    return response.text();
  }
  
  async addCompilation(compilation) {
    await fileStorage.saveCompilation(compilation);
    await fileStorage.deleteOldCompilations(); // Keep only 20 most recent
  }
  
  async getCompilations() {
    return await fileStorage.getCompilations();
  }
  
  async getLatestCompilation() {
    const compilations = await this.getCompilations();
    return compilations[0] || null;
  }
}

export const compilerService = new CompilerService();