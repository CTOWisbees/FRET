'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function HRDashboard() {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'monthly' | 'weekly'>('monthly');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [greeting, setGreeting] = useState<string>('morning');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }));
      
      const hour = now.getHours();
      if (hour < 12) setGreeting('morning');
      else if (hour < 17) setGreeting('afternoon');
      else setGreeting('evening');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/stats');
      if (res.data?.is_hr === false || res.data?.role === 'employee' || res.data?.redirect === '/employee-dashboard') {
        window.location.href = '/employee-dashboard';
        return;
      }
      setStatsData(res.data);
    } catch (e) {
      console.error('Failed to fetch dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyHiringData = (statsData?.monthly_data || [0,0,0,0,0,0,0,0,0,0,0,0]).map((cnt: number, i: number) => ({
    name: months[i],
    hires: cnt
  }));

  const weeklyHiringData = (statsData?.weekly_data || []).map((cnt: number, i: number) => ({
    name: statsData?.weekly_labels?.[i] || '',
    hires: cnt
  }));

  const hiringChartData = chartMode === 'monthly' ? monthlyHiringData : weeklyHiringData;

  const deptPalette = ['#0E9F6E', '#F59E0B', '#10B981', '#D97706', '#057A55', '#FF8A4C'];
  const deptData = (statsData?.dept_labels || []).map((label: string, idx: number) => ({
    name: label,
    value: statsData?.dept_data?.[idx] || 0,
    color: deptPalette[idx % deptPalette.length]
  })).filter((d: any) => d.value > 0);

  const typeData = [
    { name: 'Interns', value: statsData?.total_interns || 0, color: '#0E9F6E' },
    { name: 'Normal Employees', value: statsData?.total_normal || 0, color: '#F59E0B' }
  ].filter((d) => d.value > 0);

  const recentEmployees = statsData?.recent_employees || [];
  const activeAnnouncements = statsData?.active_announcements || [];

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar user={{ name: 'HR Admin', designation: 'HR Manager' }} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Dashboard" />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {/* Welcome bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.6rem', fontWeight: 800 }}>
                Good {greeting}, {statsData?.hr_name ? statsData.hr_name.split(' ')[0] : 'HR'} 👋
              </div>
              <div style={{ color: 'var(--text3)', fontSize: '0.87rem', marginTop: '3px' }}>
                Here&apos;s what&apos;s happening with your team today.
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text3)', textAlign: 'right' }}>
              <div id="liveClock" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)' }}>
                {currentTime || '--:--:--'}
              </div>
              <div id="liveDate">
                {currentDate || 'Loading date...'}
              </div>
            </div>
          </div>

          {/* Stat Cards Grid - Exactly matching templates/dashboard.html */}
          <div className="stat-grid">
            {/* Card 1: Total Employees */}
            <div className="stat-card">
              <div className="stat-label">Total Employees</div>
              <div className="stat-value text-accent" id="cnt-total">
                {statsData?.total ?? '--'}
              </div>
              <div className="stat-change">
                <i className="fas fa-users" style={{ color: 'var(--accent)' }}></i> All time hires
              </div>
              <div className="stat-icon" style={{ color: 'var(--accent)' }}>
                <i className="fas fa-users"></i>
              </div>
            </div>

            {/* Card 2: Active Employees */}
            <div className="stat-card">
              <div className="stat-label">Active Employees</div>
              <div className="stat-value text-green">
                {statsData?.active ?? '--'}
              </div>
              <div className="stat-change">
                <i className="fas fa-circle" style={{ color: 'var(--green)', fontSize: '0.5rem' }}></i> Currently active
              </div>
              <div className="stat-icon" style={{ color: 'var(--green)' }}>
                <i className="fas fa-user-check"></i>
              </div>
            </div>

            {/* Card 3: New This Month */}
            <div className="stat-card">
              <div className="stat-label">New This Month</div>
              <div className="stat-value" style={{ color: 'var(--yellow)' }}>
                {statsData?.new_this_month ?? '--'}
              </div>
              <div className="stat-change">
                <i className="fas fa-calendar-plus" style={{ color: 'var(--yellow)' }}></i> Added this month
              </div>
              <div className="stat-icon" style={{ color: 'var(--yellow)' }}>
                <i className="fas fa-user-plus"></i>
              </div>
            </div>

            {/* Card 4: Offers Sent */}
            <div className="stat-card">
              <div className="stat-label">Offers Sent</div>
              <div className="stat-value" style={{ color: 'var(--yellow)' }}>
                {statsData?.offers_sent ?? '--'}
              </div>
              <div className="stat-change">
                <i className="fas fa-envelope" style={{ color: 'var(--yellow)' }}></i> Letters generated
              </div>
              <div className="stat-icon" style={{ color: 'var(--yellow)' }}>
                <i className="fas fa-file-contract"></i>
              </div>
            </div>

            {/* Card 5: Total Interns */}
            <div className="stat-card">
              <div className="stat-label">Total Interns</div>
              <div className="stat-value" style={{ color: 'var(--accent2)' }}>
                {statsData?.total_interns ?? '--'}
              </div>
              <div className="stat-change">
                <i className="fas fa-graduation-cap" style={{ color: 'var(--accent2)' }}></i> Active: {statsData?.active_interns ?? 0}
              </div>
              <div className="stat-icon" style={{ color: 'var(--accent2)' }}>
                <i className="fas fa-graduation-cap"></i>
              </div>
            </div>

            {/* Card 6: Normal Employees */}
            <div className="stat-card">
              <div className="stat-label">Normal Employees</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>
                {statsData?.total_normal ?? '--'}
              </div>
              <div className="stat-change">
                <i className="fas fa-briefcase" style={{ color: 'var(--green)' }}></i> Full-time staff
              </div>
              <div className="stat-icon" style={{ color: 'var(--green)' }}>
                <i className="fas fa-briefcase"></i>
              </div>
            </div>
          </div>

          {/* Charts row - Exactly matching templates/dashboard.html */}
          <div className="chart-grid">
            {/* Hiring Trend */}
            <div className="chart-card slide-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className="chart-title">
                  <i className="fas fa-chart-line text-accent"></i> Hiring Trend
                </div>
                <div className="tab-bar" style={{ margin: 0 }}>
                  <button 
                    className={`tab-btn ${chartMode === 'monthly' ? 'active' : ''}`}
                    onClick={() => setChartMode('monthly')}
                  >
                    Monthly
                  </button>
                  <button 
                    className={`tab-btn ${chartMode === 'weekly' ? 'active' : ''}`}
                    onClick={() => setChartMode('weekly')}
                  >
                    Weekly
                  </button>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hiringChartData}>
                    <defs>
                      <linearGradient id="hiringGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0E9F6E" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#0E9F6E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text3)" fontSize={11} />
                    <YAxis stroke="var(--text3)" fontSize={11} domain={[0, 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="hires" 
                      stroke="#0E9F6E" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#hiringGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Departments */}
            <div className="chart-card slide-up">
              <div className="chart-title">
                <i className="fas fa-chart-pie text-accent"></i> Departments
              </div>
              <div className="chart-container">
                {deptData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={deptData} 
                        innerRadius={50} 
                        outerRadius={75} 
                        paddingAngle={3} 
                        dataKey="value"
                      >
                        {deptData.map((entry: any, index: number) => (
                          <Cell key={`dept-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                      />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text3)', fontSize: '0.85rem' }}>
                    No department data yet
                  </div>
                )}
              </div>
            </div>

            {/* Intern vs Employee */}
            <div className="chart-card slide-up">
              <div className="chart-title">
                <i className="fas fa-chart-pie text-accent"></i> Intern vs Employee
              </div>
              <div className="chart-container">
                {typeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={typeData} 
                        innerRadius={50} 
                        outerRadius={75} 
                        paddingAngle={3} 
                        dataKey="value"
                      >
                        {typeData.map((entry, index) => (
                          <Cell key={`type-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                      />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text3)', fontSize: '0.85rem' }}>
                    No employee type data yet
                  </div>
                )}
              </div>
            </div>
          </div>

          <br />

          {/* Bottom row - Exactly matching templates/dashboard.html */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent hires */}
            <div className="card slide-up" style={{ animationDelay: '0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fas fa-clock-rotate-left text-accent"></i> Recent Hires
                </div>
                <Link href="/employees" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                  View all →
                </Link>
              </div>

              {recentEmployees && recentEmployees.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentEmployees.map((emp: any) => (
                    <div 
                      key={emp.id} 
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--bg3)', borderRadius: '10px' }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, color: '#fff' }}>
                        {emp.name ? emp.name[0].toUpperCase() : 'E'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                          {emp.designation || 'Staff'} · {emp.department || 'General'}
                        </div>
                      </div>
                      <span className={`badge-pill ${emp.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                        {emp.status || 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <i className="fas fa-users-slash"></i>
                  <div>No employees yet</div>
                  <Link href="/employees/add" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    Add your first employee →
                  </Link>
                </div>
              )}
            </div>

            {/* Announcements */}
            <div className="card slide-up" style={{ animationDelay: '0.25s' }}>
              <div className="dash-ann-header">
                <div className="dash-ann-heading">
                  <i className="fas fa-bullhorn text-accent"></i>
                  Announcements
                </div>
                <Link href="/announcements" className="dash-ann-view">
                  View All →
                </Link>
              </div>

              {activeAnnouncements && activeAnnouncements.length > 0 ? (
                <div className="dash-ann-list">
                  {activeAnnouncements.map((ann: any) => (
                    <div key={ann.id} className="dash-ann-card">
                      <div className="dash-ann-top">
                        {ann.priority === 'Urgent' ? (
                          <span className="dash-priority dash-priority-urgent">Urgent</span>
                        ) : ann.priority === 'Important' ? (
                          <span className="dash-priority dash-priority-important">Important</span>
                        ) : (
                          <span className="dash-priority dash-priority-normal">Normal</span>
                        )}
                        <span className="dash-audience">{ann.audience || 'Everyone'}</span>
                      </div>
                      <div className="dash-ann-title">{ann.title}</div>
                      <div className="dash-ann-message">
                        {ann.message ? (ann.message.length > 100 ? `${ann.message.slice(0, 100)}...` : ann.message) : ''}
                      </div>
                      <div className="dash-ann-footer">
                        <span>
                          <i className="fas fa-user"></i>
                          {ann.posted_by || 'HR'}
                        </span>
                        <span>
                          <i className="fas fa-clock"></i>
                          {ann.created_at || ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-bullhorn"></i>
                  <h3>No Announcements Yet</h3>
                  <p>Create your first announcement.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
