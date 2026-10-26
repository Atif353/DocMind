import React, { useState, useContext } from 'react';
import { Sparkles, Mail, Lock, User, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { AuthContext } from '../context/AuthContext';

export default function LoginPage() {
  const { setToken } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', {
          email: form.email,
          password: form.password
        });
        setToken(res.data.token);
      } else {
        await api.post('/auth/register', form);
        setSuccessMsg('Account created! Please sign in.');
        setIsLogin(true);
        setForm(prev => ({ ...prev, name: '' }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] overflow-hidden rounded-[28px] border border-white/10 bg-ink-900/80 shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        <div className="hidden lg:flex flex-col justify-between p-10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.20),transparent_34%),linear-gradient(145deg,rgba(15,23,42,0.9),rgba(3,7,18,0.94))] border-r border-white/10">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/15">
              <Sparkles className="h-6 w-6 text-emerald-200" />
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight text-white">
              Search every document with grounded AI.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Upload PDFs, index them with the Python RAG engine, and ask questions with citations pulled from the matching pages.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {['PDF ingest', 'FAISS index', 'Cited answers'].map(item => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-xs font-semibold text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">

        <div className="flex flex-col items-center mb-8">
          <div className="bg-emerald-400/15 p-3 rounded-2xl mb-3 border border-emerald-300/20">
            <Sparkles className="w-8 h-8 text-emerald-200" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">DocMind AI</h2>
          <p className="text-sm text-slate-400 mt-1">Enterprise Document Intelligence Platform</p>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-white/10 mb-6 bg-white/[0.03]">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
            className={`flex-1 text-xs font-semibold py-2 transition-colors ${
              isLogin ? 'bg-emerald-300 text-ink-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
            className={`flex-1 text-xs font-semibold py-2 transition-colors ${
              !isLogin ? 'bg-emerald-300 text-ink-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={updateField('name')}
                  className="w-full bg-ink-950/70 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={updateField('email')}
                className="w-full bg-ink-950/70 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={form.password}
                onChange={updateField('password')}
                className="w-full bg-ink-950/70 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-center gap-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-200">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-300 text-ink-950 font-semibold text-sm py-2.5 rounded-lg hover:bg-emerald-200 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center mt-6">
          Access roles are managed by your DocMind administrator.
        </p>
      </div>
      </motion.div>
    </div>
  );
}
