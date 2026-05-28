import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import Navbar from '../components/Navbar';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

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
    try {
      await api.post('/projects/project-creation', { name, description });
      setName('');
      setDescription('');
      setShowForm(false);
      fetchProjects(); // Refresh the list
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating project');
    }
  };

  return (
    <div>
      <Navbar />
      <main className="container" style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Your Projects</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Project'}
          </button>
        </div>

        {showForm && (
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" required></textarea>
              </div>
              <button type="submit" className="btn btn-primary">Create</button>
            </form>
          </div>
        )}

        {loading ? (
          <p>Loading projects...</p>
        ) : projects.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>You don't have any projects yet. Create one to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {projects.map((project) => (
              <div key={project.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>{project.projectName}</h3>
                <p style={{ flex: 1, color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  {project.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{project.memberCount} Member(s)</span>
                  <Link to={`/project/${project.id}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
