import React, { useState, useEffect } from 'react';
import { getTrainingAnalytics, getAllDepartments, getCurrentUser } from '../db';
import { Clock, Users, Award, BookOpen, Search, Filter, Download, Calendar, ChevronRight, X, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { formatDurationDisplay } from '../utils/timeUtils';
import { getAllowedDepartmentsForUser } from '../utils/departmentUtils';

const TrainingAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    instructors: [],
    totals: { totalHours: 0, totalSessions: 0, totalInstructors: 0, avgHoursPerInstructor: 0 },
    events: []
  });
  const [departments, setDepartments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
  const [selectedInstructor, setSelectedInstructor] = useState(null); // for session modal

  const loadData = async () => {
    setLoading(true);
    const [u, depts] = await Promise.all([
      getCurrentUser(),
      getAllDepartments()
    ]);

    setCurrentUser(u);
    setDepartments(depts || []);

    const isSysAdmin = u?.multi_roles?.some(r => r.toLowerCase() === 'system administrator');
    const allowed = getAllowedDepartmentsForUser(u, depts || []);
    const allowedNames = allowed.map(d => d.name);

    const data = await getTrainingAnalytics({
      department: selectedDepartment,
      allowedDepartments: !isSysAdmin && allowedNames.length > 0 ? allowedNames : undefined,
      monthYear: selectedMonth || undefined
    });

    setAnalyticsData(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedDepartment, selectedMonth]);

  // Filtered instructors based on search keyword
  const filteredInstructors = analyticsData.instructors.filter(inst => {
    const query = searchKeyword.toLowerCase();
    return (
      !searchKeyword ||
      inst.name?.toLowerCase().includes(query) ||
      inst.staff_id?.toLowerCase().includes(query) ||
      inst.loa_no?.toLowerCase().includes(query)
    );
  });

  // Export CSV
  const handleExportCSV = () => {
    if (filteredInstructors.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = ["Rank", "Instructor Name", "Staff ID", "LOA Number", "Total Sessions", "Total Training Hours"];
    const rows = filteredInstructors.map((inst, index) => [
      index + 1,
      `"${inst.name}"`,
      `"${inst.staff_id || ''}"`,
      `"${inst.loa_no || '-'}"`,
      inst.totalSessions,
      inst.totalHours
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateSuffix = selectedMonth || new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Instructor_Training_Hours_${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maxHours = Math.max(...analyticsData.instructors.map(i => i.totalHours), 1);

  return (
    <div className="animate-fade-in" style={{ width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '0.85rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '14px', color: 'var(--aa-red)', boxShadow: '0 6px 14px rgba(226, 22, 41, 0.1)' }}>
            <Clock size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>Training Hours & Analytics</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Track accumulated training hours and performance for all instructors</p>
          </div>
        </div>

        <button 
          onClick={handleExportCSV}
          className="btn btn-outline" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', borderRadius: '12px' }}
        >
          <Download size={16} />
          Export Report (CSV)
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Training Hours */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Hours</span>
            <div style={{ padding: '0.4rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '8px', color: 'var(--aa-red)' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--aa-white)', lineHeight: 1.1 }}>
            {analyticsData.totals.totalHours} <span style={{ fontSize: '0.9rem', color: 'var(--aa-red)', fontWeight: 600 }}>hrs</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
            {formatDurationDisplay(analyticsData.totals.totalHours)}
          </p>
        </div>

        {/* Total Training Sessions */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sessions</span>
            <div style={{ padding: '0.4rem', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', color: '#60A5FA' }}>
              <BookOpen size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--aa-white)', lineHeight: 1.1 }}>
            {analyticsData.totals.totalSessions} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>events</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
            Conducted across depts
          </p>
        </div>

        {/* Total Instructors */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructors</span>
            <div style={{ padding: '0.4rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: '#34D399' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--aa-white)', lineHeight: 1.1 }}>
            {analyticsData.totals.totalInstructors} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>staff</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
            Active trainers
          </p>
        </div>

        {/* Avg Hours per Instructor */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg / Trainer</span>
            <div style={{ padding: '0.4rem', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '8px', color: '#FBBF24' }}>
              <Award size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--aa-white)', lineHeight: 1.1 }}>
            {analyticsData.totals.avgHoursPerInstructor} <span style={{ fontSize: '0.9rem', color: '#FBBF24', fontWeight: 600 }}>hrs</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
            Average training load
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search */}
        <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.5rem 0.85rem' }}>
          <Search size={16} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search instructor or ID..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
          />
        </div>

        {/* Month Selector & Dept Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-control"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', width: 'auto', minHeight: '38px' }}
            />
            {selectedMonth && (
              <button 
                onClick={() => setSelectedMonth('')}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', minHeight: '38px' }}
                title="Clear Month Filter"
              >
                All Time
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="form-control"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', width: 'auto', minHeight: '38px' }}
            >
              <option value="ALL">All Departments</option>
              {(currentUser?.multi_roles?.some(r => r.toLowerCase() === 'system administrator')
                ? departments
                : getAllowedDepartmentsForUser(currentUser, departments)
              ).map(d => (
                <option key={d.id || d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Instructors Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Instructor Training Hours Summary</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {filteredInstructors.length} Instructors
          </span>
        </div>

        {filteredInstructors.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1.5rem' }}>
            <Clock size={40} />
            <h2>No Training Hours Found</h2>
            <p>No training sessions recorded for the selected criteria or time range.</p>
          </div>
        ) : (
          <div className="table-container">
            <table style={{ minWidth: '680px' }}>
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Instructor</th>
                  <th>Staff ID</th>
                  <th>LOA Number</th>
                  <th style={{ textAlign: 'center' }}>Sessions</th>
                  <th style={{ minWidth: '180px' }}>Total Hours</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstructors.map((inst, index) => {
                  const percentage = Math.round((inst.totalHours / maxHours) * 100);
                  const isTop3 = index < 3;
                  const rankBadge = index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `#${index + 1}`;

                  return (
                    <tr key={inst.staff_id || inst.name}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        <span style={{
                          fontSize: isTop3 ? '0.85rem' : '0.78rem',
                          color: isTop3 ? '#FBBF24' : 'var(--text-secondary)',
                          background: isTop3 ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                          padding: isTop3 ? '0.2rem 0.45rem' : '0',
                          borderRadius: '6px'
                        }}>
                          {rankBadge}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--aa-white)' }}>
                        <span style={{ fontSize: '0.9rem' }}>{inst.name}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {inst.staff_id || '-'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        <span style={{ background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          {inst.loa_no || 'None'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--aa-white)' }}>
                          {inst.totalSessions}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--aa-white)' }}>
                              {inst.totalHours} <span style={{ fontSize: '0.7rem', color: 'var(--aa-red)', fontWeight: 600 }}>HRS</span>
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {formatDurationDisplay(inst.totalHours)}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #E21629 0%, #FF5C5C 100%)', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedInstructor(inst)}
                          className="btn btn-outline"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '34px' }}
                        >
                          <Eye size={14} /> Details ({inst.sessions.length})
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructor Session Details Modal */}
      {selectedInstructor && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', margin: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.6rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '10px', color: 'var(--aa-red)' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{selectedInstructor.name}</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Staff ID: {selectedInstructor.staff_id || '-'} • LOA: {selectedInstructor.loa_no || '-'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInstructor(null)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', padding: '0.35rem', cursor: 'pointer', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Accumulated Hours</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--aa-white)' }}>
                  {selectedInstructor.totalHours} <span style={{ fontSize: '0.8rem', color: 'var(--aa-red)' }}>hours</span>
                </span>
              </div>
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Total Sessions</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--aa-white)' }}>
                  {selectedInstructor.totalSessions} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>sessions</span>
                </span>
              </div>
            </div>

            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Conducted Training Sessions
            </h4>

            <div className="table-container" style={{ borderRadius: '10px', maxHeight: '350px' }}>
              <table style={{ fontSize: '0.85rem', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Date</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Training Subject</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Time Range</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Duration</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Location</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Trainees</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInstructor.sessions.map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {s.date}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--aa-white)' }}>
                        {s.name}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {s.time || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--aa-white)', background: 'rgba(226, 22, 41, 0.15)', padding: '0.2rem 0.45rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                          {s.duration} hrs
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-secondary)' }}>
                        {s.venue} {s.room && `(${s.room})`}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 600 }}>
                        {s.participantsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button onClick={() => setSelectedInstructor(null)} className="btn btn-primary" style={{ padding: '0.55rem 1.25rem', width: '100%' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingAnalytics;
