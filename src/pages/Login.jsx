import React from 'react';
import { supabase } from '../lib/supabase';
import { LogIn } from 'lucide-react';

const Login = () => {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://attendance-list-web-app.vercel.app/'
      }
    });

    if (error) {
      alert('Error logging in with Google: ' + error.message);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '75vh' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '3.5rem 2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '1.25rem', background: 'rgba(226, 22, 41, 0.1)', borderRadius: '24px', color: 'var(--aa-red)', marginBottom: '1.5rem', boxShadow: '0 8px 16px rgba(226, 22, 41, 0.15)' }}>
            <img src="/icon.png" alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Staff Portal</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Sign in with your Google account to access the AirAsia Attendance system.</p>
        </div>

        <button onClick={handleGoogleLogin} className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.1rem', padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', padding: '2px' }} />
          Sign In with Google
        </button>
      </div>
    </div>
  );
}

export default Login;
