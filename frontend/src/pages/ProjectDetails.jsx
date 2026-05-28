import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import ProjectTasks from '../components/ProjectTasks';
import ProjectMembers from '../components/ProjectMembers';
import ProjectNotes from '../components/ProjectNotes';
import ProjectSettings from '../components/ProjectSettings';
import Navbar from '../components/Navbar';

const ProjectDetails = () => {
  const { projectId } = useParams();
  const { user } = useContext(AuthContext);
  
  const [project, setProject] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'notes', 'members'

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      const response = await api.get(`/projects/project-details/${projectId}`);
      setProject(response.data.project);
      setUserRole(response.data.userRole);
    } catch (err) {
      console.error('Failed to fetch project details', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ marginTop: '2rem' }}>Loading project...</div>;
  }

  if (!project) {
    return (
      <div className="container" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <h2>Project not found</h2>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem', textDecoration: 'none' }}>Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div>
      <Navbar 
        extraRightContent={
          <span style={{ 
            padding: '0.2rem 0.6rem', 
            borderRadius: '4px', 
            background: 'var(--accent-primary)', 
            fontSize: '0.8rem',
            color: 'white'
          }}>
            {userRole}
          </span>
        }
      />

      <main className="container" style={{ marginTop: '3rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>&larr; Back</Link>
            <h2 style={{ margin: 0 }}>{project.name}</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginLeft: '3.5rem' }}>{project.description}</p>
        </div>

        {/* Custom Tab Navigation */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-light)', marginBottom: '2rem' }}>
          <button 
            onClick={() => setActiveTab('tasks')}
            style={{
              background: 'none', border: 'none', color: activeTab === 'tasks' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              padding: '1rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '600',
              borderBottom: activeTab === 'tasks' ? '2px solid var(--accent-primary)' : '2px solid transparent'
            }}
          >
            Tasks
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            style={{
              background: 'none', border: 'none', color: activeTab === 'members' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              padding: '1rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '600',
              borderBottom: activeTab === 'members' ? '2px solid var(--accent-primary)' : '2px solid transparent'
            }}
          >
            Members
          </button>
          <button 
            onClick={() => setActiveTab('notes')}
            style={{
              background: 'none', border: 'none', color: activeTab === 'notes' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              padding: '1rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '600',
              borderBottom: activeTab === 'notes' ? '2px solid var(--accent-primary)' : '2px solid transparent'
            }}
          >
            Notes
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            style={{
              background: 'none', border: 'none', color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              padding: '1rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '600',
              borderBottom: activeTab === 'settings' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              marginLeft: 'auto'
            }}
          >
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ paddingBottom: '4rem' }}>
          {activeTab === 'tasks' && <ProjectTasks projectId={projectId} userRole={userRole} />}
          {activeTab === 'members' && <ProjectMembers projectId={projectId} userRole={userRole} />}
          {activeTab === 'notes' && <ProjectNotes projectId={projectId} userRole={userRole} />}
          {activeTab === 'settings' && <ProjectSettings projectId={projectId} projectData={project} userRole={userRole} />}
        </div>
      </main>
    </div>
  );
};

export default ProjectDetails;
