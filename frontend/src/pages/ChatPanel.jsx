import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { Send, Sparkles, Loader, User, Plus, MessageSquare, Search, FileText, Globe2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import CitationsPanel from '../components/CitationsPanel';
import api from '../lib/api';
import { streamAnswer } from '../lib/stream';

function MessageBubble({ msg, onCitationHover }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
        isUser
          ? 'bg-emerald-300 text-ink-950 border-emerald-200'
          : 'bg-white/[0.05] text-emerald-200 border-white/10'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      <div className={`p-4 rounded-xl text-sm leading-relaxed shadow-lg ${
        isUser
          ? 'bg-emerald-300 text-ink-950'
          : 'bg-ink-900/90 border border-white/10 text-slate-100'
      }`}>
        <p className="whitespace-pre-wrap">{msg.content}</p>

        {!isUser && msg.citations?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Sources</span>
            {msg.citations.map((cite, i) => {
              const Icon = cite.page === 'web' ? Globe2 : FileText;
              return (
                <span
                  key={`${cite.title}-${cite.page}-${i}`}
                  onMouseEnter={() => onCitationHover(cite)}
                  onMouseLeave={() => onCitationHover(null)}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-emerald-300 hover:text-ink-950 cursor-help font-semibold transition-colors"
                >
                  <Icon className="w-3 h-3" />
                  {cite.page === 'web' ? 'Web' : `${cite.title.replace('.pdf', '')} p${cite.page}`}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StreamingBubble({ text, phase }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 max-w-3xl"
    >
      <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-emerald-200" />
      </div>
      <div className="p-4 rounded-xl text-sm bg-ink-900/90 border border-emerald-300/20 text-slate-100 shadow-lg">
        {text ? (
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        ) : (
          <div className="flex items-center gap-2 text-slate-300">
            <Search className="w-4 h-4 text-emerald-300" />
            <span>Searching indexed document chunks...</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
          <Loader className="w-3.5 h-3.5 animate-spin text-emerald-300" />
          <span>{phase}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatPanel() {
  const { token, logout } = useContext(AuthContext);
  const [chats, setChats] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [citations, setCitations] = useState([]);
  const [hoveredCitation, setHoveredCitation] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [phase, setPhase] = useState('Ready');
  const messagesEndRef = useRef(null);
  const activeStreamRef = useRef(null);

  const readyDocuments = useMemo(
    () => documents.filter(document => document.status === 'ready'),
    [documents]
  );

  const selectedDocument = readyDocuments.find(document => document.id === selectedDocId);

  useEffect(() => {
    fetchChats();
    fetchDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => () => activeStreamRef.current?.abort(), []);

  const fetchChats = async () => {
    try {
      const res = await api.get('/chat');
      setChats(res.data);
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const loadChat = async (chatId) => {
    try {
      const res = await api.get(`/chat/${chatId}/messages`);
      setMessages(res.data);
      setCurrentChatId(chatId);
      setCitations([]);
      setHoveredCitation(null);
    } catch (err) {
      console.error('Error loading chat:', err);
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setCitations([]);
    setHoveredCitation(null);
    setInputMessage('');
    setStreamingText('');
    setPhase('Ready');
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const query = inputMessage.trim();
    if (!query || isGenerating) return;

    setInputMessage('');
    setIsGenerating(true);
    setStreamingText('');
    setPhase('Searching vector index');

    setMessages(prev => [...prev, {
      id: `local-${Date.now()}`,
      role: 'user',
      content: query,
      citations: []
    }]);

    const controller = new AbortController();
    activeStreamRef.current = controller;
    let accumulated = '';
    let newChatId = currentChatId;

    try {
      await streamAnswer({
        token,
        signal: controller.signal,
        payload: {
          query,
          doc_id: selectedDocId || null,
          doc_title: selectedDocument?.title || 'All Documents',
          chat_id: currentChatId
        },
        onEvent: ({ event, data }) => {
          if (event === 'chat') {
            newChatId = data;
            setCurrentChatId(data);
            return;
          }
          if (event === 'error') {
            const payload = JSON.parse(data || '{}');
            throw new Error(payload.message || 'The answer stream failed.');
          }
          if (event === 'end' || !data || data === 'close') return;
          if (data.startsWith('[METADATA]')) {
            const metadata = JSON.parse(data.slice(10).trim());
            setCitations(metadata.citations || []);
            setPhase(metadata.web_search_used ? 'Web fallback complete' : 'Grounded answer complete');
            return;
          }
          accumulated += data;
          setStreamingText(accumulated);
          setPhase('Generating cited answer');
        }
      });

      await fetchChats();
      if (newChatId) await loadChat(newChatId);
    } catch (err) {
      console.error('Stream error:', err);
      if (err.status === 401 || err.status === 403) logout();
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: err.message,
        citations: []
      }]);
    } finally {
      controller.abort();
      activeStreamRef.current = null;
      setStreamingText('');
      setIsGenerating(false);
      setPhase('Ready');
    }
  };

  const suggestions = [
    'Summarize the strongest experience in this document.',
    'What technical skills are mentioned?',
    'Find the most relevant project achievements.'
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="hidden lg:flex w-72 bg-ink-900/60 border-r border-white/10 flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 bg-emerald-300 text-ink-950 text-xs font-semibold py-2.5 rounded-lg hover:bg-emerald-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Conversation
          </button>
        </div>

        <div className="p-3 overflow-hidden flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">
            Past Sessions
          </p>
          <div className="space-y-0.5 overflow-y-auto h-full pr-1">
            {chats.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">
                No past sessions yet.
              </p>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => loadChat(chat.id)}
                  className={`w-full text-left text-xs p-2.5 rounded-lg truncate flex items-center gap-2 hover:bg-white/[0.05] transition-colors ${
                    currentChatId === chat.id
                      ? "bg-emerald-400/10 text-emerald-200 font-semibold"
                      : "text-slate-400"
                  }`}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.25),rgba(2,6,23,0))]">
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 bg-ink-900/40 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">
              AI Chat Workspace
            </h3>
            <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-0.5">
              Cross-document RAG with citations
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="relative min-w-[240px]">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="appearance-none w-full bg-ink-950/70 border border-white/10 rounded-lg py-2 pl-9 pr-9 text-xs font-semibold text-slate-200 focus:border-emerald-300"
              >
                <option value="">All ready documents</option>
                {readyDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </label>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span>{readyDocuments.length} ready sources</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 && !streamingText && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-full text-center space-y-4"
            >
              <div className="bg-emerald-400/10 border border-emerald-300/20 p-4 rounded-2xl">
                <Search className="w-10 h-10 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Ask across your indexed knowledge
                </h3>
                <p className="text-sm text-slate-400 max-w-md mt-2">
                  DocMind searches the vector index first, then streams an
                  answer with source badges.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 mt-3 w-full max-w-lg">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputMessage(suggestion)}
                    className="text-left text-xs px-4 py-3 panel hover:border-emerald-300/30 transition-colors text-slate-300 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onCitationHover={setHoveredCitation}
              />
            ))}
          </AnimatePresence>

          {isGenerating && (
            <StreamingBubble text={streamingText} phase={phase} />
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={sendMessage}
          className="p-4 border-t border-white/10 bg-ink-900/60"
        >
          <div className="relative flex items-center gap-3 max-w-4xl mx-auto">
            <input
              type="text"
              autoComplete="off"
              placeholder={
                isGenerating
                  ? "AI is generating a response..."
                  : "Ask a question about your uploaded documents..."
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isGenerating}
              className="flex-1 bg-ink-800/90 border border-white/20 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-400 focus:border-emerald-300 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isGenerating}
              className="absolute right-2.5 p-2 bg-emerald-300 text-ink-950 rounded-lg hover:bg-emerald-200 disabled:opacity-40 transition-colors"
              title="Send message"
            >
              {isGenerating ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            {selectedDocument
              ? `Searching ${selectedDocument.title}`
              : "Searching all ready documents"}
          </p>
        </form>
      </div>

      <CitationsPanel citations={citations} hoveredCitation={hoveredCitation} />
    </div>
  );
}
