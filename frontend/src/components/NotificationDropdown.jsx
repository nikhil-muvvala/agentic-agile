import React, { useState, useEffect, useContext, useRef } from 'react';
import api from '../services/api';
import { SocketContext } from '../context/SocketContext';

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const socket = useContext(SocketContext);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotification) => {
      console.log("WebSocket Event Received: new_notification", newNotification);
      setNotifications(prev => [newNotification, ...prev]);
    };

    socket.on("new_notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
    };
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
          color: isOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0.5rem', borderRadius: '50%', transition: 'all 0.2s ease'
        }}
        className="btn-hover"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '0', right: '0',
            background: 'var(--error)', color: 'white',
            fontSize: '0.65rem', fontWeight: 'bold',
            borderRadius: '10px', padding: '0.1rem 0.3rem',
            transform: 'translate(20%, -20%)'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass-panel" style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
          width: '320px', maxHeight: '400px', overflowY: 'auto',
          zIndex: 9999, padding: '0',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Notifications</h4>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                You're all caught up!
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => !notif.isRead && markAsRead(notif.id)}
                  style={{ 
                    padding: '1rem', borderBottom: '1px solid var(--border-light)',
                    background: notif.isRead ? 'transparent' : 'rgba(139, 92, 246, 0.05)',
                    cursor: notif.isRead ? 'default' : 'pointer',
                    transition: 'background 0.2s ease',
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                  }}
                >
                  {!notif.isRead && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', marginTop: '0.4rem', flexShrink: 0 }}></div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: notif.isRead ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: '1.4' }}>
                      {notif.message}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem' }}>
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
