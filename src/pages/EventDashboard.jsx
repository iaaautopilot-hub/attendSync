import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getParticipants, getParticipantsCount, activateEvent, getCurrentUser, updateEventRemarks } from '../db';
import QRCode from 'qrcode';
import { FileDown, Calendar, MapPin, Users, RefreshCw, ShieldCheck, ExternalLink, CheckCircle, Save, Lock, Clock, ShieldAlert } from 'lucide-react';
import { exportAttendancePDF } from '../utils/pdfExport';
import { getActivationLockStatus } from '../utils/timeUtils';

const EventDashboard = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [trainingType, setTrainingType] = useState('Initial');
  const [loaOverrides, setLoaOverrides] = useState({});
  const [now, setNow] = useState(new Date());
  const remarksInitialized = useRef(false);
  const participantsCountRef = useRef(-1);
  const activeEventRef = useRef(null);

  const handleLoaChange = (staffId, value) => {
    setLoaOverrides(prev => ({ ...prev, [staffId]: value }));
  };

  const loadData = async (isFullRefresh = false) => {
    // Pause background polling immediately to eliminate wasted Vercel/Supabase egress & compute
    if (!isFullRefresh && document.hidden) return;

    // 1. Fetch full event details if first load, full refresh, or if event wasn't active yet
    if (isFullRefresh || !activeEventRef.current || !activeEventRef.current.isActive) {
      const activeEvent = await getEvent(eventId);
      if (activeEvent) {
        setEvent(activeEvent);
        activeEventRef.current = activeEvent;
        if (!remarksInitialized.current || isFullRefresh) {
          setRemarks(activeEvent.remarks || '');
          if (activeEvent.training_type || activeEvent.trainingType) {
            setTrainingType(activeEvent.training_type || activeEvent.trainingType);
          } else {
            setTrainingType('Initial');
          }
          remarksInitialized.current = true;
        }
      }
    }

    // 2. Ultra-lightweight participant check: query HEAD count (0 bytes payload)
    const currentCount = await getParticipantsCount(eventId);

    // Only download full participant base64 signatures if count changed or on full refresh
    if (isFullRefresh || currentCount !== participantsCountRef.current) {
      const p = await getParticipants(eventId);
      setParticipants(p);
      participantsCountRef.current = p.length;
    }
  };

  useEffect(() => {
    loadData(true);
    const fetchAdmin = async () => {
      const u = await getCurrentUser();
      setCurrentUser(u);
    };
    fetchAdmin();

    // Smart polling: checks every 10 seconds ONLY when tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadData(false);
      }
    }, 10000);

    // When returning to tab, immediately check once
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData(false);
        setNow(new Date());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Tick clock every 10s only when tab is active
    const clockInterval = setInterval(() => {
      if (!document.hidden) {
        setNow(new Date());
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [eventId]);

  const handleActivate = async () => {
    if (isInstructorLocked) {
      alert(`Activation is locked until 30 minutes before the scheduled start time (${lockStatus.formattedUnlockTime}).`);
      return;
    }

    const selectedTrainingType = event.type === 'Training' ? (trainingType || 'Initial') : null;
    const leaderTitle = event.type === 'Training' ? 'INSTRUCTOR' : 'CHAIRPERSON';

    // Generate unique verification data for the Instructor/Chairman QR code
    const verificationText = `VERIFIED ${leaderTitle}: ${currentUser?.name || 'N/A'} (${currentUser?.staff_id || 'N/A'}) | EVENT: ${event.event_code || 'N/A'} | SUBJ: ${event.name} | DATE: ${event.date}${event.type === 'Training' ? ` | TYPE: ${selectedTrainingType}` : ''} | SYSTEM: ATTENDSYNC`;
    
    try {
      // Generate the QR code as a Data URL
      const qrDataUrl = await QRCode.toDataURL(verificationText, {
        margin: 1,
        width: 200
      });

      const updated = await activateEvent(event.id, qrDataUrl, remarks, selectedTrainingType);
      if (updated && !updated.error) {
        setEvent(updated);
        setRemarks(updated.remarks || '');
        if (updated.training_type || updated.trainingType) {
          setTrainingType(updated.training_type || updated.trainingType);
        }
        alert(`${event.type === 'Training' ? 'Instructor' : 'Chairperson'} digital verification complete. Event is now ACTIVE.`);
      } else {
        alert("Unexpected error: Could not activate event in Database.");
      }
    } catch (err) {
      console.error('Activation QR error:', err);
      alert("Failed to generate digital signature for activation.");
    }
  };

  const handleUpdateRemarks = async () => {
    const selectedTrainingType = event.type === 'Training' ? (trainingType || 'Initial') : null;
    const success = await updateEventRemarks(event.id, remarks, selectedTrainingType);
    if (success) {
      alert("Remarks & session details updated successfully!");
      setEvent({ ...event, remarks: remarks, training_type: selectedTrainingType, trainingType: selectedTrainingType });
    } else {
      alert("Failed to update remarks.");
    }
  };

  const handleGenerateSoftCopy = async () => {
    if (participants.length === 0) return;
    
    const selectedTrainingType = event.type === 'Training' ? (trainingType || event.training_type || 'Initial') : null;

    // Inject the overridden LOAs and selected trainingType into event
    const updatedEvent = {
      ...event,
      training_type: selectedTrainingType,
      trainingType: selectedTrainingType,
      leaderDetails: (event.leaderDetails || []).map(ld => ({
        ...ld,
        loa_no: loaOverrides[ld.staff_id] || ld.loa_no
      }))
    };
    
    // Pass event.creator (whoever created the event), not the logged-in user
    await exportAttendancePDF(updatedEvent, participants, event.creator);
  };

  if (!event) {
    return (
      <div className="empty-state animate-fade-in">
        <Calendar size={44} />
        <h2>No Active Event</h2>
        <p>There is currently no event ongoing. Please create one first.</p>
        <button onClick={() => window.location.href = '/'} className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
          Create Event
        </button>
      </div>
    );
  }

  const leaderLabel = event.type === 'Training' ? 'Instructors' : 'Chairmen';
  const isAssignedLeader = event?.leaders?.includes(currentUser?.name) || event?.leaders?.includes(currentUser?.full_name);
  const isSystemAdmin = currentUser?.multi_roles?.some(r => r.toLowerCase() === 'system administrator');
  const canActivate = isSystemAdmin || isAssignedLeader;

  const lockStatus = getActivationLockStatus(event, 30, now);
  // Activation is locked for assigned instructors for Training sessions until 30 minutes before start time
  const isInstructorLocked = event.type === 'Training' && !isSystemAdmin && lockStatus.isLocked;

  return (
    <div className="animate-fade-in" style={{ width: '100%', margin: '0 auto' }}>
      <div className="grid grid-cols-2">
        {/* Event Details Card */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: '1 1 240px' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge ${event.type === 'Meeting' ? 'badge-blue' : 'badge-purple'}`}>
                  {event.type}
                </span>
                {event.type === 'Training' && (
                  <span className="badge" style={{ background: 'rgba(226, 22, 41, 0.15)', color: '#ff6b6b', border: '1px solid rgba(226, 22, 41, 0.3)' }}>
                    Type: {trainingType || event.training_type || 'Initial'}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: '1.6rem', marginBottom: '0.85rem', wordBreak: 'break-word' }}>{event.name}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>📅</span> <span>{event.date} {event.time && `• ${event.time}`}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>📍</span> <span>{event.venue} - {event.room}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>🏢</span> <span>Dept: {event.department}</span>
                </div>
                {event.type === 'Training' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span>🎯</span> <span>Training Type: <strong style={{ color: 'var(--aa-white)' }}>{trainingType || event.training_type || 'Initial'}</strong></span>
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', minWidth: '140px' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned {leaderLabel}</p>
              {(event.leaders || []).map((leader, i) => (
                <div key={i} style={{ fontWeight: '700', color: 'var(--aa-white)', fontSize: '0.88rem', marginBottom: '0.2rem' }}>{leader}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Activation & Session Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {!event.isActive ? (
            isInstructorLocked ? (
              <div style={{ width: '100%', padding: '0.75rem 0.25rem' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  background: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.1rem',
                  color: '#EAB308',
                  boxShadow: '0 8px 24px rgba(234, 179, 8, 0.15)'
                }}>
                  <Lock size={30} />
                </div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.4rem', color: 'var(--aa-white)' }}>
                  Training Activation Locked
                </h3>
                <div style={{ marginBottom: '1.1rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: '#FDE047',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '50px',
                    fontSize: '0.82rem',
                    fontWeight: '700'
                  }}>
                    <Clock size={14} /> Opens in {lockStatus.timeRemainingStr}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', maxWidth: '380px', margin: '0 auto 1.25rem', lineHeight: '1.5' }}>
                  To ensure training session validity, digital verification & activation for assigned instructors opens strictly <strong>30 minutes before</strong> scheduled start time.
                </p>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  padding: '1rem 1.15rem',
                  borderRadius: '14px',
                  textAlign: 'left',
                  marginBottom: '1.25rem',
                  fontSize: '0.84rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Scheduled Start:</span>
                    <strong style={{ color: 'var(--aa-white)' }}>{event.date} • {event.time}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Activation Unlocks:</span>
                    <strong style={{ color: '#EAB308' }}>{lockStatus.formattedUnlockTime}</strong>
                  </div>
                </div>

                <button disabled className="btn btn-outline" style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', opacity: 0.5, cursor: 'not-allowed', borderColor: 'rgba(255,255,255,0.12)' }}>
                  <Lock size={15} style={{ marginRight: '0.45rem' }} /> Locked Until 30 Mins Before Start
                </button>
              </div>
            ) : canActivate ? (
              <div style={{ width: '100%' }}>
                {isSystemAdmin && event.type === 'Training' && lockStatus.isLocked && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    marginBottom: '1.25rem',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem'
                  }}>
                    <ShieldAlert size={20} style={{ color: '#60A5FA', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong style={{ color: '#93C5FD', display: 'block', marginBottom: '0.2rem' }}>
                        Admin Override Active
                      </strong>
                      <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        Activation is locked for instructors until <strong>{lockStatus.formattedUnlockTime}</strong> (30 min before session). As System Administrator, you may proceed with early activation.
                      </span>
                    </div>
                  </div>
                )}
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Activation Required</h3>
                <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center', padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: 'var(--accent-success)', marginBottom: '0.35rem' }}>
                    <ShieldCheck size={22} />
                    <strong style={{ fontSize: '1rem' }}>{event.type === 'Training' ? 'Instructor Digital Verification' : 'Chairperson Digital Verification'}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    A unique, encrypted QR signature will be generated as your official verification for this session.
                  </p>
                </div>

                {/* Training Type Selector for Instructor before Acknowledgment */}
                {event.type === 'Training' && (
                  <div style={{ width: '100%', marginBottom: '1.25rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--aa-white)', margin: 0 }}>
                        Training Type <span style={{ color: 'var(--aa-red)' }}>*</span>
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Select before acknowledging
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setTrainingType('Initial')}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          border: trainingType === 'Initial' ? '2px solid var(--aa-red)' : '1px solid var(--border-color)',
                          background: trainingType === 'Initial' ? 'rgba(226, 22, 41, 0.15)' : 'rgba(255,255,255,0.03)',
                          color: trainingType === 'Initial' ? '#fff' : 'var(--text-secondary)',
                          fontWeight: trainingType === 'Initial' ? '700' : '500',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: trainingType === 'Initial' ? 'var(--aa-red)' : 'transparent', border: '2px solid ' + (trainingType === 'Initial' ? 'var(--aa-red)' : 'var(--text-secondary)') }}></span>
                        Initial
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrainingType('Recurrent')}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          border: trainingType === 'Recurrent' ? '2px solid var(--aa-red)' : '1px solid var(--border-color)',
                          background: trainingType === 'Recurrent' ? 'rgba(226, 22, 41, 0.15)' : 'rgba(255,255,255,0.03)',
                          color: trainingType === 'Recurrent' ? '#fff' : 'var(--text-secondary)',
                          fontWeight: trainingType === 'Recurrent' ? '700' : '500',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: trainingType === 'Recurrent' ? 'var(--aa-red)' : 'transparent', border: '2px solid ' + (trainingType === 'Recurrent' ? 'var(--aa-red)' : 'var(--text-secondary)') }}></span>
                        Recurrent
                      </button>
                    </div>
                  </div>
                )}
  
                <div style={{ width: '100%', marginBottom: '1.25rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Meeting / Training Remarks</label>
                  <textarea 
                    className="form-control" 
                    style={{ minHeight: '90px', resize: 'none' }} 
                    placeholder="Enter any official remarks, observations, or conclusions here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  ></textarea>
                </div>
                <button onClick={handleActivate} className="btn btn-primary" style={{ width: '100%', padding: '0.95rem', fontSize: '1.05rem' }}>
                  {event.type === 'Training' ? 'Acknowledge & Activate Event' : 'Verify & Activate Event'}
                </button>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <ShieldCheck size={40} style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Pending Activation</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  This event is waiting for the assigned {leaderLabel.toLowerCase()} to select training type and digitally acknowledge & activate it.
                </p>
                {event.type === 'Training' && lockStatus.isLocked && (
                  <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#EAB308', background: 'rgba(234, 179, 8, 0.1)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                    <Lock size={12} /> Unlocks 30 minutes before start ({lockStatus.formattedUnlockTime})
                  </div>
                )}
              </div>
            )
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ padding: '1rem', background: 'rgba(226, 22, 41, 0.1)', borderRadius: '50%', color: 'var(--aa-red)', marginBottom: '1rem' }}>
                <CheckCircle size={38} />
              </div>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Event Active</h3>
              
              {/* Training Type Selector for Active Event */}
              {event.type === 'Training' && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid var(--border-color)', marginBottom: '1rem', width: '100%', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--aa-red)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Training Type</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Instructor selection</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setTrainingType('Initial')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          border: trainingType === 'Initial' ? '1px solid var(--aa-red)' : '1px solid var(--border-color)',
                          background: trainingType === 'Initial' ? 'rgba(226, 22, 41, 0.2)' : 'transparent',
                          color: trainingType === 'Initial' ? '#fff' : 'var(--text-secondary)',
                          fontWeight: trainingType === 'Initial' ? '700' : '400',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Initial
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrainingType('Recurrent')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          border: trainingType === 'Recurrent' ? '1px solid var(--aa-red)' : '1px solid var(--border-color)',
                          background: trainingType === 'Recurrent' ? 'rgba(226, 22, 41, 0.2)' : 'transparent',
                          color: trainingType === 'Recurrent' ? '#fff' : 'var(--text-secondary)',
                          fontWeight: trainingType === 'Recurrent' ? '700' : '400',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Recurrent
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks Box */}
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid var(--border-color)', marginBottom: '1.25rem', width: '100%', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--aa-red)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Official Remarks</p>
                  <button 
                    onClick={handleUpdateRemarks}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-success)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', padding: '0.2rem 0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Save size={12} /> SAVE CHANGES
                  </button>
                </div>
                <textarea 
                  className="form-control" 
                  style={{ minHeight: '70px', background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'none' }} 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Update meeting observations or conclusions..."
                ></textarea>
              </div>

              {/* LOA Overrides if present */}
              {event.leaderDetails && event.leaderDetails.length > 0 && (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid var(--border-color)', marginBottom: '1.25rem', width: '100%', textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--aa-red)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                    {event.type === 'Training' ? 'Instructor' : 'Chairperson'} LOA Details
                  </p>
                  {event.leaderDetails.map(ld => (
                    <div key={ld.staff_id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        {ld.name} ({ld.staff_id})
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder={`Default LOA: ${ld.loa_no || 'None'}`}
                        value={loaOverrides[ld.staff_id] || ''}
                        onChange={(e) => handleLoaChange(ld.staff_id, e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--aa-white)', padding: '0.6rem 0.85rem', borderRadius: '8px', minHeight: '40px', fontSize: '0.88rem' }}
                      />
                    </div>
                  ))}
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    * Overrides apply to the PDF export.
                  </p>
                </div>
              )}

              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', maxWidth: '350px', fontSize: '0.88rem' }}>
                Attendance is active. Open screen presentation for attendee scanning.
              </p>
              <button 
                onClick={() => window.open(`/qr/${event.id}`, '_blank')} 
                className="btn btn-primary" 
                style={{ fontSize: '1.05rem', padding: '1rem 1.5rem', width: '100%', borderRadius: '14px', display: 'flex', justifyContent: 'center' }}
              >
                <ExternalLink size={20} /> Screen Presentation QR
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attendance List Table Card */}
      <div className="glass-card" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Attendance List</h3>
            <span className="badge badge-blue">{participants.length} Scanned</span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={() => loadData(true)} className="btn btn-outline" style={{ padding: '0.55rem 0.85rem' }} title="Refresh Data">
              <RefreshCw size={16} />
            </button>
            <button onClick={handleGenerateSoftCopy} disabled={participants.length === 0} className="btn btn-success" style={{ padding: '0.55rem 1rem' }}>
              <FileDown size={16} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Scrollable Attendance Table Container */}
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '0.5rem', color: '#111827', overflow: 'hidden' }}>
          <div className="table-container" style={{ background: '#ffffff', border: 'none' }}>
            {participants.length > 0 ? (
              <table style={{ width: '100%', color: '#111827', minWidth: '700px' }}>
                <thead>
                  <tr>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>No</th>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>Name</th>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>Staff ID</th>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>Rank</th>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>HUB</th>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>Lic/Fac No.</th>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>Timestamp</th>
                    <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, i) => (
                    <tr key={i}>
                      <td style={{ borderBottom: '1px solid #E5E7EB', color: '#111827' }}>{i + 1}</td>
                      <td style={{ borderBottom: '1px solid #E5E7EB', color: '#111827', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ borderBottom: '1px solid #E5E7EB', color: '#4B5563' }}>{p.staffId}</td>
                      <td style={{ borderBottom: '1px solid #E5E7EB', color: '#4B5563' }}>{p.rank}</td>
                      <td style={{ borderBottom: '1px solid #E5E7EB', color: '#4B5563' }}>{p.hub}</td>
                      <td style={{ borderBottom: '1px solid #E5E7EB', color: '#4B5563' }}>{p.license}</td>
                      <td style={{ borderBottom: '1px solid #E5E7EB', color: '#4B5563', whiteSpace: 'nowrap' }}>
                        {p.scannedAt ? (
                          (() => {
                            const d = new Date(p.scannedAt);
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const hours = String(d.getHours()).padStart(2, '0');
                            const mins = String(d.getMinutes()).padStart(2, '0');
                            return `${day}/${month} ${hours}:${mins}`;
                          })()
                        ) : '-'}
                      </td>
                      <td style={{ borderBottom: '1px solid #E5E7EB', padding: '0.25rem 0.75rem' }}>
                        {p.signature && <img src={p.signature} alt="Signature" style={{ height: '36px', maxWidth: '90px' }} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#6B7280' }}>
                Waiting for participants to scan and sign in...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDashboard;
