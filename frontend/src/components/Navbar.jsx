import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';
import ProfileSkillsModal from './ProfileSkillsModal';
import NotificationDropdown from './NotificationDropdown';

const Navbar = ({ extraRightContent }) => {
  const { user, logout } = useContext(AuthContext);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
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
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user?.name}</span>
          <button onClick={() => setShowSkillsModal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>✨ My Skills</button>
          <button onClick={() => setShowPasswordModal(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>Password</button>
          <button onClick={handleLogout} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Logout</button>
        </div>
      </nav>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showSkillsModal && <ProfileSkillsModal onClose={() => setShowSkillsModal(false)} />}
    </>
  );
};

export default Navbar;
