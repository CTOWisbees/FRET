'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Character, CharacterAction } from './Character';
import { Laptop } from './Laptop';
import { Chair } from './Chair';
import { Team } from './Team';
import { TaskBoard } from './TaskBoard';
import { SalesDashboard } from './SalesDashboard';

export const OperationsAnimation: React.FC = () => {
  const [time, setTime] = useState<number>(0);
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  // Total continuous loop duration: 22.0 seconds
  const CYCLE_DURATION = 22.0;

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (previousTimeRef.current != null) {
        const delta = (timestamp - previousTimeRef.current) / 1000;
        setTime((prev) => (prev + delta) % CYCLE_DURATION);
      }
      previousTimeRef.current = timestamp;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      previousTimeRef.current = null;
    };
  }, []);

  // Floor Base Line
  const GROUND_Y = 480;

  /* 
    ========================================================================
    CALCULATE ACTORS' POSITIONS, ACTIONS & PHYSICAL INTERACTIONS PER PHASE
    ========================================================================
  */

  // --- 1. MAIN CHARACTER STATE ---
  let charX = -120;
  let charY = GROUND_Y;
  let charAction: CharacterAction = 'walk';
  let charFacing: 'left' | 'right' = 'right';
  let charVisible = true;
  let charWalkCycle = (time * 2.8) % 1;
  let charTypingCycle = (time * 4) % 1;
  let charPointProgress = 0;

  // --- 2. LAPTOP & CHAIR STATE ---
  let laptopX = -300;
  let laptopY = GROUND_Y;
  let laptopLidOpen = false;
  let laptopVisible = false;
  let laptopCodeStep = Math.floor(time * 15);
  let chairX = -300;
  let chairY = GROUND_Y;
  let chairVisible = false;

  // --- 3. TASKBOARD STATE ---
  let taskBoardX = 1100;
  let taskBoardY = GROUND_Y;
  let taskBoardVisible = false;
  let taskProgressVal = 92;

  // --- 4. TEAM STATE ---
  let teamX = 1150;
  let teamY = GROUND_Y;
  let teamWalking = false;
  let teamVisible = false;
  let teamFacing: 'left' | 'right' = 'left';
  let teamWalkCycle = (time * 2.5) % 1;

  // --- 5. SALES DASHBOARD STATE ---
  let salesX = 1150;
  let salesY = GROUND_Y;
  let salesVisible = false;
  let salesChartProgress = 0;

  // -----------------------------------------------------------------------
  // TIMELINE LOGIC
  // -----------------------------------------------------------------------

  if (time < 3.0) {
    // PHASE 1: CHARACTER ENTERS (0s - 3.0s)
    // Starts offscreen left (-100) -> walks naturally to center (360) and stops
    const p = Math.min(time / 2.6, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    charX = -100 + ease * 460; // -100 -> 360
    charAction = p < 0.95 ? 'walk' : 'stand';
    charFacing = 'right';
    charVisible = true;
  } else if (time >= 3.0 && time < 7.5) {
    // PHASE 2: LAPTOP + CODING (3.0s - 7.5s)
    // Desk & Chair roll in from left to position (Desk: 430, Chair: 360)
    const enterProg = Math.min((time - 3.0) / 0.8, 1);
    const easeDesk = 1 - Math.pow(1 - enterProg, 2);
    laptopX = -200 + easeDesk * 630; // -200 -> 430
    chairX = -250 + easeDesk * 610;  // -250 -> 360
    laptopVisible = true;
    chairVisible = true;

    // Laptop lid opens after desk is in place (at 3.8s)
    laptopLidOpen = time >= 3.8;

    // Character moves onto chair & starts typing
    charX = 360;
    charFacing = 'right';
    charAction = time >= 3.6 ? 'sit_typing' : 'stand';
    charVisible = true;
  } else if (time >= 7.5 && time < 9.0) {
    // PHASE 3: LAPTOP LEAVES (7.5s - 9.0s)
    // At 7.5s: Character stops typing, laptop lid closes
    laptopLidOpen = false;
    // Character stands up from chair at 7.7s
    charX = 360;
    charAction = 'stand';
    charFacing = 'right';
    charVisible = true;

    // Desk & Chair roll out physically to the left
    const exitProg = Math.min((time - 7.7) / 1.1, 1);
    const easeExit = Math.pow(exitProg, 2);
    laptopX = 430 - easeExit * 750; // 430 -> -320
    chairX = 360 - easeExit * 750;  // 360 -> -390
    laptopVisible = laptopX > -300;
    chairVisible = chairX > -350;
  } else if (time >= 9.0 && time < 14.0) {
    // PHASE 4: TEAM ENTERS & TEAM MANAGEMENT (9.0s - 14.0s)
    // TaskBoard rolls in from right (9.0s - 10.0s)
    const boardProg = Math.min((time - 9.0) / 1.0, 1);
    const easeBoard = 1 - Math.pow(1 - boardProg, 2);
    taskBoardX = 1050 - easeBoard * 570; // 1050 -> 480
    taskBoardVisible = true;

    // Team members physically walk in from right (9.2s - 10.8s)
    const teamEnterProg = Math.min((time - 9.2) / 1.6, 1);
    const easeTeam = 1 - Math.pow(1 - teamEnterProg, 3);
    teamX = 1150 - easeTeam * 500; // 1150 -> 650
    teamWalking = teamEnterProg < 0.98;
    teamVisible = true;
    teamFacing = 'left';

    // Main character manages team and gestures toward board
    charX = 320;
    charFacing = 'right';
    charAction = time >= 10.2 ? 'manage_team' : 'stand';
    charVisible = true;
    taskProgressVal = 92;
  } else if (time >= 14.0 && time < 15.5) {
    // PHASE 5: TEAM LEAVES (14.0s - 15.5s)
    // Team physically walks out to the right
    const teamExitProg = Math.min((time - 14.0) / 1.4, 1);
    const easeTeamExit = Math.pow(teamExitProg, 2);
    teamX = 650 + easeTeamExit * 500; // 650 -> 1150
    teamWalking = true;
    teamVisible = teamX < 1100;
    teamFacing = 'right';

    // TaskBoard rolls out to right
    taskBoardX = 480 + easeTeamExit * 600; // 480 -> 1080
    taskBoardVisible = taskBoardX < 1050;

    // Main character stands and turns
    charX = 320;
    charAction = 'stand';
    charFacing = 'right';
    charVisible = true;
  } else if (time >= 15.5 && time < 19.5) {
    // PHASE 6: SALES ANALYSIS (15.5s - 19.5s)
    // Sales Smartboard rolls in from right (15.5s - 16.5s)
    const salesProg = Math.min((time - 15.5) / 1.0, 1);
    const easeSales = 1 - Math.pow(1 - salesProg, 2);
    salesX = 1100 - easeSales * 650; // 1100 -> 450
    salesVisible = true;

    // Animate Spline curve drawing
    salesChartProgress = Math.min(Math.max((time - 16.3) / 1.8, 0), 1);

    // Main character stands beside board and points across the chart
    charX = 260;
    charFacing = 'right';
    charAction = time >= 16.5 ? 'point_sales' : 'stand';
    charVisible = true;
    // Sweeping pointer progress across chart
    charPointProgress = Math.sin((time - 16.5) * 1.5) * 0.5 + 0.5;
  } else if (time >= 19.5 && time < 21.5) {
    // PHASE 7: EXIT (19.5s - 21.5s)
    // Sales dashboard rolls out to the right
    const exitProg = Math.min((time - 19.5) / 1.2, 1);
    const easeExit = Math.pow(exitProg, 2);
    salesX = 450 + easeExit * 700; // 450 -> 1150
    salesVisible = salesX < 1100;

    // Main character physically walks out of the scene to the right
    const charExitProg = Math.min((time - 19.5) / 1.8, 1);
    charX = 260 + charExitProg * 800; // 260 -> 1060
    charAction = 'walk';
    charFacing = 'right';
    charVisible = charX < 980;
  } else {
    // RESET PAUSE (21.5s - 22.0s): Completely empty panel before loop restarts at 0s
    charVisible = false;
    laptopVisible = false;
    chairVisible = false;
    teamVisible = false;
    taskBoardVisible = false;
    salesVisible = false;
  }

  return (
    <div className="w-full h-full min-h-[580px] sm:min-h-[640px] flex flex-col justify-between bg-gradient-to-b from-slate-50 via-sky-50/20 to-slate-100/90 dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#070B14] relative overflow-hidden select-none transition-colors duration-300">
      
      {/* Background Architectural Grid & Subtle Ambient Brand Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284C708_1px,transparent_1px),linear-gradient(to_bottom,#0284C708_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#38BDF80A_1px,transparent_1px),linear-gradient(to_bottom,#38BDF80A_1px,transparent_1px)] bg-[size:32px_32px] opacity-70" />
        
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-400/10 dark:bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Brand Header Tag */}
      <div className="relative z-20 p-4 sm:p-6 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
          <span className="text-xs font-black text-slate-900 dark:text-white tracking-wide uppercase">
            WisBees Operations Management
          </span>
        </div>
      </div>

      {/* MASTER 2D ANIMATED OPERATIONS STAGE (High-Definition Unified SVG World) */}
      <div className="relative z-10 my-auto w-full h-[460px] sm:h-[500px] flex items-center justify-center">
        <svg
          viewBox="0 0 950 560"
          className="w-full h-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Floor Perspective Gradient */}
            <linearGradient id="officeFloorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0" />
              <stop offset="15%" stopColor="#94A3B8" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="85%" stopColor="#94A3B8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="officeFloorDarkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E293B" stopOpacity="0" />
              <stop offset="15%" stopColor="#334155" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#0284C7" stopOpacity="0.9" />
              <stop offset="85%" stopColor="#334155" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1E293B" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* PHYSICAL OFFICE FLOOR GROUND LINE */}
          <line
            x1="20"
            y1={GROUND_Y}
            x2="930"
            y2={GROUND_Y}
            stroke="url(#officeFloorGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="80"
            y1={GROUND_Y + 1}
            x2="870"
            y2={GROUND_Y + 1}
            stroke="#0284C7"
            strokeWidth="1"
            strokeDasharray="8 6"
            opacity="0.5"
          />

          {/* 1. CHAIR ACTOR */}
          {chairVisible && (
            <Chair x={chairX} y={chairY} scale={1.25} />
          )}

          {/* 2. LAPTOP & WORKSTATION DESK ACTOR */}
          {laptopVisible && (
            <Laptop
              x={laptopX}
              y={laptopY}
              lidOpen={laptopLidOpen}
              codeStep={laptopCodeStep}
              scale={1.25}
            />
          )}

          {/* 3. TASKBOARD ACTOR */}
          {taskBoardVisible && (
            <TaskBoard
              x={taskBoardX}
              y={taskBoardY}
              progressVal={taskProgressVal}
              scale={1.25}
            />
          )}

          {/* 4. TEAM COLLABORATORS ACTOR */}
          {teamVisible && (
            <Team
              x={teamX}
              y={teamY}
              isWalking={teamWalking}
              walkCycle={teamWalkCycle}
              facing={teamFacing}
              scale={1.25}
            />
          )}

          {/* 5. SALES & OPERATIONS DASHBOARD SMARTBOARD ACTOR */}
          {salesVisible && (
            <SalesDashboard
              x={salesX}
              y={salesY}
              chartProgress={salesChartProgress}
              activeKpi="revenue"
              scale={1.2}
            />
          )}

          {/* 6. MAIN 2D CHARACTER ACTOR (ALEX - OPERATIONS LEAD) */}
          {charVisible && (
            <Character
              x={charX}
              y={charY}
              action={charAction}
              walkCycle={charWalkCycle}
              typingCycle={charTypingCycle}
              pointProgress={charPointProgress}
              facing={charFacing}
              scale={1.25}
            />
          )}
        </svg>
      </div>

      {/* Subtle Bottom Ground Ambient Tone */}
      <div className="relative z-20 pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono text-slate-400 dark:text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Continuous Operations Cycle • WisBees Enterprise</span>
        </div>
      </div>

    </div>
  );
};
