import { FileText, LogOut, MessageSquare, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileNav({ activeTab, setActiveTab }) {
  const { logout } = useAuth();
  return (
    <header className="md:hidden flex items-center justify-between border-b border-white/10 bg-ink-900 px-4 py-3">
      <div className="flex items-center gap-2 font-bold text-white">
        <Sparkles className="h-5 w-5 text-emerald-300" />
        DocMind
      </div>
      <nav className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`rounded-lg p-2 ${activeTab === 'documents' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400'}`}
          aria-label="Documents"
        >
          <FileText className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`rounded-lg p-2 ${activeTab === 'chat' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400'}`}
          aria-label="Chat"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
        <button type="button" onClick={logout} className="rounded-lg p-2 text-rose-300" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </nav>
    </header>
  );
}
