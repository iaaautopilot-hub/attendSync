import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, clearEvent, getCurrentUser, getAllDepartments, updateEventInfo, getUsersByRole } from '../db';
import { 
  Calendar, Trash2, ChevronRight, Target, Filter, Search, Edit, X, Users, Eye, Clock, Plus, Lock,
  Activity, CalendarDays, RefreshCw, Layers, ShieldCheck, CheckCircle2, AlertCircle, Info, Tag, RotateCcw
} from 'lucide-react';
import { parseEventTime, calculateDurationHours, formatDurationDisplay, getActivationLockStatus } from '../utils/timeUtils';
import { canAdminAccessDepartment, getAllowedDepartmentsForUser, canUserViewOrEditEvent, isFlightOperationIntegrated } from '../utils/departmentUtils';
import { formatEventRecordNumber } from '../utils/recordUtils';
import { getSystemLogs, clearSystemLogs, logSystemEvent } from '../utils/systemLogger';

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [deptCodeMap, setDeptCodeMap] = useState({});
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [datePreset, setDatePreset] = useState('ALL'); // 'ALL' | 'TODAY' | 'UPCOMING' | 'PAST'
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [availableLeaders, setAvailableLeaders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  // System Logs Modal States
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [logsFilter, setLogsFilter] = useState('ALL');
  const [logsSearch, setLogsSearch] = useState('');

  const loadEvents = async () => {
    const u = await getCurrentUser();
    setUser(u);
    
    const [allEvents, depts] = await Promise.all([
      getAllEvents(),
      getAllDepartments()
    ]);

    const codeMap = {};
    depts.forEach(d => {
      codeMap[d.name] = d.code;
    });
    setDeptCodeMap(codeMap);
    setDepartments(depts || []);
    
    if (u?.multi_roles?.some(r => r.toLowerCase() === 'system administrator')) {
      // System Administrator sees all events
      setEvents([...allEvents]); 
    } else if (u?.multi_roles?.some(r => r.toLowerCase() === 'admin')) {
      // Admin sees events from their specific department and integrated department
      const deptRole = u.multi_roles.find(r => r.startsWith('dept:'));
      if (deptRole) {
        const adminDept = deptRole.split(':')[1];
        setEvents(allEvents.filter(e => canAdminAccessDepartment(adminDept, e.department)));
      } else {
        setEvents([]);
      }
    } else {
      // Chairmen/Instructors only see events where they are assigned leaders
      const myEvents = allEvents.filter(e => e.leaders && (e.leaders.includes(u.full_name) || e.leaders.includes(u.name)));
      setEvents(myEvents);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, selectedDepartment, selectedType, selectedDate, datePreset]);

  const openLogsModal = () => {
    setSystemLogs(getSystemLogs());
    setShowLogsModal(true);
  };

  const handleClearLogs = () => {
    if (window.confirm("Clear local system logs?")) {
      clearSystemLogs();
      setSystemLogs([]);
    }
  };

  const handleRefreshLogs = () => {
    setSystemLogs(getSystemLogs());
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to permanently delete this event? This will also remove all its attendance records.")) {
      await clearEvent(id);
      loadEvents();
    }
  };

  const openEditModal = async (e, event) => {
    e.preventDefault();
    e.stopPropagation();
    const requiredRole = event.type === 'Training' ? 'Instructor' : 'Chairman';
    const users = await getUsersByRole(requiredRole);
    setAvailableLeaders(users);
    
    const parsedTime = parseEventTime(event.time);

    setEditingEvent(event);
    setEditFormData({
      name: event.name,
      date: event.date,
      time: event.time || '',
      startTime: parsedTime.startTime || '09:00',
      endTime: parsedTime.endTime || '17:00',
      type: event.type,
      trainingType: event.training_type || event.trainingType || 'Initial',
      venue: event.venue,
      room: event.room,
      department: event.department,
      leaders: event.leaders?.length > 0 ? [...event.leaders] : ['']
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const actualLeaders = editFormData.leaders.filter(l => l.trim() !== '');
    
    const eventTime = editFormData.type === 'Training'
      ? `${editFormData.startTime} - ${editFormData.endTime}`
      : editFormData.time;

    await updateEventInfo(editingEvent.id, {
      ...editFormData,
      time: eventTime,
      leaders: actualLeaders
    });
    setEditingEvent(null);
    await loadEvents();
  };

  const handleLeaderChange = (index, value) => {
    const newLeaders = [...editFormData.leaders];
    newLeaders[index] = value;
    setEditFormData({ ...editFormData, leaders: newLeaders });
  };

  const addLeader = () => {
    if (editFormData.leaders.length < 3) {
      setEditFormData({ ...editFormData, leaders: [...editFormData.leaders, ''] });
    }
  };

  const removeLeader = (index) => {
    if (editFormData.leaders.length > 1) {
      const newLeaders = editFormData.leaders.filter((_, i) => i !== index);
      setEditFormData({ ...editFormData, leaders: newLeaders });
    }
  };

  const isSysAdmin = user?.multi_roles?.some(r => r.toLowerCase() === 'system administrator');
  const userAllowedDepts = getAllowedDepartmentsForUser(user, departments);
  const availableDepartments = Array.from(new Set([
    ...(isSysAdmin ? departments.map(d => d.name) : userAllowedDepts.map(d => d.name)),
    ...events.map(e => e.department).filter(Boolean)
  ])).sort();

  const availableEventTypes = Array.from(new Set(events.map(e => e.type || e.event_type).filter(Boolean))).sort();
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredEvents = events.filter(e => {
    // 1. Department filter
    const matchDept = selectedDepartment === 'ALL' || e.department === selectedDepartment;
    
    // 2. Keyword search
    const query = searchKeyword.toLowerCase().trim();
    const matchSearch = !query || 
      e.name?.toLowerCase().includes(query) ||
      (e.event_code && e.event_code.toLowerCase().includes(query)) ||
      (e.leaders && e.leaders.some(l => l.toLowerCase().includes(query))) ||
      (e.venue && e.venue.toLowerCase().includes(query)) ||
      (e.room && e.room.toLowerCase().includes(query));

    // 3. Event Type filter
    const eventType = (e.type || e.event_type || '');
    const matchType = selectedType === 'ALL' || eventType.toLowerCase() === selectedType.toLowerCase();

    // 4. Event Date filter
    const eventDateStr = e.date || e.event_date || '';
    let matchDate = true;
    if (selectedDate) {
      matchDate = eventDateStr === selectedDate;
    } else if (datePreset === 'TODAY') {
      matchDate = eventDateStr === todayStr;
    } else if (datePreset === 'UPCOMING') {
      matchDate = eventDateStr >= todayStr;
    } else if (datePreset === 'PAST') {
      matchDate = eventDateStr < todayStr;
    }

    return matchDept && matchSearch && matchType && matchDate;
  });

  const handleResetFilters = () => {
    setSelectedDepartment('ALL');
    setSelectedType('ALL');
    setSelectedDate('');
    setDatePreset('ALL');
    setSearchKeyword('');
    setCurrentPage(1);
  };

  const isFilterActive = selectedDepartment !== 'ALL' || selectedType !== 'ALL' || selectedDate !== '' || datePreset !== 'ALL' || searchKeyword.trim() !== '';

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-fade-in" style={{ width: '100%', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '0.85rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '14px', color: 'var(--aa-red)', boxShadow: '0 6px 14px rgba(226, 22, 41, 0.1)' }}>
            <img src="/icon.png" alt="Logo" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>
              {user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) ? 'System Events' : 'My Assigned Events'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Manage and view attendance records for your flights and training</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) && (
            <button 
              onClick={openLogsModal}
              className="btn btn-outline" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.1rem', borderRadius: '12px', fontSize: '0.85rem' }}
              title="View zero-egress system logs & audit diagnostics"
            >
              <Activity size={17} style={{ color: 'var(--aa-red)' }} />
              System Logs
            </button>
          )}
          {user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) && (
            <Link to="/" className="btn btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
              <Plus size={18} /> New Event
            </Link>
          )}
        </div>
      </div>

      {/* Unified Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.02)' }}>
        {/* Top Filter Controls: Search & Date Picker */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {/* Keyword Search */}
          <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.55rem 0.85rem' }}>
            <Search size={16} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search event name, code, venue, leader..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
            />
            {searchKeyword && (
              <button 
                onClick={() => setSearchKeyword('')} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Specific Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.45rem 0.75rem' }}>
            <Calendar size={16} style={{ color: 'var(--aa-red)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setDatePreset('ALL');
              }}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', colorScheme: 'dark', cursor: 'pointer' }}
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
                title="Clear date filter"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Reset Filters Button */}
          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', fontSize: '0.8rem', borderRadius: '10px', color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
              title="Reset all active filters"
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          )}
        </div>

        {/* Filter Chips Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 1. Event Type Filter */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem' }}>
              <Layers size={14} style={{ color: 'var(--aa-red)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Event Type
              </span>
            </div>
            <div className="filter-chips-container" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedType('ALL')}
                className={`btn filter-chip ${selectedType === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.78rem',
                  minHeight: '32px',
                  borderRadius: '50px',
                  background: selectedType === 'ALL' ? 'var(--aa-red)' : 'transparent',
                  borderColor: selectedType === 'ALL' ? 'var(--aa-red)' : 'var(--border-color)',
                  color: selectedType === 'ALL' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                All Types ({events.length})
              </button>
              {availableEventTypes.map(t => {
                const count = events.filter(e => (e.type || e.event_type) === t).length;
                const isSelected = selectedType === t;
                const badgeColor = t === 'Meeting' ? '#60A5FA' : '#C084FC';
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`btn filter-chip ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.78rem',
                      minHeight: '32px',
                      borderRadius: '50px',
                      background: isSelected ? 'var(--aa-red)' : 'transparent',
                      borderColor: isSelected ? 'var(--aa-red)' : 'var(--border-color)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: isSelected ? '#fff' : badgeColor, marginRight: '0.35rem' }} />
                    {t} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Event Date Presets */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem' }}>
              <CalendarDays size={14} style={{ color: 'var(--aa-red)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Event Date
              </span>
            </div>
            <div className="filter-chips-container" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Dates', count: events.length },
                { id: 'TODAY', label: 'Today', count: events.filter(e => (e.date || e.event_date) === todayStr).length },
                { id: 'UPCOMING', label: 'Upcoming', count: events.filter(e => (e.date || e.event_date) >= todayStr).length },
                { id: 'PAST', label: 'Past', count: events.filter(e => (e.date || e.event_date) < todayStr).length }
              ].map(preset => {
                const isSelected = !selectedDate && datePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setDatePreset(preset.id);
                      setSelectedDate('');
                    }}
                    className={`btn filter-chip ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.78rem',
                      minHeight: '32px',
                      borderRadius: '50px',
                      background: isSelected ? 'var(--aa-red)' : 'transparent',
                      borderColor: isSelected ? 'var(--aa-red)' : 'var(--border-color)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    {preset.label} ({preset.count})
                  </button>
                );
              })}
              {selectedDate && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(226, 22, 41, 0.2)', border: '1px solid var(--aa-red)', borderRadius: '50px', padding: '0.2rem 0.75rem', fontSize: '0.78rem', color: '#fff' }}>
                  <span>Custom: {selectedDate}</span>
                  <button onClick={() => setSelectedDate('')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 3. Department Filter Chips */}
          {availableDepartments.length > 0 && events.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem' }}>
                <Filter size={14} style={{ color: 'var(--aa-red)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Department
                </span>
              </div>
              <div className="filter-chips-container" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedDepartment('ALL')}
                  className={`btn filter-chip ${selectedDepartment === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.78rem',
                    minHeight: '32px',
                    borderRadius: '50px',
                    background: selectedDepartment === 'ALL' ? 'var(--aa-red)' : 'transparent',
                    borderColor: selectedDepartment === 'ALL' ? 'var(--aa-red)' : 'var(--border-color)',
                    color: selectedDepartment === 'ALL' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  All ({events.length})
                </button>
                {availableDepartments.map(deptName => {
                  const count = events.filter(e => e.department === deptName).length;
                  const isSelected = selectedDepartment === deptName;
                  return (
                    <button
                      key={deptName}
                      onClick={() => setSelectedDepartment(deptName)}
                      className={`btn filter-chip ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.78rem',
                        minHeight: '32px',
                        borderRadius: '50px',
                        background: isSelected ? 'var(--aa-red)' : 'transparent',
                        borderColor: isSelected ? 'var(--aa-red)' : 'var(--border-color)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      {deptName} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Filter Status Strip */}
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Showing <strong style={{ color: 'var(--aa-white)' }}>{filteredEvents.length}</strong> of {events.length} events</span>
            {isFilterActive && (
              <span style={{ fontSize: '0.75rem', color: 'var(--aa-red)', background: 'rgba(226, 22, 41, 0.1)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                Filtered
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Events Table / Empty State */}
      {filteredEvents.length === 0 ? (
        <div className="empty-state">
          <img src="/icon.png" alt="Logo" style={{ width: '44px', height: '44px', objectFit: 'contain', marginBottom: '1rem', opacity: 0.6 }} />
          <h2>No Events Found</h2>
          {isFilterActive ? (
            <>
              <p>No events match your current filter selection.</p>
              <button
                onClick={handleResetFilters}
                className="btn btn-outline"
                style={{ marginTop: '1rem', padding: '0.5rem 1.25rem' }}
              >
                Clear All Filters
              </button>
            </>
          ) : (
            <p>You do not have any active or past events assigned to you.</p>
          )}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table style={{ minWidth: '680px' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Event ID</th>
                  <th>Name</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Date & Time</th>
                  <th>Location</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Department</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.map(event => (
                  <tr key={event.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '6px', color: 'var(--aa-red)', border: '1px solid rgba(226, 22, 41, 0.2)', letterSpacing: '0.04em', display: 'inline-block' }}>
                        {formatEventRecordNumber(event, deptCodeMap)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${event.type === 'Meeting' ? 'badge-blue' : 'badge-purple'}`} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', flexShrink: 0 }}>
                          {event.type}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--aa-white)', wordBreak: 'break-word' }}>
                          {event.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      <div>{event.date} {event.time && `• ${event.time}`}</div>
                      {(() => {
                        if (!event.isActive && !event.isExpired && event.type === 'Training') {
                          const lock = getActivationLockStatus(event);
                          if (lock.isLocked) {
                            return (
                              <div style={{ marginTop: '0.35rem' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  fontSize: '0.68rem',
                                  color: '#EAB308',
                                  background: 'rgba(234, 179, 8, 0.12)',
                                  border: '1px solid rgba(234, 179, 8, 0.25)',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '6px',
                                  fontWeight: '600'
                                }}>
                                  <Lock size={10} /> Locked until -30m ({lock.timeRemainingStr})
                                </span>
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      📍 {event.venue} {event.room && `(${event.room})`}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ background: 'rgba(255,255,255,0.04)', padding: '0.25rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {event.department}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Link 
                          to={`/dashboard/${event.id}`} 
                          className="btn btn-outline"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: '34px' }}
                        >
                          <Eye size={14} /> View
                        </Link>
                        {user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) && (
                          <button 
                            onClick={(e) => openEditModal(e, event)} 
                            className="btn btn-outline" 
                            style={{ padding: '0.35rem 0.5rem', color: 'var(--text-secondary)', border: 'none', minHeight: '34px' }}
                            title="Edit Event"
                          >
                            <Edit size={15} />
                          </button>
                        )}
                        {user?.multi_roles?.some(r => r.toLowerCase() === 'system administrator') && (
                          <button 
                            onClick={(e) => handleDelete(event.id, e)} 
                            className="btn btn-outline" 
                            style={{ padding: '0.35rem 0.5rem', color: '#F87171', border: 'none', minHeight: '34px' }}
                            title="Delete Event"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              >
                Previous
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className="btn btn-outline" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', margin: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.35rem', margin: 0 }}>Edit Event</h2>
              <button 
                onClick={() => setEditingEvent(null)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', padding: '0.35rem', cursor: 'pointer', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="grid grid-cols-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Event Name</label>
                <input required type="text" className="form-control" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Event Type</label>
                <select className="form-control" value={editFormData.type} onChange={(e) => setEditFormData({...editFormData, type: e.target.value})} disabled>
                  <option value="Meeting">Meeting</option>
                  <option value="Training">Training</option>
                </select>
              </div>

              <div className="form-group">
                <label>Department</label>
                <select 
                  className="form-control" 
                  value={editFormData.department} 
                  onChange={(e) => setEditFormData({...editFormData, department: e.target.value})}
                  disabled={!isSysAdmin && getAllowedDepartmentsForUser(user, departments).length <= 1}
                  style={{ backgroundColor: (!isSysAdmin && getAllowedDepartmentsForUser(user, departments).length <= 1) ? 'rgba(255,255,255,0.05)' : '' }}
                >
                  {Array.from(new Set([
                    editFormData.department,
                    ...(isSysAdmin ? departments.map(d => d.name) : getAllowedDepartmentsForUser(user, departments).map(d => d.name))
                  ])).filter(Boolean).map(deptName => (
                    <option key={deptName} value={deptName}>{deptName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Event Date</label>
                <input required type="date" className="form-control" value={editFormData.date} onChange={(e) => setEditFormData({...editFormData, date: e.target.value})} />
              </div>

              {editFormData.type === 'Training' ? (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>Training Type</label>
                    <select 
                      className="form-control" 
                      value={editFormData.trainingType || 'Initial'} 
                      onChange={(e) => setEditFormData({...editFormData, trainingType: e.target.value})}
                    >
                      <option value="Initial">Initial</option>
                      <option value="Recurrent">Recurrent</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <label style={{ margin: 0 }}>Training Session Hours</label>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aa-white)', background: 'rgba(226, 22, 41, 0.2)', border: '1px solid rgba(226, 22, 41, 0.4)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                      ⏱️ Duration: {formatDurationDisplay(calculateDurationHours(editFormData.startTime, editFormData.endTime))}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Start Time</span>
                      <input 
                        required 
                        type="time" 
                        className="form-control" 
                        value={editFormData.startTime} 
                        onChange={(e) => setEditFormData({...editFormData, startTime: e.target.value})} 
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>End Time</span>
                      <input 
                        required 
                        type="time" 
                        className="form-control" 
                        value={editFormData.endTime} 
                        onChange={(e) => setEditFormData({...editFormData, endTime: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Event Time</label>
                  <input required type="time" className="form-control" value={editFormData.time} onChange={(e) => setEditFormData({...editFormData, time: e.target.value})} />
                </div>
              )}

              <div className="form-group">
                <label>Venue</label>
                <input required type="text" className="form-control" value={editFormData.venue} onChange={(e) => setEditFormData({...editFormData, venue: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Room Name</label>
                <input required type="text" className="form-control" value={editFormData.room} onChange={(e) => setEditFormData({...editFormData, room: e.target.value})} />
              </div>

              <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} style={{ color: 'var(--aa-red)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Assign {editFormData.type === 'Training' ? 'Instructor' : 'Chairman'}</h3>
                  </div>
                  {editFormData.leaders.length < 3 && (
                    <button type="button" onClick={addLeader} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '32px' }}>
                      + Add
                    </button>
                  )}
                </div>

                {editFormData.leaders.map((leader, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.75rem', marginBottom: index !== editFormData.leaders.length - 1 ? '0.75rem' : '0' }}>
                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                      <select
                        required
                        className="form-control"
                        value={leader}
                        onChange={(e) => handleLeaderChange(index, e.target.value)}
                      >
                        <option value="" disabled>Select Leader</option>
                        {availableLeaders.map((u) => (
                          <option key={u.staff_id || u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {editFormData.leaders.length > 1 && (
                      <button type="button" onClick={() => removeLeader(index)} className="btn btn-outline" style={{ color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.3)', padding: '0.5rem' }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, minWidth: '140px' }}>
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingEvent(null)} className="btn btn-outline" style={{ flex: 1, minWidth: '140px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Logs & Audit Modal */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(false)}>
          <div 
            className="modal-content glass-card animate-scale-up" 
            style={{ maxWidth: '840px', width: '94%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '1.75rem' }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.65rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '12px', color: 'var(--aa-red)' }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--aa-white)' }}>AttendSync System Logs</h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Diagnostics & audit trail (Zero-egress in-memory circular buffer • Supabase quota safe)
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={handleRefreshLogs} 
                  className="btn btn-outline" 
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem', minHeight: '32px' }}
                  title="Refresh logs"
                >
                  <RefreshCw size={13} /> Refresh
                </button>
                <button 
                  onClick={handleClearLogs} 
                  className="btn btn-outline" 
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem', minHeight: '32px', color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                  title="Clear local logs"
                >
                  <Trash2 size={13} /> Clear
                </button>
                <button 
                  onClick={() => setShowLogsModal(false)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Filter & Search within logs */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.45rem 0.75rem' }}>
                <Search size={15} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Filter logs by action or details..."
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
                {logsSearch && (
                  <button onClick={() => setLogsSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {['ALL', 'AUDIT', 'WARN', 'ERROR', 'INFO'].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setLogsFilter(lvl)}
                    className="btn"
                    style={{
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      background: logsFilter === lvl ? (lvl === 'ERROR' ? '#EF4444' : lvl === 'WARN' ? '#F59E0B' : lvl === 'AUDIT' ? '#8B5CF6' : 'var(--aa-red)') : 'rgba(255,255,255,0.05)',
                      color: logsFilter === lvl ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid',
                      borderColor: logsFilter === lvl ? 'transparent' : 'var(--border-color)',
                      minHeight: '32px'
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Logs List Table */}
            <div style={{ flex: 1, overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.25)', minHeight: '220px' }}>
              {(() => {
                const filteredLogs = systemLogs.filter(log => {
                  const matchLvl = logsFilter === 'ALL' || log.level === logsFilter;
                  const query = logsSearch.toLowerCase().trim();
                  const matchQ = !query || 
                    log.action?.toLowerCase().includes(query) || 
                    log.details?.toLowerCase().includes(query) || 
                    log.user?.toLowerCase().includes(query);
                  return matchLvl && matchQ;
                });

                if (filteredLogs.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                      <Activity size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>No system logs match the current filter criteria.</p>
                    </div>
                  );
                }

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap' }}>Timestamp</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Level</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Action</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Details</th>
                        <th style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap' }}>Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const levelColors = {
                          INFO: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
                          WARN: { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },
                          ERROR: { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.3)' },
                          AUDIT: { bg: 'rgba(139, 92, 246, 0.15)', text: '#A78BFA', border: 'rgba(139, 92, 246, 0.3)' }
                        };
                        const c = levelColors[log.level] || levelColors.INFO;
                        const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : '-';

                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                              {timeStr}
                            </td>
                            <td style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap' }}>
                              <span style={{ 
                                padding: '0.15rem 0.45rem', 
                                borderRadius: '4px', 
                                fontSize: '0.68rem', 
                                fontWeight: 700, 
                                background: c.bg, 
                                color: c.text, 
                                border: `1px solid ${c.border}` 
                              }}>
                                {log.level}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: 'var(--aa-white)', whiteSpace: 'nowrap' }}>
                              {log.action}
                            </td>
                            <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-primary)', wordBreak: 'break-word', maxWidth: '340px' }}>
                              {log.details}
                            </td>
                            <td style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                              {log.user}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Showing {systemLogs.length} events (Circular buffer: Max 100)
              </span>
              <button onClick={() => setShowLogsModal(false)} className="btn btn-outline" style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventList;
