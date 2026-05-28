import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { SocketContext } from '../context/SocketContext';

const ProjectMembers = ({ projectId, userRole }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');

  const socket = useContext(SocketContext);

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;

    const handleAddMemberEvent = (data) => {
      console.log("WebSocket Event Received: add_member", data);
      setMembers(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    const handleRemoveMemberEvent = (targetUserId) => {
      console.log("WebSocket Event Received: remove_member", targetUserId);
      setMembers(prev => prev.filter(m => m.user?.id !== targetUserId));
    };

    const handleRoleChangeEvent = (data) => {
      console.log("WebSocket Event Received: role_change", data);
      setMembers(prev => prev.map(m => {
        if (m.user?.id === data.targetUserId) {
          return { ...m, role: data.role };
        }
        return m;
      }));
    };

    socket.on("add_member", handleAddMemberEvent);
    socket.on("remove_member", handleRemoveMemberEvent);
    socket.on("role_change", handleRoleChangeEvent);

    return () => {
      socket.off("add_member", handleAddMemberEvent);
      socket.off("remove_member", handleRemoveMemberEvent);
      socket.off("role_change", handleRoleChangeEvent);
    };
  }, [socket]);

  const fetchMembers = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error fetching members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/members`, { email: newUserEmail, role: newMemberRole });
      setNewUserEmail('');
      setNewMemberRole('member');
      setShowForm(false);
      // Removed fetchMembers() because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding member');
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if(!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      await api.delete(`/projects/${projectId}/members/${targetUserId}`);
      // Removed fetchMembers() because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error removing member');
    }
  };

  if (loading) return <p>Loading members...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3>Team Members</h3>
        {userRole === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Member'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Add New Member</h4>
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">User Email</label>
              <input type="email" className="form-input" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required placeholder="colleague@company.com" />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">Role</label>
              <select className="form-input" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="project_admin">Project Admin</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>Add</button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {members.map(member => (
          <div key={member.id} className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{member.user?.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{member.user?.email}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ 
                padding: '0.25rem 0.75rem', 
                borderRadius: 'var(--border-radius-lg)', 
                fontSize: '0.8rem',
                background: member.role === 'admin' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.1)',
                color: member.role === 'admin' ? '#c4b5fd' : 'var(--text-secondary)'
              }}>
                {member.role}
              </span>
              {userRole === 'admin' && (
                <button onClick={() => handleRemoveMember(member.user?.id)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectMembers;
