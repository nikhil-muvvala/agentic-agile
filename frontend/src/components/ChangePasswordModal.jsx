import React, { useState } from 'react';
import api from '../services/api';

const ChangePasswordModal = ({ onClose }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      return setError('New passwords do not match');
    }

    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    try {
      setLoading(true);
      await api.patch('/auth/change-password', {
        oldPassword,
        newPassword
      });
      setSuccess('Password updated successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '2rem', position: 'relative' }}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
        >
          &times;
        </button>

        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Change Password</h3>
        
        {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={oldPassword} 
              onChange={(e) => setOldPassword(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
