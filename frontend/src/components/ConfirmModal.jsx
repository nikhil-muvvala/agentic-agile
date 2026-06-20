import React from 'react';
import { createPortal } from 'react-dom';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content glass-panel" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '400px', 
          padding: '2rem', 
          textAlign: 'center',
          border: isDestructive ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-glass)'
        }}
      >
        <div style={{ 
          fontSize: '3rem', 
          marginBottom: '1rem', 
          color: isDestructive ? '#ef4444' : 'var(--accent-primary)' 
        }}>
          {isDestructive ? '⚠️' : '❓'}
        </div>
        
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{title}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.5' }}>{message}</p>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn-secondary" 
            onClick={onCancel} 
            style={{ flex: 1 }}
          >
            {cancelText}
          </button>
          <button 
            className="btn-premium" 
            onClick={onConfirm} 
            style={{ 
              flex: 1, 
              background: isDestructive ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'var(--accent-primary)',
              boxShadow: isDestructive ? '0 4px 15px rgba(239, 68, 68, 0.3)' : undefined
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
