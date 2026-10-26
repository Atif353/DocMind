import React, { useContext } from 'react';
import { MessageSquare, LogOut, Shield, User, Sparkles, LibraryBig } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user, logout } = useContext(AuthContext);

  return (
    <aside className="hidden md:flex w-64 bg-ink-900 border-r border-white/10 flex-col justify-between p-4 shrink-0">
      <div>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8 px-2 py-1"
        >
          <div className="h-10 w-10 rounded-lg bg-emerald-400/15 border border-emerald-300/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <span className="block font-bold text-lg tracking-tight text-white">DocMind</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">RAG Workspace</span>
          </div>
        </motion.div>

        <nav className="space-y-1.5">
          <button 
            onClick={() => setActiveTab('documents')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'documents' 
                ? 'bg-emerald-400/10 text-emerald-200 border border-emerald-300/20'
                : 'hover:bg-white/5 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <LibraryBig className="w-4 h-4" />
            <span>Documents</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'chat' 
                ? 'bg-emerald-400/10 text-emerald-200 border border-emerald-300/20'
                : 'hover:bg-white/5 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Workspace</span>
          </button>
        </nav>
      </div>

      <div className="border-t border-white/10 pt-4 px-2 space-y-3">
        {user && (
          <div className="flex items-center gap-3">
            <div className="bg-sky-400/10 p-2 rounded-lg border border-sky-300/15">
              <User className="w-4 h-4 text-sky-200" />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold truncate leading-tight text-white">{user.name}</h4>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.role}</span>
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={logout}
          className="w-full flex items-center gap-2 text-xs font-semibold text-rose-300 hover:text-rose-200 py-1.5 focus:outline-none transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
