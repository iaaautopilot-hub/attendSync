import React, { useState, useEffect } from 'react';
import { getAllUsers, addUser, deleteUser, updateUser, getCurrentUser } from '../db';
import { UserPlus, Shield, Trash2, Users, Edit } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const initialFormState = {
    name: '',
    username: '',
    email: '',
    password: '123',
    role: 'Chairman',
    loaNo: '',
    staffId: ''
  };
  
  const [formData, setFormData] = useState(initialFormState);

  const loadUsers = async () => {
    const all = await getAllUsers();
    setUsers(all);
  };

  useEffect(() => {
    const init = async () => {
      const u = await getCurrentUser();
      setCurrentUser(u);
      if (u?.role?.toLowerCase() === 'admin') {
        await loadUsers();
      }
      setLoading(false);
    };
    init();
  }, []);

  if (loading) return null;

  if (currentUser?.role?.toLowerCase() !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    let result;
    if (editingUserId) {
      result = await updateUser({ ...formData, original_staff_id: editingUserId });
      if (!result.error) setEditingUserId(null);
    } else {
      result = await addUser(formData);
    }

    if (result?.error) {
      alert("Error: " + result.error.message);
    } else {
      setFormData(initialFormState);
      await loadUsers();
    }
  };

  const handleEditUser = (user) => {
    setEditingUserId(user.staff_id); 
    setFormData({
      name: user.name,
      staffId: user.staff_id || '',
      username: user.username,
      email: user.email || '',
      password: '••••••••', // Placeholder to prevent hashing the hash
      role: user.role,
      loaNo: user.loa_no || '',
      original_staff_id: user.staff_id
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setFormData(initialFormState);
  };

  const handleDeleteUser = async (staffId) => {
    const userToDelete = users.find(u => u.staff_id === staffId);
    if (userToDelete?.username?.toLowerCase() === 'admin' || staffId === 'ADMIN-01') {
      alert("CRITICAL ERROR: The System Administrator account cannot be removed.");
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this user?")) {
      const { error } = await deleteUser(staffId);
      if (error) {
        alert("Error deleting user: " + error.message);
      } else {
        await loadUsers();
      }
    }
  };

  return (
    <div className="animate-fade-in grid grid-cols-2">
      <div className="glass-card" style={{ height: 'fit-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ padding: '1rem', background: editingUserId ? 'rgba(245, 158, 11, 0.15)' : 'rgba(226, 22, 41, 0.15)', borderRadius: '16px', color: editingUserId ? '#F59E0B' : 'var(--aa-red)' }}>
            <img src="/icon.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{editingUserId ? 'Edit User' : 'Register Staff'}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{editingUserId ? 'Modify staff credentials' : 'Register new staff into the AirAsia portal'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmitUser}>
          <div className="form-group">
            <label>Full Name</label>
            <input required type="text" name="name" className="form-control" value={formData.name} onChange={handleChange} placeholder="e.g. David Manager" />
          </div>

          <div className="form-group">
            <label>Staff ID</label>
            <input required type="text" name="staffId" className="form-control" value={formData.staffId} onChange={handleChange} placeholder="e.g. 1003668" />
            {editingUserId && <span style={{ fontSize: '0.65rem', color: 'var(--aa-red)', marginTop: '0.25rem', display: 'block' }}>NOTE: CHANGING STAFF ID WILL UPDATE ALL HISTORICAL LINKS.</span>}
          </div>

          <div className="form-group">
            <label>Username</label>
            <input required type="text" name="username" className="form-control" value={formData.username} onChange={handleChange} placeholder="e.g. david.m" />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Email Address</label>
            <input required type="email" name="email" className="form-control" value={formData.email} onChange={handleChange} placeholder="david@airasia.com" />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select name="role" className="form-control" value={formData.role} onChange={handleChange}>
              <option value="Chairman">Chairman</option>
              <option value="Instructor">Instructor</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label>Password</label>
            <input required type="text" name="password" className="form-control" value={formData.password} onChange={handleChange} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'block' }}>DEFAULT PASSWORD IS 123</span>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>LOA Number (For Instructors/Chairmen)</label>
            <input type="text" name="loaNo" className="form-control" value={formData.loaNo} onChange={handleChange} placeholder="e.g. 5850/KAPEL/II/2026" />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Shield size={20} />
              {editingUserId ? 'Update User' : 'Register User'}
            </button>
            {editingUserId && (
              <button type="button" onClick={cancelEdit} className="btn btn-outline" style={{ flex: 1 }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Registered Staff</h3>
          <span className="badge badge-purple" style={{ background: 'var(--aa-red)', color: 'white' }}>{users.length} Total</span>
        </div>

        <div style={{ maxHeight: '650px', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {users.map((user) => (
            <div key={user.staff_id || user.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '1.25rem', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              marginBottom: '1rem',
              transition: 'all 0.3s ease'
            }} className="user-row-hover">
              <div>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  {user.name}
                  <span className={`badge ${user.role?.toLowerCase() === 'admin' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '0.6rem', padding: '0.25rem 0.6rem' }}>
                    {user.role}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                   <span style={{ color: 'var(--aa-red)', opacity: 0.8 }}>@</span>{user.username} • {user.email || 'No Email'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleEditUser(user)} 
                  className="btn btn-outline" 
                  style={{ padding: '0.6rem', border: 'none', color: 'var(--text-secondary)' }}
                  title="Edit User"
                >
                  <Edit size={20} />
                </button>
                <button 
                  onClick={() => handleDeleteUser(user.staff_id)} 
                  className="btn btn-outline" 
                  style={{ 
                    padding: '0.6rem', 
                    color: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 'var(--text-secondary)' : '#F87171', 
                    border: 'none',
                    opacity: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 0.3 : 1,
                    cursor: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 'not-allowed' : 'pointer'
                  }}
                  disabled={user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01'}
                  title={user.username?.toLowerCase() === 'admin' ? "System Account Cannot Be Deleted" : "Delete User"}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="empty-state">
              <Users size={48} />
              <p>No users found in database.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
