import React, { useState, useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ChatPanel from './pages/ChatPanel';

function AppShell() {
  const { token, loading } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('documents');

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center text-sm text-slate-400">
        Loading workspace…
      </div>
    );
  }

  if (!token) {
    return <LoginPage />;
  }

  return (
    <div className="h-dvh flex bg-app text-slate-100 font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
        {activeTab === 'documents' && (
          <div className="flex-1 overflow-y-auto">
            <Dashboard setActiveTab={setActiveTab} />
          </div>
        )}
        {activeTab === 'chat' && (
          <ChatPanel />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
