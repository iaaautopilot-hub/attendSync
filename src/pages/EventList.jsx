import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, clearEvent, getCurrentUser, getAllDepartments, updateEventInfo, getUsersByRole } from '../db';
import { Calendar, Trash2, ChevronRight, Target, Filter, Search, Edit, X, Users, Eye } from 'lucide-react';

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
      // Admin sees events from their specific department
      const deptRole = u.multi_roles.find(r => r.startsWith('dept:'));
      if (deptRole) {
        const adminDept = deptRole.split(':')[1];
        setEvents(allEvents.filter(e => e.department === adminDept));
      } else {
        // If no department is set for an admin, they see no events (or we could default to all, but restricted is safer based on requirements)
        setEvents([]);
      }
    } else {
      // Chairmen/Instructors only see events where they are assigned leaders
      const myEvents = allEvents.filter(e => e.leaders && e.leaders.includes(u.full_name));
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
    
    setEditingEvent(event);
    setEditFormData({
      name: event.name,
      date: event.date,
      time: event.time,
      type: event.type,
      venue: event.venue,
      room: event.room,
      department: event.department,
      leaders: event.leaders?.length > 0 ? [...event.leaders] : ['']
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const actualLeaders = editFormData.leaders.filter(l => l.trim() !== '');
    await updateEventInfo(editingEvent.id, {
      ...editFormData,
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

  const availableDepartments = Array.from(new Set([
    ...departments.map(d => d.name),
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '16px', color: 'var(--aa-red)', boxShadow: '0 8px 16px rgba(226, 22, 41, 0.1)' }}>
            <img src="/icon.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) ? 'System Events' : 'My Assigned Events'}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Manage and view attendance records for your flight or training</p>
          </div>
        </div>
        {user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) && (
          <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
            + New Event
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0.85rem 1.5rem', background: 'rgba(255, 255, 255, 0.02)' }}>
          <Search size={20} style={{ color: 'var(--text-secondary)', marginRight: '1rem' }} />
          <input
            type="text"
            placeholder="Search event name..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', outline: 'none' }}
          />
        </div>
      </div>

      {availableDepartments.length > 0 && events.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem 1.75rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.6rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '12px', color: 'var(--aa-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Filter size={20} />
            </div>
            <div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--aa-white)', display: 'block' }}>Department Filter</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Showing {filteredEvents.length} of {events.length} total events</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedDepartment('ALL')}
              className={`btn ${selectedDepartment === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.85rem',
                borderRadius: '50px',
                background: selectedDepartment === 'ALL' ? 'var(--aa-red)' : 'transparent',
                borderColor: selectedDepartment === 'ALL' ? 'var(--aa-red)' : 'var(--border-color)',
                color: selectedDepartment === 'ALL' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                fontWeight: selectedDepartment === 'ALL' ? '700' : '500',
                boxShadow: selectedDepartment === 'ALL' ? '0 4px 12px rgba(226, 22, 41, 0.3)' : 'none'
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
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.85rem',
                    borderRadius: '50px',
                    background: isSelected ? 'var(--aa-red)' : 'transparent',
                    borderColor: isSelected ? 'var(--aa-red)' : 'var(--border-color)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                    fontWeight: isSelected ? '700' : '500',
                    boxShadow: isSelected ? '0 4px 12px rgba(226, 22, 41, 0.3)' : 'none'
                  }}
                >
                  {deptName} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filteredEvents.length === 0 ? (
        <div className="empty-state">
          <img src="/icon.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', marginBottom: '1.5rem', opacity: 0.6 }} />
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '1.25rem 1.75rem', fontWeight: 600, whiteSpace: 'nowrap', width: '220px' }}>Event ID</th>
                  <th style={{ padding: '1.25rem 1.75rem', fontWeight: 600, minWidth: '280px' }}>Name</th>
                  <th style={{ padding: '1.25rem 1.75rem', fontWeight: 600, whiteSpace: 'nowrap', width: '180px' }}>Date & Time</th>
                  <th style={{ padding: '1.25rem 1.75rem', fontWeight: 600, minWidth: '200px', whiteSpace: 'nowrap' }}>Location</th>
                  <th style={{ padding: '1.25rem 1.75rem', fontWeight: 600, whiteSpace: 'nowrap', width: '170px' }}>Department</th>
                  <th style={{ padding: '1.25rem 1.75rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.map(event => (
                  <tr key={event.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'all 0.3s ease' }} className="user-row-hover">
                    <td style={{ padding: '1.25rem 1.75rem', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.7rem', borderRadius: '6px', color: 'var(--aa-red)', border: '1px solid rgba(226, 22, 41, 0.2)', letterSpacing: '0.05em', display: 'inline-block' }}>
                        { (() => {
                          const dept = (event.department || 'Flight Operation');
                          let dCode = deptCodeMap[dept];
                          if (!dCode) {
                            if (dept === 'Flight Operation' || dept === 'FOP') dCode = 'FOP';
                            else dCode = dept.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
                          }
                          const nId = (event.event_code || '0').replace(/\D/g, '').padStart(5, '0');
                          return `IAA/${dCode}/${event.type === 'Training' ? 'TRG' : 'MTG'}/${new Date(event.date).getFullYear()}/${nId}`;
                        })() }
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.75rem', minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <span className={`badge ${event.type === 'Meeting' ? 'badge-blue' : 'badge-purple'}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', flexShrink: 0 }}>
                          {event.type}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--aa-white)' }}>
                          {event.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {event.date} {event.time && `• ${event.time}`}
                    </td>
                    <td style={{ padding: '1.25rem 1.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      📍 {event.venue} {event.room && `(${event.room})`}
                    </td>
                    <td style={{ padding: '1.25rem 1.75rem', whiteSpace: 'nowrap' }}>
                      <span style={{ background: 'rgba(255,255,255,0.04)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {event.department}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Link 
                          to={`/dashboard/${event.id}`} 
                          className="btn btn-outline"
                          style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Eye size={16} /> View
                        </Link>
                        {user?.multi_roles?.some(r => ['admin', 'system administrator'].includes(r.toLowerCase())) && (
                          <button 
                            onClick={(e) => openEditModal(e, event)} 
                            className="btn btn-outline" 
                            style={{ padding: '0.45rem', color: 'var(--text-secondary)', border: 'none' }}
                            title="Edit Event"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                        {user?.multi_roles?.some(r => r.toLowerCase() === 'system administrator') && (
                          <button 
                            onClick={(e) => handleDelete(event.id, e)} 
                            className="btn btn-outline" 
                            style={{ padding: '0.45rem', color: '#F87171', border: 'none' }}
                            title="Delete Event"
                          >
                            <Trash2 size={18} />
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '0.5rem 1rem' }}
              >
                Previous
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className="btn btn-outline" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '0.5rem 1rem' }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {editingEvent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Edit Event</h2>
              <button onClick={() => setEditingEvent(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={24} />
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
                <select className="form-control" value={editFormData.department} onChange={(e) => setEditFormData({...editFormData, department: e.target.value})}>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Event Date</label>
                <input required type="date" className="form-control" value={editFormData.date} onChange={(e) => setEditFormData({...editFormData, date: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Event Time</label>
                <input required type="time" className="form-control" value={editFormData.time} onChange={(e) => setEditFormData({...editFormData, time: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Venue</label>
                <input required type="text" className="form-control" value={editFormData.venue} onChange={(e) => setEditFormData({...editFormData, venue: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Room Name</label>
                <input required type="text" className="form-control" value={editFormData.room} onChange={(e) => setEditFormData({...editFormData, room: e.target.value})} />
              </div>

              <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Users size={20} style={{ color: 'var(--aa-red)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Assign {editFormData.type === 'Training' ? 'Instructor' : 'Chairman'}</h3>
                  </div>
                  {editFormData.leaders.length < 3 && (
                    <button type="button" onClick={addLeader} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                      + Add
                    </button>
                  )}
                </div>

                {editFormData.leaders.map((leader, index) => (
                  <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: index !== editFormData.leaders.length - 1 ? '1rem' : '0' }}>
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
                      <button type="button" onClick={() => removeLeader(index)} className="btn btn-outline" style={{ color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingEvent(null)} className="btn btn-outline" style={{ flex: 1 }}>
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
