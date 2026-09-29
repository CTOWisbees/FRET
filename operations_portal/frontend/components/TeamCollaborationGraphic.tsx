'use client';

import React from 'react';
import {
  Users,
  CheckCircle2,
  Sparkles,
  Layers,
  Activity,
  Zap,
  Shield,
  Laptop,
  ArrowUpRight,
  Workflow,
  Clock,
  Terminal
} from 'lucide-react';

export function TeamCollaborationGraphic() {
  return (
    <div className="w-full h-full flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden select-none">
      {/* Background Animated Atmosphere */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-sky-500/15 dark:bg-sky-500/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500/15 dark:bg-purple-500/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Section */}
      <div className="relative z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs backdrop-blur-md">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold tracking-wide text-slate-700 dark:text-slate-300">
            WisBees Collaborative Operations Hub
          </span>
        </div>

        <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Where Teams Sync, Work Flows & <span className="bg-gradient-to-r from-sky-600 to-indigo-600 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">Deliverables Excel</span>.
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
          Real-time role-based operational tracking, live task management, and seamless cross-functional team productivity.
        </p>
      </div>

      {/* Center Interactive Animated Team Visual Graphic */}
      <div className="relative z-10 my-8 py-4 flex items-center justify-center">
        {/* Central Graphic Container */}
        <div className="relative w-full max-w-lg aspect-4/3 flex items-center justify-center">
          {/* Ambient Circular Grid Rings */}
          <div className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full border border-dashed border-sky-400/20 dark:border-sky-500/20 animate-orbit" />
          <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full border border-indigo-400/20 dark:border-indigo-500/20 animate-orbit" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />

          {/* SVG Connecting Flow Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 400" fill="none">
            {/* Top Left Node to Center */}
            <path d="M 120 90 Q 200 120 250 200" stroke="currentColor" className="text-sky-500/40 dark:text-sky-400/50 animate-dash" strokeWidth="2" strokeDasharray="6 6" />
            {/* Top Right Node to Center */}
            <path d="M 380 90 Q 300 120 250 200" stroke="currentColor" className="text-purple-500/40 dark:text-purple-400/50 animate-dash" strokeWidth="2" strokeDasharray="6 6" />
            {/* Bottom Left Node to Center */}
            <path d="M 110 310 Q 180 280 250 200" stroke="currentColor" className="text-emerald-500/40 dark:text-emerald-400/50 animate-dash" strokeWidth="2" strokeDasharray="6 6" />
            {/* Bottom Right Node to Center */}
            <path d="M 390 310 Q 320 280 250 200" stroke="currentColor" className="text-amber-500/40 dark:text-amber-400/50 animate-dash" strokeWidth="2" strokeDasharray="6 6" />
          </svg>

          {/* Central Hub: Operations Lead / Active Workspace */}
          <div className="relative z-20 flex flex-col items-center">
            {/* Pulsing Aura */}
            <div className="absolute -inset-4 bg-gradient-to-r from-sky-500/30 to-indigo-600/30 rounded-full blur-xl animate-pulse" />

            {/* Core Device / Team Leader Avatar */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-700 p-1 shadow-2xl animate-float-slow">
              <div className="w-full h-full rounded-[22px] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white relative overflow-hidden">
                {/* Tech scanline effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sky-400/10 to-transparent animate-pulse" />
                
                <div className="w-10 h-10 rounded-2xl bg-sky-400/20 border border-sky-400/40 flex items-center justify-center text-sky-300 mb-1">
                  <Laptop className="w-5 h-5 animate-pulse" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-300">Operations Hub</span>
                <span className="text-[8px] text-slate-400 font-mono">Live Sync • 100%</span>
              </div>
            </div>

            {/* Floating Live Badge below center */}
            <div className="mt-3 px-3 py-1 rounded-full bg-white/90 dark:bg-slate-800/90 border border-sky-200 dark:border-sky-800/60 shadow-lg text-[10px] font-extrabold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-sky-500" />
              <span>Team Workspace Active</span>
            </div>
          </div>

          {/* Team Member Node 1: Top-Left (Developer / Intern) */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 animate-float-slow" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur-md">
              <div className="relative">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center font-black text-xs shadow-md">
                  CM
                </div>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"></span>
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                  <span>Chhayakanta</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono">Dev</span>
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-sky-500" />
                  <span>Pushing updates...</span>
                </div>
              </div>
            </div>
          </div>

          {/* Team Member Node 2: Top-Right (Operations Head / Admin) */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 animate-float-reverse" style={{ animationDelay: '1s' }}>
            <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur-md">
              <div className="relative">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"></span>
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                  <span>Ops Admin</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono">Admin</span>
                </div>
                <div className="text-[10px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-purple-500" />
                  <span>Tasks Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Team Member Node 3: Bottom-Left (Quality / Deliverable) */}
          <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 animate-float-reverse" style={{ animationDelay: '1.5s' }}>
            <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur-md">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xs shadow-md">
                <Workflow className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-slate-900 dark:text-white">
                  Sprint Workflow
                </div>
                <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  <span>100% on schedule</span>
                </div>
              </div>
            </div>
          </div>

          {/* Team Member Node 4: Bottom-Right (Analytics / Role Scope) */}
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 animate-float-slow" style={{ animationDelay: '2s' }}>
            <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur-md">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-xs shadow-md">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-slate-900 dark:text-white">
                  Role Matrix
                </div>
                <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>Scoped & Assigned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Stats & Live Activity Metrics */}
      <div className="relative z-10 grid grid-cols-3 gap-3">
        <div className="p-3 sm:p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-md backdrop-blur-md transition">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-500" />
            <span>Turnaround</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            2.4 hrs <span className="text-[10px] font-bold text-emerald-500">avg</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-md backdrop-blur-md transition">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-500" />
            <span>SLA Health</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            99.8% <span className="text-[10px] font-bold text-sky-500">stable</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-md backdrop-blur-md transition">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Users className="w-3 h-3 text-emerald-500" />
            <span>Team Synergy</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            Active <span className="text-[10px] font-bold text-emerald-500">● Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
