'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ArrowLeft, User, Briefcase, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function EditEmployeePage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('female');
  const [status, setStatus] = useState('Active');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [salary, setSalary] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [empType, setEmpType] = useState('Normal');

  useEffect(() => {
    if (!id) return;
    const loadEmployee = async () => {
      try {
        let emp = null;
        try {
          const singleRes = await api.get(`/api/employee/${id}`);
          if (singleRes.data && singleRes.data.id) {
            emp = singleRes.data;
          }
        } catch (_) {
          // fallback to employees list
        }

        if (!emp) {
          const res = await api.get(`/api/employees-list`);
          emp = res.data?.find((e: any) => e.id.toString() === id.toString());
        }

        if (emp) {
          setEmpId(emp.emp_id || '');
          setName(emp.name || '');
          setEmail(emp.email || '');
          setPhone(emp.phone || '');
          setGender(emp.gender ? String(emp.gender).toLowerCase() : 'female');
          setStatus(emp.status || 'Active');
          setDepartment(emp.department || 'Engineering');
          setDesignation(emp.designation || '');
          setSalary(emp.salary !== undefined && emp.salary !== null ? String(emp.salary) : '');
          setJoiningDate(emp.joining_date || '');
          setEndDate(emp.end_date || '');
          setEmpType(emp.emp_type || 'Normal');
        }
      } catch (err) {
        console.error('Error loading employee:', err);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${id}/edit`, {
        name,
        email,
        phone,
        gender: gender.toLowerCase(),
        status,
        department,
        designation,
        salary,
        joining_date: joiningDate,
        end_date: endDate,
        emp_type: empType,
      });
      alert('Employee details updated successfully!');
      router.push('/employees');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update employee details');
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Edit Employee" onMenuClick={() => setMobileOpen(true)} />

        <main className="p-8 flex-1 overflow-y-auto space-y-6 max-w-5xl">
          {/* Top Title Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                Edit Employee
              </h1>
              <p className="text-[var(--text3)] text-sm mt-0.5">
                {empId} · {name}
              </p>
            </div>
            <Link
              href="/employees"
              className="px-4 py-2 bg-[var(--surface2)] hover:bg-[var(--hover)] border border-[var(--border)] rounded-xl text-sm font-semibold flex items-center space-x-2 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="stat-card p-6 space-y-4 rounded-xl border border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center">
                <User className="w-4 h-4 mr-2 text-[var(--accent)]" /> Personal Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-control text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-control text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="form-control text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="form-control text-sm"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Employee Type</label>
                  <select
                    value={empType}
                    onChange={(e) => setEmpType(e.target.value)}
                    className="form-control text-sm"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="form-control text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Probation">Probation</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="stat-card p-6 space-y-4 rounded-xl border border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-[var(--accent)]" /> Job Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="form-control text-sm"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Data & Analytics">Data & Analytics</option>
                    <option value="Research">Research</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Finance">Finance</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="form-control text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Annual CTC (₹)</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="600000"
                    className="form-control text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="form-control text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="form-control text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <Link
                href="/employees"
                className="px-5 py-2.5 bg-[var(--surface2)] border border-[var(--border)] text-sm font-bold rounded-xl hover:bg-[var(--hover)] transition"
              >
                Back
              </Link>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white font-bold text-sm rounded-xl shadow-md transition flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

