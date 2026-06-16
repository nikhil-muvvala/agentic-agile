import React from 'react';

const LogoutConfirmModal = ({ onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '350px', textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Sign Out?</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Are you sure you want to log out of your account? You will need to sign in again to access your projects.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button 
            className="btn" 
            onClick={onCancel} 
            style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-light)', flex: 1 }}
          >
            Cancel
          </button>
          <button 
            className="btn" 
            onClick={onConfirm} 
            style={{ background: '#ef4444', color: 'white', flex: 1, border: 'none', fontWeight: 'bold' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;
