import React from 'react';
import { HelpCircle, Quote, Globe2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CitationsPanel({ citations, hoveredCitation }) {
  return (
    <div className="hidden xl:flex w-80 bg-ink-900/70 border-l border-white/10 flex-col p-4 shrink-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5 border-b border-white/10 pb-2">
        <Quote className="w-4 h-4 text-emerald-300" />
        <span>Citation Inspector</span>
      </h3>

      <AnimatePresence mode="wait">
        {hoveredCitation ? (
          <motion.div
            key="hovered"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="panel p-4 space-y-3 flex-1"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-emerald-200 truncate max-w-[170px]">{hoveredCitation.title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 font-bold text-slate-200">
                {hoveredCitation.page === 'web' ? 'Web Link' : `Page ${hoveredCitation.page}`}
              </span>
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-1">Grounded Chunk</h4>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-ink-950/60 p-3 rounded-lg border border-white/10">
                {hoveredCitation.text}
              </p>
            </div>
          </motion.div>
        ) : citations.length > 0 ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-start space-y-3 overflow-hidden"
          >
            <p className="text-[11px] text-slate-400">
              Hover a source badge in the answer to inspect the chunk that grounded it.
            </p>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {citations.map((c, i) => {
                const Icon = c.page === 'web' ? Globe2 : FileText;
                return (
                  <div key={i} className="bg-white/[0.04] p-3 rounded-lg border border-white/10 text-xs">
                    <div className="flex justify-between items-center font-bold text-[10px] text-emerald-200 mb-1 gap-2">
                      <span className="truncate max-w-[160px] flex items-center gap-1.5">
                        <Icon className="h-3 w-3 shrink-0" />
                        {c.title}
                      </span>
                      <span className="text-slate-400">{c.page === 'web' ? 'Web' : `Page ${c.page}`}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] line-clamp-3">{c.text}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-4"
          >
            <HelpCircle className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-xs">No active citations to inspect.</p>
            <p className="text-[10px] mt-1">Citations populate when answers use indexed chunks.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
