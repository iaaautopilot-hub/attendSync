import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { getCurrentUser, updateUserPassword, validateLogin } from '../db';

const ChangePassword = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const fetchUser = async () => {
      const u = await getCurrentUser();
      setUser(u);
    };
    fetchUser();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    let passwordUpdated = false;

    // 1. Handle Password Update if filled
    if (formData.currentPassword || formData.newPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        alert("New passwords do not match!");
        return;
      }
      if (formData.newPassword.length < 3) {
        alert("Password must be at least 3 characters.");
        return;
      }
      const valid = await validateLogin(user.username, formData.currentPassword);
      if (!valid) {
        alert("Incorrect current password.");
        return;
      }
      const success = await updateUserPassword(user.username, formData.newPassword);
      if (success) passwordUpdated = true;
    }

    if (passwordUpdated) {
      alert("Settings updated successfully!");
      navigate(user.role?.toLowerCase() === 'admin' ? '/' : '/events');
    } else {
      alert("No changes made.");
    }
  };

  return (
    <div className="container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '1rem' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2.25rem 1.75rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(226, 22, 41, 0.1)', borderRadius: '20px', color: 'var(--aa-red)', marginBottom: '1.25rem' }}>
            <ShieldCheck size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Account Settings</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Update your security credentials and portal settings.</p>
        </div>

        <form onSubmit={handleSaveSettings}>
          <div className="form-group">
            <label>Current Password</label>
            <input required type="password" name="currentPassword" className="form-control" value={formData.currentPassword} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>New Password</label>
            <input required type="password" name="newPassword" className="form-control" value={formData.newPassword} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" name="confirmPassword" className="form-control" value={formData.confirmPassword} onChange={handleChange} />
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '1.5rem 0' }}></div>
          
          <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--accent-success)', fontWeight: '600' }}>✓ Automated QR Signature Active</p>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Your reports will automatically include a unique verification QR code.</p>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', fontSize: '1rem', padding: '0.9rem' }}>
            Save Account Settings
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
