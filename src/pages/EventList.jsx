import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, clearEvent, getCurrentUser, getAllDepartments, updateEventInfo, getUsersByRole } from '../db';
import { Calendar, Trash2, ChevronRight, Target, Filter, Search, Edit, X, Users, Eye, Clock, Plus, Lock } from 'lucide-react';
import { parseEventTime, calculateDurationHours, formatDurationDisplay, getActivationLockStatus } from '../utils/timeUtils';
import { canAdminAccessDepartment, getAllowedDepartmentsForUser, canUserViewOrEditEvent, isFlightOperationIntegrated } from '../utils/departmentUtils';

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [deptCodeMap, setDeptCodeMap] = useState({});
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [availableLeaders, setAvailableLeaders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

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
  }, [searchKeyword, selectedDepartment]);

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

  const filteredEvents = events.filter(e => {
    const matchDept = selectedDepartment === 'ALL' || e.department === selectedDepartment;
    const matchSearch = !searchKeyword || e.name?.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchDept && matchSearch;
  });

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
        {user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) && (
          <Link to="/" className="btn btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
            <Plus size={18} /> New Event
          </Link>
        )}
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1.25rem', background: 'rgba(255, 255, 255, 0.02)' }}>
          <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.75rem', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search event name..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.95rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* Department Filter Chips */}
      {availableDepartments.length > 0 && events.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} style={{ color: 'var(--aa-red)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--aa-white)' }}>Department Filter</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Showing {filteredEvents.length} of {events.length} events
            </span>
          </div>

          <div className="filter-chips-container">
            <button
              onClick={() => setSelectedDepartment('ALL')}
              className={`btn filter-chip ${selectedDepartment === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.8rem',
                minHeight: '36px',
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
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.8rem',
                    minHeight: '36px',
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

      {/* Events Table / Empty State */}
      {filteredEvents.length === 0 ? (
        <div className="empty-state">
          <img src="/icon.png" alt="Logo" style={{ width: '44px', height: '44px', objectFit: 'contain', marginBottom: '1rem', opacity: 0.6 }} />
          <h2>No Events Found</h2>
          {selectedDepartment !== 'ALL' ? (
            <>
              <p>No events found for department <strong>{selectedDepartment}</strong>.</p>
              <button
                onClick={() => setSelectedDepartment('ALL')}
                className="btn btn-outline"
                style={{ marginTop: '1rem', padding: '0.5rem 1.25rem' }}
              >
                Show All Departments
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
                        { (() => {
                          const dept = (event.department || 'Flight Operation');
                          let dCode = deptCodeMap[dept];
                          if (!dCode) {
                            if (dept === 'Flight Operation' || dept === 'FOP') dCode = 'FOP';
                            else if (isFlightOperationIntegrated(dept)) dCode = 'FOPI';
                            else dCode = dept.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 4);
                          }
                          const nId = (event.event_code || '0').replace(/\D/g, '').padStart(5, '0');
                          return `IAA/${dCode}/${event.type === 'Training' ? 'TRG' : 'MTG'}/${new Date(event.date).getFullYear()}/${nId}`;
                        })() }
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
    </div>
  );
};

export default EventList;
