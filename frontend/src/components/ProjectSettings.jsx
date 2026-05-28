import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ProjectSettings = ({ projectId, projectData, userRole }) => {
  const [name, setName] = useState(projectData?.name || '');
  const [description, setDescription] = useState(projectData?.description || '');
  const navigate = useNavigate();

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/projects/${projectId}`, { name, description });
      alert("Project updated successfully!");
      window.location.reload(); // Quick refresh to update headers
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating project');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("CRITICAL WARNING: Are you sure you want to permanently delete this project? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/${projectId}`);
      alert("Project deleted.");
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting project');
    }
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3 style={{ marginBottom: '1.5rem' }}>Project Settings</h3>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>Edit Details</h4>
        <form onSubmit={handleUpdate}>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea 
              className="form-input" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              rows="4" 
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary">Save Changes</button>
        </form>
      </div>

      {userRole === 'admin' && (
        <div className="glass-panel" style={{ padding: '2rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h4 style={{ marginBottom: '0.5rem', color: 'var(--error)' }}>Danger Zone</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Deleting a project will remove all of its tasks, subtasks, members, and notes. This action is irreversible.
          </p>
          <button onClick={handleDelete} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid var(--error)' }}>
            Delete Project Permanently
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectSettings;
