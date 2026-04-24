import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, validateLogin } from '../db';
import { Lock, LogIn } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.username && formData.password) {
      const validUser = await validateLogin(formData.username, formData.password);

      if (!validUser) {
        alert('Invalid username or password!');
        return;
      }

      loginUser(validUser.username, validUser.role);

      // Route based on role
      if (validUser.role?.toLowerCase() === 'admin') {
        navigate('/'); // Admin goes to Create Event
      } else {
        navigate('/events'); // Chairman/Instructor go to their events list
      }
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
          <p style={{ color: 'var(--text-secondary)' }}>Enter your credentials to access the AirAsia Attendance system.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input required type="text" name="username" className="form-control" value={formData.username} onChange={handleChange} placeholder="e.g. john.doe" />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input required type="password" name="password" className="form-control" value={formData.password} onChange={handleChange} placeholder="••••••••" />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.1rem', padding: '1rem' }}>
            <LogIn size={22} />
            Sign In Securely
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
