import React, { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import UserProfileModal from './UserProfileModal';
import ProfileSkillsModal from './ProfileSkillsModal';
import ConfirmModal from './ConfirmModal';
import NotificationDropdown from './NotificationDropdown';

const TopNav = ({ extraRightContent }) => {
  const { user, logout } = useContext(AuthContext);
  const [showProfile, setShowProfile] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showSignoutConfirm, setShowSignoutConfirm] = useState(false);

  const getInitial = () => {
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 3rem',
      background: 'rgba(10, 10, 15, 0.5)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div style={{
            width: '32px', height: '32px', 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', color: 'white', fontSize: '1.2rem',
            boxShadow: '0 2px 10px rgba(124, 58, 237, 0.4)'
          }}>A</div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Agentic Agile
          </h1>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {extraRightContent}
        
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            
            <button 
              onClick={() => setShowSkills(true)} 
              className="btn-secondary" 
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <span>🛠️</span> My Skills
            </button>
            
            <NotificationDropdown />
            
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.2rem 0.5rem', borderRadius: '8px', transition: 'background 0.2s' }}
              onClick={() => setShowProfile(true)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="My Profile"
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(124, 58, 237, 0.2)', color: 'var(--accent-glow)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '700', fontSize: '1rem',
                boxShadow: '0 0 10px rgba(124, 58, 237, 0.2)'
              }}>
                {getInitial()}
              </div>
            </div>

            <button 
              onClick={() => setShowSignoutConfirm(true)} 
              className="btn-secondary" 
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', transition: 'all 0.2s', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {showProfile && createPortal(<UserProfileModal onClose={() => setShowProfile(false)} />, document.body)}
      {showSkills && createPortal(<ProfileSkillsModal onClose={() => setShowSkills(false)} />, document.body)}
      
      <ConfirmModal 
        isOpen={showSignoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        isDestructive={true}
        onCancel={() => setShowSignoutConfirm(false)}
        onConfirm={logout}
      />
    </nav>
  );
};

export default TopNav;
