import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Loader, Cloud } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';

export default function UploadCard({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setMessage({ text: '', type: '' });

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ text: 'Uploaded successfully. Semantic indexing running.', type: 'success' });
      setSelectedFile(null);
      e.target.reset();
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setMessage({ text: err.response?.data?.error || 'File upload failed.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-6"
    >
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-white">
        <Upload className="w-4 h-4 text-emerald-300" />
        <span>Upload Knowledge Source</span>
      </h3>
      
      <form onSubmit={handleFileUpload} className="space-y-4">
        <div className="border-2 border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center hover:border-emerald-300/40 transition-colors bg-ink-950/30">
          <div className="h-14 w-14 rounded-xl bg-sky-400/10 border border-sky-300/20 flex items-center justify-center mb-3">
            {selectedFile ? <FileText className="w-7 h-7 text-sky-200" /> : <Cloud className="w-7 h-7 text-sky-200" />}
          </div>
          {selectedFile ? (
            <span className="text-sm text-emerald-200 font-semibold truncate max-w-xs">{selectedFile.name}</span>
          ) : (
            <span className="text-xs text-slate-400">Supports PDF up to 50MB</span>
          )}
          <input 
            type="file" 
            accept=".pdf" 
            onChange={e => setSelectedFile(e.target.files[0])}
            className="hidden" 
            id="pdf-upload-file" 
          />
          <label 
            htmlFor="pdf-upload-file" 
            className="mt-4 px-4 py-1.5 bg-white/10 text-xs font-semibold rounded-lg cursor-pointer hover:bg-white/15 transition-colors text-slate-100"
          >
            Browse PDF
          </label>
        </div>

        {message.text && (
          <div className={`text-xs p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-200 border border-rose-500/20'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <button 
          type="submit" 
          disabled={!selectedFile || uploading}
          className="w-full bg-emerald-300 text-ink-950 text-sm font-semibold py-2 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading && <Loader className="w-4 h-4 animate-spin" />}
          <span>{uploading ? 'Parsing & Indexing...' : 'Upload & Process Vector Store'}</span>
        </button>
      </form>
    </motion.div>
  );
}
