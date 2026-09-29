'use client';

import React, { useState, useEffect } from 'react';
import {
  Code2,
  Users2,
  TrendingUp,
  Terminal,
  CheckCircle2,
  GitBranch,
  Play,
  Layers,
  BarChart3,
  DollarSign,
  Briefcase,
  Target,
  Sparkles,
  ArrowUpRight,
  Cpu,
  UserCheck,
  Megaphone,
  Kanban
} from 'lucide-react';

interface StageConfig {
  id: 'coding' | 'management' | 'sales';
  title: string;
  subtitle: string;
  badge: string;
  role: string;
  tagline: string;
  color: string;
  gradient: string;
  accentBg: string;
  icon: React.ElementType;
}

const STAGES: StageConfig[] = [
  {
    id: 'coding',
    title: '1. Engineering & Code Automation',
    subtitle: 'Building Scalable Full-Stack Solutions',
    badge: 'STAGE 01 • DEV MODE',
    role: 'Lead Full-Stack & Automation Engineer',
    tagline: 'Writing high-throughput APIs, automated pipelines & frontend systems',
    color: 'sky',
    gradient: 'from-sky-500 to-blue-600',
    accentBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
    icon: Code2,
  },
  {
    id: 'management',
    title: '2. Team & Operations Leadership',
    subtitle: 'Orchestrating Sprints, Roles & Delivery',
    badge: 'STAGE 02 • OPS LEAD',
    role: 'Operations & Sprint Director',
    tagline: 'Assigning deliverables, tracking team matrix & unblocking roadblocks',
    color: 'purple',
    gradient: 'from-purple-600 to-indigo-600',
    accentBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    icon: Users2,
  },
  {
    id: 'sales',
    title: '3. Enterprise Growth & Marketing',
    subtitle: 'Driving Market Reach & Revenue Streams',
    badge: 'STAGE 03 • GROWTH',
    role: 'Growth & Enterprise Strategist',
    tagline: 'Analyzing revenue conversion, client acquisition & outreach ROI',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    accentBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: TrendingUp,
  },
];

export function CompanyWorkflowShowcase() {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [typingIndex, setTypingIndex] = useState(0);

  const stage = STAGES[currentStageIndex];

  // Stage rotation loop timer (every 6.5s)
  useEffect(() => {
    setProgress(0);
    const intervalMs = 50;
    const totalDuration = 6500;
    const step = (intervalMs / totalDuration) * 100;

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentStageIndex((idx) => (idx + 1) % STAGES.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(progressTimer);
  }, [currentStageIndex]);

  // Code typing effect for Stage 1
  useEffect(() => {
    if (stage.id !== 'coding') return;
    setTypingIndex(0);
    const codeLength = 220;
    const codeTimer = setInterval(() => {
      setTypingIndex((prev) => (prev < codeLength ? prev + 3 : prev));
    }, 40);
    return () => clearInterval(codeTimer);
  }, [currentStageIndex, stage.id]);

  const rawCode = `// WisBees Enterprise Orchestration Engine
export async function dispatchTaskPipeline(payload: TaskPayload) {
  const employee = await Matrix.matchScope(payload.role);
  const pipeline = await Workflow.init({ autoAssign: true });
  return pipeline.execute({ assignee: employee.id, priority: "URGENT" });
}`;

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 lg:p-8 select-none relative overflow-hidden">
      
      {/* Background Radial Ambiance */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-3xl pointer-events-none transition-all duration-700" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none transition-all duration-700" />

      {/* Top Bar: Live Stepper & Company Mission */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs backdrop-blur-md">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Cross-Functional Enterprise Workflow
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold bg-white/70 dark:bg-slate-800/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            0{currentStageIndex + 1} / 03
          </div>
        </div>

        {/* 3 Step Interactive Tab Switcher with Progress Bars */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {STAGES.map((s, idx) => {
            const isActive = idx === currentStageIndex;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setCurrentStageIndex(idx);
                  setProgress(0);
                }}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-800/95 border-slate-300 dark:border-slate-600 shadow-lg scale-[1.02]'
                    : 'bg-white/40 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 hover:bg-white/80 dark:hover:bg-slate-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Active Progress Line */}
                {isActive && (
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 opacity-15"
                    style={{ width: `${progress}%` }}
                  />
                )}
                {/* Active Top Glow Bar */}
                {isActive && (
                  <div
                    className="absolute top-0 left-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500"
                    style={{ width: `${progress}%` }}
                  />
                )}

                <div className="flex items-center gap-2 relative z-10">
                  <div
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                      {idx === 0 ? 'Coding' : idx === 1 ? 'Team Ops' : 'Growth & Sales'}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                      {idx === 0 ? 'Engineering' : idx === 1 ? 'Leadership' : 'Marketing'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Dynamic Stage Animation Canvas */}
      <div className="relative z-10 my-4 flex-1 flex flex-col justify-center">
        
        {/* Active Stage Header */}
        <div className="mb-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${stage.accentBg}`}>
              {stage.badge}
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {stage.role}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {stage.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stage.tagline}
          </p>
        </div>

        {/* ─── STAGE 1: CODING & AUTOMATION VISUAL ─── */}
        {stage.id === 'coding' && (
          <div className="space-y-3 animate-fadeIn">
            {/* Animated Code IDE Terminal */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-4 font-mono text-xs text-slate-200 relative overflow-hidden">
              {/* Window Controls */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                  <span className="text-[11px] text-slate-400 font-bold ml-2">wisbees-engine.ts</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-800/50">
                  <GitBranch className="w-3 h-3" />
                  <span>main • live-sync</span>
                </div>
              </div>

              {/* Code Stream */}
              <pre className="text-[11px] leading-relaxed text-slate-300 overflow-x-auto whitespace-pre-wrap">
                <code>
                  <span className="text-purple-400">export async function</span>{' '}
                  <span className="text-sky-300 font-bold">dispatchTaskPipeline</span>
                  (payload: <span className="text-amber-300">TaskPayload</span>) &#123;
                  {'\n'}  <span className="text-purple-400">const</span> employee ={' '}
                  <span className="text-purple-400">await</span> Matrix.
                  <span className="text-blue-300">matchScope</span>(payload.role);
                  {'\n'}  <span className="text-purple-400">const</span> pipeline ={' '}
                  <span className="text-purple-400">await</span> Workflow.
                  <span className="text-blue-300">init</span>(&#123; autoAssign: <span className="text-emerald-400">true</span> &#125;);
                  {'\n'}  <span className="text-purple-400">return</span> pipeline.
                  <span className="text-emerald-400 font-bold">execute</span>(&#123; assignee: employee.id &#125;);
                  {'\n'}&#125;
                </code>
              </pre>

              {/* Interactive Working Person Status & CI/CD Pipeline */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CI/CD Pipeline: 28/28 Tests Passed</span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-400 font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded-md">
                  <Cpu className="w-3 h-3 animate-spin" />
                  <span>0.18ms latency</span>
                </div>
              </div>
            </div>

            {/* Live Floating Dev Metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Automation</div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">100% Automated</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Deployment</div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">Zero Downtime</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STAGE 2: TEAM MANAGEMENT & SPRINT LEADERSHIP VISUAL ─── */}
        {stage.id === 'management' && (
          <div className="space-y-3 animate-fadeIn">
            {/* Interactive Operations Agile Board */}
            <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Kanban className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-black text-slate-900 dark:text-white">Live Sprint Board • Operations Sprint #42</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  94% Velocity
                </span>
              </div>

              {/* 3 Kanban Columns */}
              <div className="grid grid-cols-3 gap-2 text-left">
                {/* Column 1: In Progress */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Active Work</span>
                    <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-bold">3</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-1">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">FE DEV</span>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">API Matrix Sync</div>
                    <div className="text-[9px] text-slate-400 font-medium">Chhayakanta M.</div>
                  </div>
                </div>

                {/* Column 2: Review */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Admin Review</span>
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[9px] font-bold">2</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-1">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">APPROVAL</span>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Deliverable Sign-Off</div>
                    <div className="text-[9px] text-slate-400 font-medium">Operations Head</div>
                  </div>
                </div>

                {/* Column 3: Completed */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Completed</span>
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[9px] font-bold">12</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs space-y-1">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">SHIPPED</span>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Role Matrix v2.4</div>
                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">✓ 100% SLA</div>
                  </div>
                </div>
              </div>

              {/* Team Leader Pulse */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold">
                  <UserCheck className="w-4 h-4" />
                  <span>Team Allocation: All 8 Roles Fully Synced</span>
                </div>
                <div className="flex -space-x-1.5">
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">CM</div>
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">OH</div>
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">QA</div>
                </div>
              </div>
            </div>

            {/* Team Metric Pill Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Work Distribution</div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">Balanced Matrix</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Milestones</div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">100% On Time</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STAGE 3: SALES & MARKETING GROWTH VISUAL ─── */}
        {stage.id === 'sales' && (
          <div className="space-y-3 animate-fadeIn">
            {/* Sales & Marketing Growth Console */}
            <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black text-slate-900 dark:text-white">Q3 Enterprise Growth & Deal Pipeline</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>+44.8% YoY</span>
                </span>
              </div>

              {/* Animated Growth Bars & Deal Funnel */}
              <div className="space-y-2.5">
                {/* Visual Chart Bars */}
                <div className="grid grid-cols-6 gap-2 h-24 items-end pt-4 pb-1 border-b border-slate-100 dark:border-slate-800">
                  {[
                    { month: 'Apr', height: '40%', val: '$18k' },
                    { month: 'May', height: '55%', val: '$24k' },
                    { month: 'Jun', height: '70%', val: '$32k' },
                    { month: 'Jul', height: '80%', val: '$39k' },
                    { month: 'Aug', height: '90%', val: '$48k' },
                    { month: 'Sep', height: '100%', val: '$62k', active: true },
                  ].map((bar) => (
                    <div key={bar.month} className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[8px] font-bold font-mono text-slate-400">{bar.val}</span>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-700 ${
                          bar.active
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                        style={{ height: bar.height }}
                      />
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{bar.month}</span>
                    </div>
                  ))}
                </div>

                {/* Live Inbound & Deal Conversion Ticker */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-left">
                    <div className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Monthly Inbound Leads</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">1,480+ Leads</div>
                  </div>
                  <div className="p-2 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 text-left">
                    <div className="text-[9px] font-bold uppercase text-teal-700 dark:text-teal-400">Enterprise Win Rate</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">68.4% Won</div>
                  </div>
                </div>
              </div>

              {/* Bottom Sales Stream */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <DollarSign className="w-4 h-4" />
                  <span>Pipeline Value: $380,000 Active</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Global Outreach 🚀</span>
              </div>
            </div>

            {/* Growth Metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Marketing ROI</div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">4.8x Return</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Retention</div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">99.2% Client NPS</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Sticky Live Activity Bar */}
      <div className="relative z-10 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span className="font-bold text-slate-700 dark:text-slate-300">WisBees Dynamic Operations Platform</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Auto-Cycle Active</span>
        </div>
      </div>

    </div>
  );
}
