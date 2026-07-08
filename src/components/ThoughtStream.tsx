import { useEffect, useRef, useMemo, createElement, type ReactNode } from 'react';
import type { ThoughtBubble, PrepareResult, GenerationPhase, AgentLoopState } from '../types';

interface ThoughtStreamProps {
  thoughts: ThoughtBubble[];
  phase: GenerationPhase;
  elapsed: number;
  prepareResult: PrepareResult | null;
  agentLoop: AgentLoopState;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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

function getPhaseIcon(status: AgentLoopState['phases'][number]['status']) {
  if (status === 'complete') return 'check_circle';
  if (status === 'active') return 'progress_activity';
  return 'radio_button_unchecked';
}

function getPhaseClass(status: AgentLoopState['phases'][number]['status']) {
  if (status === 'complete') return 'text-gsuccess';
  if (status === 'active') return 'text-gblue-600 dark:text-gblue-300';
  return 'text-gtext-secondary/50 dark:text-gtext-secondary-dark/50';
}

function LoopStatus({ agentLoop }: { agentLoop: AgentLoopState }) {
  const activePhase = agentLoop.phases.find(phase => phase.status === 'active');

  return (
    <div className="rounded-gbtn border border-gborder-light dark:border-gborder-dark bg-white dark:bg-gsurface-card-dark p-3 shadow-gcard-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gtext-primary dark:text-gtext-primary-dark">
            Turn {agentLoop.turn || 1}
          </div>
          <div className="text-[11px] text-gtext-secondary dark:text-gtext-secondary-dark truncate">
            {agentLoop.stateBackend === 'browser-local' ? 'Browser-local state' : 'Interactions state'}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-gpill px-2 py-1 text-[11px] font-medium ${
          agentLoop.hitlStatus === 'awaiting-input'
            ? 'bg-ggreen/10 text-ggreen-600 dark:text-ggreen'
            : 'bg-gblue-50 dark:bg-gblue-900/30 text-gblue-600 dark:text-gblue-300'
        }`}>
          <span className="material-symbols-outlined text-sm">
            {agentLoop.hitlStatus === 'awaiting-input' ? 'person_check' : 'sync'}
          </span>
          {agentLoop.hitlStatus === 'awaiting-input' ? 'HITL review' : 'Running'}
        </span>
      </div>

      {activePhase && (
        <p className="mt-2 text-xs text-gtext-secondary dark:text-gtext-secondary-dark">
          {activePhase.detail}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {agentLoop.phases.map((loopPhase) => (
          <div
            key={loopPhase.id}
            className={`flex items-center gap-1.5 rounded-gpill px-2 py-1 text-[11px] font-medium ${
              loopPhase.status === 'active'
                ? 'bg-gblue-50 dark:bg-gblue-900/30 text-gblue-700 dark:text-gblue-200'
                : 'bg-gsurface-light dark:bg-gsurface-elevated-dark text-gtext-secondary dark:text-gtext-secondary-dark'
            }`}
            title={loopPhase.detail}
          >
            <span className={`material-symbols-outlined text-sm ${getPhaseClass(loopPhase.status)}`}>
              {getPhaseIcon(loopPhase.status)}
            </span>
            <span className="truncate">{loopPhase.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ThoughtStream({ thoughts, phase, elapsed, prepareResult, agentLoop }: ThoughtStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const qualityChecks = prepareResult?.qualityChecks ?? [];
  const passedQualityChecks = qualityChecks.filter(check => check.status === 'pass').length;
  const warningQualityChecks = qualityChecks.filter(check => check.status === 'warn').length;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts.length, phase]);

  return (
    <div className="w-full lg:w-1/3 lg:min-w-[320px] lg:max-w-[440px] flex-shrink-0 flex flex-col gap-3">
      {/* Header with timer */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gtext-primary dark:text-gtext-primary-dark flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg text-gblue-600 dark:text-gblue-300">psychology</span>
          Agent Loop
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-gblue-600 dark:text-gblue-300 font-medium">
          <span className="material-symbols-outlined text-sm">timer</span>
          {formatTime(elapsed)}
        </div>
      </div>

      <LoopStatus agentLoop={agentLoop} />

      {/* Thought bubbles scrollable area */}
      <div
        ref={scrollRef}
        className="flex-1 max-h-[40vh] lg:max-h-[60vh] overflow-y-auto space-y-2 pr-1 scrollbar-thin"
      >
        {thoughts.map((bubble) => (
          <div
            key={bubble.id}
            className="border-l-2 border-gblue-300 dark:border-gblue-700 pl-3 py-1.5 animate-fade-in"
          >
            <MarkdownContent text={bubble.text} />
          </div>
        ))}

        {/* Analysis summary card */}
        {prepareResult && (
          <div className="bg-white dark:bg-gsurface-card-dark rounded-gbtn p-3 border border-gborder-light dark:border-gborder-dark shadow-gcard-sm animate-scale-in mt-2">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-gsuccess text-sm">check_circle</span>
              <span className="text-xs font-semibold text-gsuccess">Analysis Complete</span>
            </div>
            <p className="text-sm font-medium text-gtext-primary dark:text-gtext-primary-dark">
              {prepareResult.analysis.title}
            </p>
            <p className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark mt-0.5">
              {prepareResult.analysis.subtitle}
            </p>
            <p className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark mt-1">
              {prepareResult.analysis.sectionsCount} sections, {prepareResult.analysis.dataPointsCount} data points
            </p>
            {qualityChecks.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-gpill bg-gsuccess-50 dark:bg-gsuccess/10 px-2 py-0.5 text-[11px] font-medium text-gsuccess-600 dark:text-gsuccess">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  {passedQualityChecks}/{qualityChecks.length} evals passed
                </span>
                {warningQualityChecks > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-gpill bg-gwarning-50 dark:bg-gwarning/10 px-2 py-0.5 text-[11px] font-medium text-gwarning dark:text-gwarning">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    {warningQualityChecks} warning{warningQualityChecks === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            )}
            {prepareResult.analysis.brandColors.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark">Colors:</span>
                <div className="flex gap-1">
                  {prepareResult.analysis.brandColors.map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-gborder-light dark:border-gborder-dark"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phase indicator */}
        {phase === 'generating' && (
          <div className="flex items-center gap-2 py-2 animate-fade-in">
            <span className="material-symbols-outlined text-lg text-gblue-600 dark:text-gblue-300 animate-spin">
              progress_activity
            </span>
            <span className="text-xs font-medium text-gblue-600 dark:text-gblue-300">
              Generating image...
            </span>
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {phase === 'preparing' && (
        <div className="flex items-center gap-2 px-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gblue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gblue-500" />
          </span>
          <span className="text-xs text-gtext-secondary dark:text-gtext-secondary-dark">thinking...</span>
        </div>
      )}
    </div>
  );
}
