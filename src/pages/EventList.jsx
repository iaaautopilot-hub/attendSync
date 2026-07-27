import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, clearEvent, getCurrentUser, getAllDepartments } from '../db';
import { Calendar, Trash2, ChevronRight, Target, Filter } from 'lucide-react';

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [deptCodeMap, setDeptCodeMap] = useState({});
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

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

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to permanently delete this event? This will also remove all its attendance records.")) {
      await clearEvent(id);
      loadEvents();
    }
  };

  const availableDepartments = Array.from(new Set([
    ...departments.map(d => d.name),
    ...events.map(e => e.department).filter(Boolean)
  ])).sort();

  const filteredEvents = selectedDepartment === 'ALL'
    ? events
    : events.filter(e => e.department === selectedDepartment);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '950px', margin: '0 auto' }}>
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

      <div className="grid">
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
          filteredEvents.map(event => (
            <Link 
              key={event.id} 
              to={`/dashboard/${event.id}`} 
              className="glass-card" 
              style={{ display: 'block', textDecoration: 'none', transition: 'transform 0.2s', padding: '1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <span className={`badge ${event.type === 'Meeting' ? 'badge-blue' : 'badge-purple'}`}>
                      {event.type}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {event.date} {event.time && `• ${event.time}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
                    <h3 style={{ margin: 0 }}>{event.name}</h3>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.6rem', borderRadius: '6px', color: 'var(--aa-red)', border: '1px solid rgba(226, 22, 41, 0.2)', letterSpacing: '0.05em' }}>
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
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem' }}>
                    <span>📍 {event.venue} ({event.room})</span>
                    <span>👔 Dept: {event.department}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  {user?.multi_roles?.some(r => r.toLowerCase() === 'system administrator') && (
                    <button 
                      onClick={(e) => handleDelete(event.id, e)} 
                      className="btn btn-outline" 
                      style={{ padding: '0.5rem', color: '#F87171', border: 'none' }}
                      title="Delete Event"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <ChevronRight size={24} style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default EventList;
