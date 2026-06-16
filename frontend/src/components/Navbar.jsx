import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import UserProfileModal from './UserProfileModal';
import ProfileSkillsModal from './ProfileSkillsModal';
import LogoutConfirmModal from './LogoutConfirmModal';
import NotificationDropdown from './NotificationDropdown';

const Navbar = ({ extraRightContent }) => {
  const { user, logout } = useContext(AuthContext);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', position: 'relative', zIndex: 9999 }}>
        <Link to="/" className="nav-brand text-gradient" style={{ textDecoration: 'none' }}>Project Camp</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {extraRightContent}
          <NotificationDropdown />
          <div style={{ width: '1px', height: '20px', background: 'var(--border-light)' }}></div>
          <button onClick={() => setShowSkillsModal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>My Skills</button>
          
          <button 
            onClick={() => setShowProfileModal(true)} 
            style={{ 
              width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' 
            }}
            title="Profile"
          >
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </button>

          <button onClick={() => setShowLogoutModal(true)} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Logout</button>
        </div>
      </nav>

      {showProfileModal && <UserProfileModal onClose={() => setShowProfileModal(false)} />}
      {showSkillsModal && <ProfileSkillsModal onClose={() => setShowSkillsModal(false)} />}
      {showLogoutModal && <LogoutConfirmModal onCancel={() => setShowLogoutModal(false)} onConfirm={handleLogout} />}
    </>
  );
};

export default Navbar;
