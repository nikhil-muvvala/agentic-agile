import React, { useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const UserProfileModal = ({ onClose }) => {
  const { user, setUser } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    try {
      setError(null);
      setSaving(true);
      const res = await api.put('/users/me', { name });
      // Update the global user context with the new name
      setUser(res.data.user);
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', padding: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800' }}>My Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color='white'} onMouseLeave={(e) => e.currentTarget.style.color='var(--text-secondary)'}>&times;</button>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        <div style={{ marginBottom: '2rem' }}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Email Address</label>
            <input 
              type="text" 
              className="input-premium" 
              value={user?.email || ''} 
              disabled 
              style={{ opacity: 0.7, cursor: 'not-allowed' }} 
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>Email cannot be changed</span>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            {isEditing ? (
              <input
                type="text"
                className="input-premium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            ) : (
              <input 
                type="text" 
                className="input-premium" 
                value={user?.name || ''} 
                disabled 
                style={{ opacity: 0.9, backgroundColor: 'rgba(255,255,255,0.02)' }} 
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {isEditing ? (
            <>
              <button className="btn-secondary" onClick={() => { setIsEditing(false); setName(user?.name); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-premium" onClick={handleSave} disabled={saving || !name.trim()} style={{ flex: 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Close</button>
              <button className="btn-premium" onClick={() => setIsEditing(true)} style={{ flex: 1 }}>
                Edit Profile
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
