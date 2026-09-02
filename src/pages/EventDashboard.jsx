import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getParticipants, activateEvent, getCurrentUser, updateEventRemarks } from '../db';
import QRCode from 'qrcode';
import { FileDown, Calendar, MapPin, Users, RefreshCw, ShieldCheck, ExternalLink, CheckCircle } from 'lucide-react';
import { exportAttendancePDF } from '../utils/pdfExport';

const EventDashboard = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loaOverrides, setLoaOverrides] = useState({});
  const remarksInitialized = useRef(false);

  const handleLoaChange = (staffId, value) => {
    setLoaOverrides(prev => ({ ...prev, [staffId]: value }));
  };

  const loadData = async (isFirstLoad = false) => {
    const activeEvent = await getEvent(eventId);
    setEvent(activeEvent);
    if (activeEvent) {
      const p = await getParticipants(activeEvent.id);
      setParticipants(p);
      if (!remarksInitialized.current || isFirstLoad) {
        setRemarks(activeEvent.remarks || '');
        remarksInitialized.current = true;
      }
    }
  };

  useEffect(() => {
    loadData(true);
    const fetchAdmin = async () => {
      const u = await getCurrentUser();
      setCurrentUser(u);
    };
    fetchAdmin();
    // Simulate real-time updates by polling every 5 seconds for participants & event status
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [eventId]);

  const handleActivate = async () => {
    // Generate unique verification data for the Instructor/Chairman QR code
    const verificationText = `VERIFIED CHAIRPERSON: ${currentUser?.name || 'N/A'} (${currentUser?.staff_id || 'N/A'}) | EVENT: ${event.event_code || 'N/A'} | SUBJ: ${event.name} | DATE: ${event.date} | SYSTEM: ATTENDSYNC`;
    
    try {
      // Generate the QR code as a Data URL
      const qrDataUrl = await QRCode.toDataURL(verificationText, {
        margin: 1,
        width: 200
      });

      const updated = await activateEvent(event.id, qrDataUrl, remarks);
      if (updated && !updated.error) {
        setEvent(updated);
        setRemarks(updated.remarks || '');
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
    const success = await updateEventRemarks(event.id, remarks);
    if (success) {
      alert("Remarks updated successfully!");
      setEvent({ ...event, remarks: remarks });
    } else {
      alert("Failed to update remarks.");
    }
  };

  const handleGenerateSoftCopy = async () => {
    if (participants.length === 0) return;
    
    // Inject the overridden LOAs into event.leaderDetails
    const updatedEvent = {
      ...event,
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
        <Calendar size={48} />
        <h2>No Active Event</h2>
        <p>There is currently no event ongoing. Please create one first.</p>
        <button onClick={() => window.location.href = '/'} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
          Create Event
        </button>
      </div>
    );
  }

  const leaderLabel = event.type === 'Training' ? 'Instructors' : 'Chairmen';

  const isAssignedLeader = event?.leaders?.includes(currentUser?.name) || event?.leaders?.includes(currentUser?.full_name);
  const isSystemAdmin = currentUser?.multi_roles?.some(r => r.toLowerCase() === 'system administrator');
  const canActivate = isSystemAdmin || isAssignedLeader;

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2">
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className={`badge ${event.type === 'Meeting' ? 'badge-blue' : 'badge-purple'}`} style={{ marginBottom: '1.25rem' }}>
                {event.type}
              </span>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{event.name}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img src="/icon.png" alt="Icon" style={{ width: '18px', height: '18px', objectFit: 'contain' }} /> <span>{event.date} {event.time && `• ${event.time}`}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img src="/icon.png" alt="Icon" style={{ width: '18px', height: '18px', objectFit: 'contain' }} /> <span>{event.venue} - {event.room}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img src="/icon.png" alt="Icon" style={{ width: '18px', height: '18px', objectFit: 'contain' }} /> <span>Dept: {event.department}</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned {leaderLabel}</p>
              {(event.leaders || []).map((leader, i) => (
                <div key={i} style={{ fontWeight: '700', color: 'var(--aa-white)', marginBottom: '0.25rem' }}>{leader}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {!event.isActive ? (
            canActivate ? (
              <>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Activation Required</h3>
                <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center', padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--aa-green)', marginBottom: '0.5rem' }}>
                    <ShieldCheck size={24} />
                    <strong style={{ fontSize: '1.1rem' }}>Chairperson Digital Verification</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    A unique, encrypted QR verification code will be generated as your official digital signature for this report.
                  </p>
                </div>
  
                <div style={{ width: '100%', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Meeting / Training Remarks</label>
                  <textarea 
                    className="form-control" 
                    style={{ minHeight: '100px', resize: 'none' }} 
                    placeholder="Enter any official remarks, observations, or conclusions here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  ></textarea>
                </div>
                <button onClick={handleActivate} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                  Verify & Activate Event
                </button>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '3rem 1.5rem' }}>
                <ShieldCheck size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Pending Activation</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  This event is waiting for the assigned {leaderLabel.toLowerCase()} to digitally verify and activate it.
                </p>
              </div>
            )
          ) : (
            <>
              <div style={{ padding: '1.5rem', background: 'rgba(226, 22, 41, 0.1)', borderRadius: '50%', color: 'var(--aa-red)', marginBottom: '1.5rem' }}>
                <CheckCircle size={48} />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Event Active</h3>
              
              <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', width: '100%', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--aa-red)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Official Remarks</p>
                  <button 
                    onClick={handleUpdateRemarks}
                    style={{ background: 'none', border: 'none', color: 'var(--aa-green)', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                  >
                    SAVE CHANGES
                  </button>
                </div>
                <textarea 
                  className="form-control" 
                  style={{ minHeight: '80px', background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)', fontSize: '0.95rem', resize: 'none' }} 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Update meeting observations or conclusions..."
                ></textarea>
              </div>

              {event.leaderDetails && event.leaderDetails.length > 0 && (
                <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', width: '100%', textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--aa-red)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    {event.type === 'Training' ? 'Instructor' : 'Chairperson'} LOA Details
                  </p>
                  {event.leaderDetails.map(ld => (
                    <div key={ld.staff_id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {ld.name} ({ld.staff_id})
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder={`Default LOA: ${ld.loa_no || 'None'}`}
                        value={loaOverrides[ld.staff_id] || ''}
                        onChange={(e) => handleLoaChange(ld.staff_id, e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--aa-white)', padding: '0.75rem', borderRadius: '8px' }}
                      />
                    </div>
                  ))}
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    * Leave blank to use the default LOA number from User Management. Overrides here apply to the PDF export.
                  </p>
                </div>
              )}

              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '350px' }}>
                Attendance is now being recorded. Display the QR code on a large screen for participants.
              </p>
              <button 
                onClick={() => window.open(`/qr/${event.id}`, '_blank')} 
                className="btn btn-primary" 
                style={{ fontSize: '1.2rem', padding: '1.25rem 2.5rem', gap: '1rem', borderRadius: '16px' }}
              >
                <ExternalLink size={24} /> Screen Presentation QR
              </button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Attendance List</h3>
            <span className="badge badge-blue">{participants.length} Scanned</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={loadData} className="btn btn-outline" title="Refresh Data">
              <RefreshCw size={18} />
            </button>
            <button onClick={handleGenerateSoftCopy} disabled={participants.length === 0} className="btn btn-success">
              <FileDown size={18} />
              Export PDF
            </button>
          </div>
        </div>

        {/* This div is wrapped for both display and PDF generation */}
        <div style={{ background: '#ffffff', borderRadius: '8px', padding: '1rem', color: '#111827', overflow: 'hidden' }}>
          {participants.length > 0 ? (
            <table style={{ width: '100%', color: '#111827' }}>
              <thead>
                <tr>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>No</th>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>Name</th>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>Staff ID</th>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>Rank</th>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>HUB</th>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>Lic/Fac No.</th>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>Timestamp</th>
                  <th style={{ color: '#4B5563', borderBottom: '2px solid #E5E7EB' }}>Signature</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, i) => (
                  <tr key={i}>
                    <td style={{ borderBottom: '1px solid #E5E7EB' }}>{i + 1}</td>
                    <td style={{ borderBottom: '1px solid #E5E7EB' }}>{p.name}</td>
                    <td style={{ borderBottom: '1px solid #E5E7EB' }}>{p.staffId}</td>
                    <td style={{ borderBottom: '1px solid #E5E7EB' }}>{p.rank}</td>
                    <td style={{ borderBottom: '1px solid #E5E7EB' }}>{p.hub}</td>
                    <td style={{ borderBottom: '1px solid #E5E7EB' }}>{p.license}</td>
                    <td style={{ borderBottom: '1px solid #E5E7EB' }}>
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
                    <td style={{ borderBottom: '1px solid #E5E7EB', padding: '0.25rem 1rem' }}>
                      {p.signature && <img src={p.signature} alt="Signature" style={{ height: '40px', maxWidth: '100px' }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
              Waiting for participants to scan and sign in...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDashboard;
