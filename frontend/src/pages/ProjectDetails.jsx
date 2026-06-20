import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import ProjectTasks from '../components/ProjectTasks';
import ProjectMembers from '../components/ProjectMembers';
import ProjectNotes from '../components/ProjectNotes';
import ProjectSettings from '../components/ProjectSettings';
import TopNav from '../components/TopNav';
import ProjectBrainChat from '../components/ProjectBrainChat';

const ProjectDetails = () => {
  const { projectId } = useParams();
  const { user } = useContext(AuthContext);
  
  const [project, setProject] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'notes', 'members', 'settings'
  const [isChatOpen, setIsChatOpen] = useState(false);

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
    return (
      <div className="workspace-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner-container"><div className="spinner"></div></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="workspace-layout" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>Workspace not found</h2>
        <Link to="/" className="btn-premium" style={{ textDecoration: 'none' }}>Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', '--sidebar-width': isChatOpen ? '400px' : '0px' }}>
      
      {/* Main App Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', position: 'relative' }}>
        
        <TopNav 
          extraRightContent={
            userRole && <span className="badge badge-in-progress" style={{ fontSize: '0.8rem' }}>Role: {userRole}</span>
          }
        />

        <main style={{ flex: 1, padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          <div className="project-header-glass glass-panel">
            <div className="project-title-row">
              <Link to="/" className="back-button" title="Back to Dashboard">
                &larr;
              </Link>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h2 className="text-gradient" style={{ margin: 0, fontSize: '2rem', fontWeight: '800' }}>{project.name}</h2>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)' }}>{project.description}</p>
              </div>
            </div>
          </div>

          {/* Custom Tab Navigation */}
          <div className="tabs-container">
            <button 
              onClick={() => setActiveTab('tasks')}
              className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
            >
              Tasks
            </button>
            <button 
              onClick={() => setActiveTab('members')}
              className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            >
              Members
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            >
              Notes
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`tab-btn tab-btn-right ${activeTab === 'settings' ? 'active' : ''}`}
            >
              Settings
            </button>
          </div>

          {/* Tab Content with Mount-and-Hide UI Caching */}
          <div className="tab-content-wrapper">
            <div style={{ display: activeTab === 'tasks' ? 'block' : 'none' }}>
              <ProjectTasks projectId={projectId} userRole={userRole} />
            </div>
            <div style={{ display: activeTab === 'members' ? 'block' : 'none' }}>
              <ProjectMembers projectId={projectId} userRole={userRole} />
            </div>
            <div style={{ display: activeTab === 'notes' ? 'block' : 'none' }}>
              <ProjectNotes projectId={projectId} userRole={userRole} />
            </div>
            <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
              <ProjectSettings projectId={projectId} projectData={project} userRole={userRole} />
            </div>
          </div>
        </main>
      </div>

      <ProjectBrainChat projectId={projectId} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
    </div>
  );
};

export default ProjectDetails;
