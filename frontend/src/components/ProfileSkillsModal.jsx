import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ProfileSkillsModal = ({ onClose }) => {
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const res = await api.get('/users/me/skills');
      setSkills(res.data.skills || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/users/me/skills', { skills });
      onClose();
    } catch (err) {
      alert('Failed to save skills');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>My Skills</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Add technical skills to your profile so the AI Agent can assign tasks that match your expertise.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. React, Node.js, PostgreSQL"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleAddSkill}>Add</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', minHeight: '50px', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
              {skills.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No skills added yet.</span>}
              {skills.map((skill, index) => (
                <div key={index} style={{ 
                  background: 'rgba(139, 92, 246, 0.15)', 
                  color: 'var(--accent-primary)', 
                  border: '1px solid var(--accent-primary)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  {skill}
                  <span onClick={() => handleRemoveSkill(skill)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>&times;</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn" onClick={onClose} style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileSkillsModal;
