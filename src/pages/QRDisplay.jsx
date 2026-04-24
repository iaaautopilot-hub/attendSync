import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getEvent } from '../db';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';

const QRDisplay = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const currentEvent = await getEvent(eventId);
      if (currentEvent) {
        setEvent(currentEvent);
      }
    };
    fetchEvent();
  }, [eventId]);

  if (!event || !event.isActive) {
    const isExpired = event?.isExpired;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#050505', color: '#fff', fontFamily: 'var(--font-main)' }}>
        <div className="glass-card" style={{ textAlign: 'center', border: isExpired ? '1px solid var(--aa-red)' : 'none' }}>
          <h2 style={{ color: 'var(--aa-red)', marginBottom: '1rem' }}>{isExpired ? 'QR Code Expired' : 'QR Code Unavailable'}</h2>
          <p>{isExpired 
            ? 'This attendance session has ended (8-hour limit reached).' 
            : 'The Instructor or Chairman must activate the event before the QR code can be displayed.'}
          </p>
        </div>
      </div>
    );
  }

  const attendanceLink = `${window.location.origin}/attend/${event.id}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: 'var(--font-main)' }}>
      <div style={{ padding: '3rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem', fontWeight: '800', background: 'linear-gradient(135deg, #FFFFFF, var(--aa-red))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {event.name}
        </h1>
        
        <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', color: '#A0A0A0', fontSize: '1.5rem', marginBottom: '4rem', fontWeight: '500' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={32} style={{ color: 'var(--aa-red)' }} /> {event.date} {event.time && `• ${event.time}`}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MapPin size={32} style={{ color: 'var(--aa-red)' }} /> {event.venue} ({event.room})
          </span>
        </div>

        <div style={{ background: '#ffffff', padding: '3.5rem', borderRadius: '40px', boxShadow: '0 30px 60px rgba(226, 22, 41, 0.2)', display: 'inline-block', border: '10px solid #FFFFFF' }}>
          <QRCodeSVG value={attendanceLink} size={500} level="H" />
        </div>
        
        <div style={{ marginTop: '4rem', fontSize: '1.75rem', color: '#FFFFFF' }}>
          <p style={{ margin: '0 0 1.5rem 0', opacity: 0.8, fontWeight: '300' }}>Scan to join the attendance session</p>
          <a href={attendanceLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--aa-red)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontWeight: '700' }}>
            {attendanceLink} <ExternalLink size={28} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default QRDisplay;
