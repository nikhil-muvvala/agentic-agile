import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import TopNav from '../components/TopNav';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State for creating new project
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects/viewProjects');
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/projects/project-creation', { name, description });
      setName('');
      setDescription('');
      setShowForm(false);
      fetchProjects(); // Refresh the list
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      
      <main style={{ flex: 1, padding: '3rem 2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '800' }}>Workspaces</h2>
          <button className="btn-premium" onClick={() => setShowForm(true)}>
            <span style={{ fontSize: '1.2rem' }}>+</span> New Workspace
          </button>
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content glass-panel modal-content-inner" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-gradient modal-title">Create New Workspace</h3>
              <form onSubmit={handleCreateProject}>
                <div className="form-group">
                  <label className="form-label">Workspace Name</label>
                  <input type="text" className="input-premium" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., Apollo Launch" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="input-premium" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" required placeholder="What is this workspace about?"></textarea>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-premium" disabled={isSubmitting} style={{ flex: 1 }}>
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="spinner-container"><div className="spinner"></div></div>
        ) : projects.length === 0 ? (
          <div className="glass-panel empty-state-panel">
            <div className="empty-state-emoji">🌌</div>
            <h3 className="empty-state-title">Your workspace is empty</h3>
            <p className="empty-state-text">Create your first project to start managing tasks with AI.</p>
            <button className="btn-premium" onClick={() => setShowForm(true)}>Create Workspace</button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <Link to={`/project/${project.id}`} key={project.id} className="project-card">
                <div className="glass-panel">
                  <h3 className="project-name">{project.projectName}</h3>
                  <p className="project-description">
                    {project.description}
                  </p>
                  <div className="project-footer">
                    <span className="project-role">{project.memberCount} Member{project.memberCount !== 1 ? 's' : ''}</span>
                    <span className="enter-workspace-link">
                      Enter Workspace <span>→</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
