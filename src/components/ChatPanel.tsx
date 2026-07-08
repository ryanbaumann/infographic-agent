import { useState, useEffect, useRef, useCallback, createElement, useMemo, type ReactNode } from 'react';
import type { ChatMessage, InfographicMode, ThoughtBubble, AgentLoopState } from '../types';
import { QUICK_ACTIONS, GENERAL_QUICK_ACTIONS } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  mode: InfographicMode;
  onSendMessage: (text: string) => void;
  isRefining: boolean;
  refineThoughts: ThoughtBubble[];
  agentLoop: AgentLoopState;
}

/** Parse inline markdown (bold, italic, code) into React nodes */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let i = 0;

  for (const match of text.matchAll(re)) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      nodes.push(createElement('strong', { key: `${keyPrefix}-b${i}`, className: 'text-gtext-primary dark:text-gtext-primary-dark font-semibold' }, match[2]));
    } else if (match[3]) {
      nodes.push(createElement('em', { key: `${keyPrefix}-i${i}` }, match[3]));
    } else if (match[4]) {
      nodes.push(createElement('code', { key: `${keyPrefix}-c${i}`, className: 'px-1 py-0.5 rounded bg-gblue-50 dark:bg-gblue-900/30 text-gblue-700 dark:text-gblue-300 text-[10px] font-mono' }, match[4]));
    }
    lastIndex = match.index + match[0].length;
    i++;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length > 0 ? nodes : [text];
}

/** Render markdown text as React elements */
function MarkdownContent({ text }: { text: string }) {
  const elements = useMemo(() => {
    const lines = text.split('\n');
    const result: ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trimStart();

      // Headers
      if (trimmed.startsWith('### ')) {
        result.push(createElement('div', { key: `l${lineIdx}`, className: 'text-xs font-semibold text-gtext-primary dark:text-gtext-primary-dark mt-1' }, parseInline(trimmed.slice(4), `l${lineIdx}`)));
        return;
      }
      if (trimmed.startsWith('## ')) {
        result.push(createElement('div', { key: `l${lineIdx}`, className: 'text-xs font-semibold text-gtext-primary dark:text-gtext-primary-dark mt-1.5' }, parseInline(trimmed.slice(3), `l${lineIdx}`)));
        return;
      }
      if (trimmed.startsWith('# ')) {
        result.push(createElement('div', { key: `l${lineIdx}`, className: 'text-sm font-bold text-gtext-primary dark:text-gtext-primary-dark mt-2' }, parseInline(trimmed.slice(2), `l${lineIdx}`)));
        return;
      }

      // Unordered list: - item or * item (not bold **)
      if (/^[-*] /.test(trimmed) && !trimmed.startsWith('**')) {
        const content = trimmed.slice(2);
        result.push(
          createElement('div', { key: `l${lineIdx}`, className: 'flex gap-1.5 items-start' },
            createElement('span', { className: 'text-gblue-500 mt-px select-none leading-relaxed' }, '\u2022'),
            createElement('span', { className: 'leading-relaxed' }, parseInline(content, `l${lineIdx}`))
          )
        );
        return;
      }

      // Numbered list: 1. item
      const numMatch = trimmed.match(/^(\d+)\. (.+)/);
      if (numMatch) {
        result.push(
          createElement('div', { key: `l${lineIdx}`, className: 'flex gap-1.5 items-start' },
            createElement('span', { className: 'text-gblue-500 font-medium select-none min-w-[1rem] text-right leading-relaxed' }, `${numMatch[1]}.`),
            createElement('span', { className: 'leading-relaxed' }, parseInline(numMatch[2], `l${lineIdx}`))
          )
        );
        return;
      }

      // Empty line
      if (!trimmed) {
        result.push(createElement('div', { key: `l${lineIdx}`, className: 'h-1' }));
        return;
      }

      // Regular paragraph
      result.push(createElement('span', { key: `l${lineIdx}`, className: 'leading-relaxed block' }, parseInline(line, `l${lineIdx}`)));
    });

    return result;
  }, [text]);

  return createElement('div', { className: 'text-xs text-gtext-secondary dark:text-gtext-secondary-dark space-y-0.5' }, ...elements);
}

export default function ChatPanel({ messages, mode, onSendMessage, isRefining, refineThoughts, agentLoop }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, refineThoughts.length]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isRefining) return;
    setInput('');
    onSendMessage(text);
  }, [input, isRefining, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleChipClick = useCallback((action: string) => {
    setInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return action;
      // If action is already there, remove it
      if (trimmed.includes(action)) {
         return trimmed
           .split(',')
           .map(s => s.trim())
           .filter(s => s !== action)
           .join(', ');
      }
      return `${trimmed}, ${action}`;
    });
  }, []);

  const modeChips = QUICK_ACTIONS[mode] || [];
  const allChips = [...modeChips, ...GENERAL_QUICK_ACTIONS];

  return (
    <div className="w-full lg:w-2/5 lg:min-w-[320px] xl:min-w-[400px] lg:max-w-[520px] flex-shrink-0 flex flex-col bg-white dark:bg-gsurface-card-dark rounded-gcard border border-gborder-light dark:border-gborder-dark shadow-gcard-sm overflow-hidden lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-120px)] lg:self-start">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gborder-light dark:border-gborder-dark">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gtext-primary dark:text-gtext-primary-dark flex items-center gap-1.5">
            <span className="material-symbols-outlined text-lg text-gblue-600 dark:text-gblue-300">chat</span>
            Review & Refine
          </h3>
          <span className="inline-flex items-center gap-1 rounded-gpill bg-gsurface-light dark:bg-gsurface-elevated-dark px-2 py-1 text-[11px] font-medium text-gtext-secondary dark:text-gtext-secondary-dark">
            <span className="material-symbols-outlined text-sm">{isRefining ? 'sync' : 'person_check'}</span>
            Turn {agentLoop.turn || 1}
          </span>
        </div>
        <p className="mt-1 text-xs text-gtext-secondary dark:text-gtext-secondary-dark line-clamp-2">
          {agentLoop.stopRule}
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-[300px] max-h-[45vh] lg:max-h-none overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-gcard text-sm ${
                msg.role === 'user'
                  ? 'bg-gblue-600 text-white rounded-br-sm'
                  : 'bg-gsurface-light dark:bg-gsurface-elevated-dark text-gtext-primary dark:text-gtext-primary-dark rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isRefining && refineThoughts.length > 0 && (
          <div className="flex justify-start">
             <div className="bg-gsurface-light dark:bg-gsurface-elevated-dark rounded-gcard rounded-bl-sm px-3 py-2 flex flex-col gap-2 max-w-[85%]">
                <div className="flex items-center gap-1.5 border-b border-gborder-light dark:border-gborder-dark pb-1.5 mb-1">
                   <span className="material-symbols-outlined text-sm text-gblue-600 dark:text-gblue-300">psychology</span>
                   <span className="text-xs font-semibold text-gtext-secondary dark:text-gtext-secondary-dark">Thinking...</span>
                   <div className="w-3 h-3 ml-auto border-2 border-gblue-600 dark:border-gblue-300 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="space-y-2 opacity-80">
                  {refineThoughts.map((bubble) => (
                    <div
                      key={bubble.id}
                      className="border-l-2 border-gblue-300/50 dark:border-gblue-700/50 pl-2 animate-fade-in"
                    >
                      <MarkdownContent text={bubble.text} />
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {isRefining && refineThoughts.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-gsurface-light dark:bg-gsurface-elevated-dark rounded-gcard rounded-bl-sm px-3 py-2 flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-gblue-600 dark:border-gblue-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark">Refining...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick action chips */}
      <div className="px-4 py-2 border-t border-gborder-light dark:border-gborder-dark">
        <div className="flex flex-wrap gap-1.5">
          {allChips.map((action) => (
            <button
               key={action}
               type="button"
               onClick={() => handleChipClick(action)}
               disabled={isRefining}
               className={`px-2.5 py-1 rounded-gpill text-xs font-medium border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                 input.includes(action)
                   ? 'bg-gblue-100 dark:bg-gblue-900/30 text-gblue-700 dark:text-gblue-300 border-gblue-300 dark:border-gblue-700 hover:bg-gblue-200 dark:hover:bg-gblue-800/40'
                   : 'bg-gsurface-light dark:bg-gsurface-elevated-dark text-gtext-secondary dark:text-gtext-secondary-dark border-gborder-light dark:border-gborder-dark hover:border-gblue-300 dark:hover:border-gblue-700 hover:text-gblue-600 dark:hover:text-gblue-300'
               }`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gborder-light dark:border-gborder-dark">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe changes..."
            disabled={isRefining}
            rows={2}
            className="flex-1 rounded-gbtn border border-gborder-light dark:border-gborder-dark
              bg-gsurface-light dark:bg-gsurface-elevated-dark
              text-gtext-primary dark:text-gtext-primary-dark
              px-3 py-2 text-sm
              placeholder:text-gtext-secondary dark:placeholder:text-gtext-secondary-dark
              focus:outline-none focus:ring-2 focus:ring-gblue-500 focus:ring-offset-1
              transition-all duration-200 resize-none
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isRefining || !input.trim()}
            className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-gbtn bg-gblue-600 hover:bg-gblue-700
              text-white transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              inline-flex items-center justify-center flex-shrink-0
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gblue-500 focus-visible:ring-offset-1"
            title="Send message (Enter)"
            aria-label="Send message"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
