import React from 'react';
import { supabase } from '../lib/supabase';
import { LogIn } from 'lucide-react';

const Login = () => {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      alert('Error logging in with Google: ' + error.message);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '75vh', padding: '1rem' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem 1.75rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(226, 22, 41, 0.1)', borderRadius: '20px', color: 'var(--aa-red)', marginBottom: '1.25rem', boxShadow: '0 6px 14px rgba(226, 22, 41, 0.15)' }}>
            <img src="/icon.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>Staff Portal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sign in with your Google account to access the AirAsia Attendance system.</p>
        </div>

        <button onClick={handleGoogleLogin} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', fontSize: '1rem', padding: '0.95rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', padding: '2px' }} />
          Sign In with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
