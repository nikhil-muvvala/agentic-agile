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
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>My Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Email</label>
            <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              {user?.email}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Email cannot be changed</span>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Name</label>
            {isEditing ? (
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{ width: '100%' }}
              />
            ) : (
              <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                {user?.name}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          {isEditing ? (
            <>
              <button className="btn" onClick={() => { setIsEditing(false); setName(user?.name); }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
