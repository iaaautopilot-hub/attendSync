import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getEvent } from '../db';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';

const QRDisplay = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [qrSize, setQrSize] = useState(280);

  useEffect(() => {
    const fetchEvent = async () => {
      const currentEvent = await getEvent(eventId);
      if (currentEvent) {
        setEvent(currentEvent);
      }
    };
    fetchEvent();

    const updateSize = () => {
      const size = Math.min(280, Math.max(180, window.innerWidth - 80));
      setQrSize(size);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [eventId]);

  if (!event || !event.isActive) {
    const isExpired = event?.isExpired;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#050505', color: '#fff', padding: '1.5rem', fontFamily: 'var(--font-main)' }}>
        <div className="glass-card" style={{ textAlign: 'center', border: isExpired ? '1px solid var(--aa-red)' : 'none', maxWidth: '480px', width: '100%', padding: '2.5rem 1.5rem' }}>
          <h2 style={{ color: 'var(--aa-red)', marginBottom: '1rem', fontSize: '1.5rem' }}>{isExpired ? 'QR Code Expired' : 'QR Code Unavailable'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{isExpired 
            ? 'This attendance session has ended (8-hour limit reached).' 
            : 'The Instructor or Chairman must activate the event before the QR code can be displayed.'}
          </p>
        </div>
      </div>
    );
  }

  const attendanceLink = `${window.location.origin}/attend/${event.id}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: 'var(--font-main)', padding: '1.5rem 1rem' }}>
      <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', marginBottom: '1rem', fontWeight: '800', background: 'linear-gradient(135deg, #FFFFFF, var(--aa-red))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', wordBreak: 'break-word' }}>
          {event.name}
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem 1.5rem', justifyContent: 'center', color: '#A0A0A0', fontSize: '1.05rem', marginBottom: '1.75rem', fontWeight: '500', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={20} style={{ color: 'var(--aa-red)' }} /> {event.date} {event.time && `• ${event.time}`}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={20} style={{ color: 'var(--aa-red)' }} /> {event.venue} ({event.room})
          </span>
        </div>

        <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '24px', boxShadow: '0 20px 40px rgba(226, 22, 41, 0.2)', display: 'inline-block', border: '4px solid #FFFFFF', maxWidth: '100%' }}>
          <QRCodeSVG value={attendanceLink} size={qrSize} level="H" />
        </div>
        
        <div style={{ marginTop: '1.75rem', fontSize: '1rem', color: '#FFFFFF', width: '100%', maxWidth: '480px' }}>
          <p style={{ margin: '0 0 0.75rem 0', opacity: 0.8, fontWeight: '300', fontSize: '0.95rem' }}>Scan to join the attendance session</p>
          <a 
            href={attendanceLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: 'var(--aa-red)', 
              textDecoration: 'none', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.4rem', 
              fontWeight: '700',
              wordBreak: 'break-all',
              fontSize: '0.9rem',
              padding: '0.4rem 0.8rem',
              background: 'rgba(226, 22, 41, 0.08)',
              borderRadius: '8px'
            }}
          >
            <span>{attendanceLink}</span> <ExternalLink size={16} style={{ flexShrink: 0 }} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default QRDisplay;
