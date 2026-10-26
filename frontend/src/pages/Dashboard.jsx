import React, { useState, useEffect, useContext } from 'react';
import { Trash2, Loader, CheckCircle, AlertTriangle, RefreshCw, MessageSquare, Database, FileSearch, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { AuthContext } from '../context/AuthContext';
import UploadCard from '../components/UploadCard';

export default function Dashboard({ setActiveTab }) {
  const { user } = useContext(AuthContext);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDocuments = async () => {
    try {
      setError('');
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.response?.data?.error || 'Unable to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document? Its vector index will also be removed.')) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchDocuments();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Failed to delete document.');
    }
  };

  const canEdit = user && ['admin', 'manager', 'editor'].includes(user.role);

  const statusStyles = {
    ready: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20',
    processing: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    failed: 'bg-rose-500/10 text-rose-200 border-rose-400/20',
  };

  const readyCount = documents.filter(d => d.status === 'ready').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Knowledge Operations</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Document Hub</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Upload PDFs, monitor indexing, and move straight into cited cross-document search.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('chat')}
          className="inline-flex items-center justify-center gap-2 bg-emerald-300 text-ink-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-200 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Open Chat
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Documents', value: documents.length, icon: Database, accent: 'text-sky-200' },
          { label: 'Ready Sources', value: readyCount, icon: CheckCircle, accent: 'text-emerald-200' },
          { label: 'Processing Queue', value: processingCount, icon: Activity, accent: 'text-amber-200' }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="panel p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
              </div>
              <div className="h-11 w-11 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center">
                <stat.icon className={`h-5 w-5 ${stat.accent}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {canEdit && <UploadCard onUploadSuccess={fetchDocuments} />}
        </div>

        <div className="panel p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-sky-200" />
              Retrieval Stack
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Vector Store</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-200 font-bold uppercase border border-sky-300/20">
                FAISS Local
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Answer Mode</span>
              <span className="text-xs font-semibold text-slate-200">
                CRAG + Self-RAG
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Search Scope</span>
              <span className="text-xs font-semibold text-slate-200">
                All Ready Docs
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('chat')}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-white/10 text-slate-100 text-xs font-semibold py-2 rounded-lg hover:bg-white/15 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Ask a Question
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-white">Indexed Files</h3>
          <button onClick={fetchDocuments} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200 hover:text-emerald-100">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Loading documents...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-slate-500 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Added</th>
                  {canEdit && <th className="py-3 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-slate-400 text-sm">
                      No documents indexed yet. Upload your first PDF above.
                    </td>
                  </tr>
                ) : (
                  documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-6 font-semibold truncate max-w-xs text-slate-100">{doc.title}</td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusStyles[doc.status] || ''}`}>
                          {doc.status === 'processing' && <Loader className="w-3 h-3 animate-spin" />}
                          {doc.status === 'ready' && <CheckCircle className="w-3 h-3" />}
                          {doc.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                          <span className="capitalize">{doc.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-6 text-slate-500 text-xs">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      {canEdit && (
                        <td className="py-3 px-6 text-right">
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-rose-300 hover:text-rose-200 p-1.5 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
