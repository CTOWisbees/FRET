'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ArrowLeft, GraduationCap, Briefcase, User, Calendar, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AddEmployeePage() {
  const [empType, setEmpType] = useState<'Intern' | 'Normal'>('Intern');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [designation, setDesignation] = useState('');
  const [designationOther, setDesignationOther] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [duration, setDuration] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState('Active');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const calcInternEnd = (startDate: string, monthsStr: string) => {
    if (!startDate || !monthsStr) return;
    const d = new Date(startDate);
    const months = parseInt(monthsStr);
    d.setMonth(d.getMonth() + months);
    d.setDate(d.getDate() - 1);
    setEndDate(d.toISOString().split('T')[0]);
  };

  const handleJoiningChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setJoiningDate(val);
    if (empType === 'Intern' && duration) {
      calcInternEnd(val, duration);
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDuration(val);
    if (empType === 'Intern' && joiningDate) {
      calcInternEnd(joiningDate, val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('emp_type', empType);
      formData.append('name', name);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('gender', gender);
      formData.append('department', department);
      formData.append('designation', designation === 'other' ? designationOther : designation);
      formData.append('joining_date', joiningDate);
      if (endDate) formData.append('end_date', endDate);
      if (salary) formData.append('salary', salary);
      formData.append('status', status);

      await api.post('/employees/add', formData);
      alert(`${empType === 'Intern' ? 'Intern' : 'Employee'} created successfully!`);
      router.push('/employees');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Add Employee" />

        <main className="p-8 flex-1 overflow-y-auto space-y-6 max-w-5xl">
          {/* Top Title Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                Add New Employee
              </h1>
              <p className="text-[var(--text3)] text-sm mt-1">Fill in the details to create an employee record</p>
            </div>
            <Link
              href="/employees"
              className="px-4 py-2 bg-[var(--surface2)] hover:bg-[var(--hover)] border border-[var(--border)] rounded-xl text-sm font-semibold flex items-center space-x-2 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
          </div>

          {/* Type Selector Pills */}
          <div className="stat-card p-4 rounded-xl flex gap-4">
            <button
              type="button"
              onClick={() => setEmpType('Intern')}
              className={`flex-1 py-3 px-6 rounded-xl font-bold border text-sm flex items-center justify-center space-x-3 transition ${
                empType === 'Intern'
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 shadow-sm'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              <span>Intern</span>
            </button>

            <button
              type="button"
              onClick={() => setEmpType('Normal')}
              className={`flex-1 py-3 px-6 rounded-xl font-bold border text-sm flex items-center justify-center space-x-3 transition ${
                empType === 'Normal'
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 shadow-sm'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              <span>Employee</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Card 1: Personal Info */}
            <div className="stat-card p-6 space-y-4 rounded-xl border border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center">
                <User className="w-4 h-4 mr-2 text-[var(--accent)]" /> Personal Info
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={empType === 'Intern' ? 'Aradhana Dhir' : 'Rahul Sharma'}
                    className="form-control"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@wisbees.com"
                    className="form-control"
                  />
                </div>

                {empType === 'Normal' && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="form-control"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Gender *</label>
                  <select
                    required
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="form-control"
                  >
                    <option value="">Select Gender</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>

                {empType === 'Normal' && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="form-control"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Probation">Probation</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Job Details */}
            <div className="stat-card p-6 space-y-4 rounded-xl border border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-[var(--accent)]" /> Job Details
              </h3>

              {empType === 'Normal' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Department *</label>
                  <select
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="form-control"
                  >
                    <option value="">Select Department</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Customer Success">Customer Success</option>
                    <option value="Legal">Legal</option>
                    <option value="Research">Research</option>
                    <option value="Data & Analytics">Data & Analytics</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Role *</label>
                <select
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="form-control"
                >
                  <option value="">— Select role —</option>
                  <option value="IT Intern - Web & Automation Developer">IT Intern - Web & Automation Developer</option>
                  <option value="Digital Marketing Intern">Digital Marketing Intern</option>
                  <option value="Equity Research Analyst">Equity Research Analyst</option>
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="Senior Lead Engineer">Senior Lead Engineer</option>
                  <option value="Financial Controller">Financial Controller</option>
                  <option value="Marketing Lead">Marketing Lead</option>
                  <option value="other">Other (please specify)</option>
                </select>
              </div>

              {designation === 'other' && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Specify Role</label>
                  <input
                    type="text"
                    value={designationOther}
                    onChange={(e) => setDesignationOther(e.target.value)}
                    placeholder="Enter role name"
                    className="form-control"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Joining / Start Date *</label>
                  <input
                    type="date"
                    required
                    value={joiningDate}
                    onChange={handleJoiningChange}
                    className="form-control"
                  />
                </div>

                {empType === 'Intern' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Duration</label>
                      <select
                        value={duration}
                        onChange={handleDurationChange}
                        className="form-control"
                      >
                        <option value="">— Select —</option>
                        <option value="1">1 month</option>
                        <option value="2">2 months</option>
                        <option value="3">3 months</option>
                        <option value="4">4 months</option>
                        <option value="6">6 months</option>
                        <option value="12">12 months</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text3)] mb-1">End Date (auto)</label>
                      <input
                        type="date"
                        readOnly
                        value={endDate}
                        className="form-control opacity-75 cursor-not-allowed bg-[var(--bg3)]"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Annual CTC (₹)</label>
                    <input
                      type="number"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      placeholder="600000"
                      className="form-control"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <Link
                href="/employees"
                className="px-5 py-2.5 bg-[var(--surface2)] border border-[var(--border)] text-sm font-bold rounded-xl hover:bg-[var(--hover)] transition"
              >
                Back
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white font-bold text-sm rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{empType === 'Intern' ? '+ Add Intern' : '+ Add Employee'}</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
