import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import TaskDetailsModal from './TaskDetailsModal';
import { SocketContext } from '../context/SocketContext';

const ProjectTasks = ({ projectId, userRole }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isAgentEnabled, setIsAgentEnabled] = useState(true);
  
  const [isPredictingDeadline, setIsPredictingDeadline] = useState(false);
  const [isSuggestingAssignee, setIsSuggestingAssignee] = useState(false);
  
  const [members, setMembers] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [isGeneratingStandup, setIsGeneratingStandup] = useState(false);
  const [standupSummary, setStandupSummary] = useState(null);
  const [showStandupModal, setShowStandupModal] = useState(false);

  const socket = useContext(SocketContext);

  // Initial Fetch & Room Join
  useEffect(() => {
    fetchTasks();
    fetchMembers();

    if (socket) {
      socket.emit("join_project_room", projectId);

      return () => {
        socket.emit("leave_project_room", projectId);
      };
    }
  }, [projectId, socket]);

  // Real-time Event Listeners
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdated = (data) => {
      console.log("WebSocket Event Received: task_updated", data);
      setTasks(prevTasks => prevTasks.map(t => {
        if (t.id === data.taskId) {
           let updatedTask = { ...t };
           if (data.newStatus) updatedTask.status = data.newStatus;
           if (data.updatedFields) {
               updatedTask = { ...updatedTask, ...data.updatedFields };
               if (data.updatedFields.assigneeId !== undefined) {
                   if (data.updatedFields.assigneeId === null) {
                       updatedTask.assignee = null;
                   } else {
                       const member = members.find(m => m.user?.id === data.updatedFields.assigneeId);
                       if (member) updatedTask.assignee = member.user;
                   }
               }
           }
           return updatedTask;
        }
        return t;
      }));
    };

    const handleTaskCreated = (data) => {
      console.log("WebSocket Event Received: task_created", data);
      const newTask = { ...data.task };
      if (newTask.assigneeId) {
          const member = members.find(m => m.user?.id === newTask.assigneeId);
          if (member) newTask.assignee = member.user;
      }
      setTasks(prev => {
        if (prev.find(t => t.id === newTask.id)) return prev;
        return [...prev, newTask];
      });
    };

    const handleTaskDeleted = (data) => {
      console.log("WebSocket Event Received: task_deleted", data);
      setTasks(prev => prev.filter(t => t.id !== data.taskId));
    };

    socket.on("task_updated", handleTaskUpdated);
    socket.on("task_created", handleTaskCreated);
    socket.on("task_deleted", handleTaskDeleted);

    return () => {
      socket.off("task_updated", handleTaskUpdated);
      socket.off("task_created", handleTaskCreated);
      socket.off("task_deleted", handleTaskDeleted);
    };
  }, [socket, members]);

  const fetchMembers = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error('Failed to fetch members for assignees');
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get(`/tasks/${projectId}`);
      setTasks(response.data.tasks || []);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error fetching tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const payload = { title, description, isAgentEnabled };
      if (assigneeId) payload.assigneeId = parseInt(assigneeId);
      if (targetDate) payload.targetDate = targetDate;
      
      await api.post(`/tasks/${projectId}`, payload);
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setTargetDate('');
      setShowForm(false);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${projectId}/t/${taskId}/status`, { status: newStatus });
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating status');
    }
  };

  const handlePredictDeadline = async () => {
    if (!title) return alert("Please enter a task title first!");
    try {
      setIsPredictingDeadline(true);
      const res = await api.post(`/tasks/${projectId}/predict-deadline`, { title, description });
      const days = res.data.predictedDays || 3;
      
      // Calculate future date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      setTargetDate(futureDate.toISOString().split('T')[0]); // Format YYYY-MM-DD
    } catch (err) {
      alert(err.response?.data?.message || 'Error predicting deadline');
    } finally {
      setIsPredictingDeadline(false);
    }
  };

  const handleSuggestAssignee = async () => {
    if (!title) return alert("Please enter a task title first!");
    if (members.length === 0) return alert("No members in project!");
    try {
      setIsSuggestingAssignee(true);
      const res = await api.post(`/tasks/${projectId}/suggest-assignee`, { title, description, members });
      if (res.data.assigneeId) {
        setAssigneeId(res.data.assigneeId.toString());
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error suggesting assignee');
    } finally {
      setIsSuggestingAssignee(false);
    }
  };

  const handleGenerateStandup = async () => {
    try {
      setIsGeneratingStandup(true);
      setShowStandupModal(true);
      const res = await api.get(`/tasks/${projectId}/ai-standup`);
      setStandupSummary(res.data.summary);
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating Standup');
      setShowStandupModal(false);
    } finally {
      setIsGeneratingStandup(false);
    }
  };

  if (loading) return <p>Loading tasks...</p>;

  // Group tasks for Kanban board
  const todo = tasks.filter(t => t.status === 'todo');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const done = tasks.filter(t => t.status === 'done');

  const KanbanColumn = ({ title, items, statusValue }) => (
    <div className="glass-panel" style={{ flex: 1, padding: '1rem', background: 'rgba(30, 41, 59, 0.4)' }}>
      <h4 style={{ marginBottom: '1rem', textAlign: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>{title} ({items.length})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.map(task => (
          <div 
            key={task.id || task.title} 
            className="glass-panel" 
            style={{ padding: '1rem', background: 'var(--bg-secondary)', transition: 'transform 0.2s', position: 'relative' }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <h5 style={{ margin: 0, color: 'var(--accent-primary)' }}>{task.title}</h5>
              <span style={{ 
                fontSize: '0.7rem', 
                background: task.assignee ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)', 
                color: task.assignee ? '#60a5fa' : 'var(--text-muted)',
                padding: '0.1rem 0.4rem', borderRadius: '4px' 
              }}>
                {task.assignee ? task.assignee.name : 'Unassigned'}
              </span>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description}
            </p>
            
            {task.targetDate && (
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: new Date(task.targetDate) < new Date() && task.status !== 'done' ? '#fca5a5' : 'var(--text-secondary)',
                  background: new Date(task.targetDate) < new Date() && task.status !== 'done' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  padding: '0.2rem 0.5rem', borderRadius: '4px',
                  border: new Date(task.targetDate) < new Date() && task.status !== 'done' ? '1px solid rgba(239, 68, 68, 0.5)' : 'none',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  🎯 Due: {new Date(task.targetDate).toLocaleDateString()}
                </span>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <select 
                className="form-input" 
                style={{ padding: '0.3rem', fontSize: '0.75rem', background: 'var(--bg-primary)', width: 'auto' }}
                value={statusValue}
                onChange={(e) => handleStatusChange(task.id, e.target.value)}
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setSelectedTaskId(task.id)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No tasks here</div>}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3>Tasks Board</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {(userRole === 'admin' || userRole === 'project_admin') && (
            <div 
              onClick={() => setIsAgentEnabled(!isAgentEnabled)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer',
                background: isAgentEnabled ? 'rgba(139, 92, 246, 0.15)' : 'rgba(30,41,59,0.5)', 
                padding: '0.5rem 1rem', borderRadius: '30px', 
                border: `1px solid ${isAgentEnabled ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.05)'}`, 
                transition: 'all 0.3s ease' 
              }}
            >
              <span style={{ 
                fontSize: '1.2rem', 
                filter: isAgentEnabled ? 'drop-shadow(0 0 5px rgba(139, 92, 246, 0.8))' : 'grayscale(100%)',
                transition: 'filter 0.3s ease'
              }}>🤖</span>
              <span style={{ 
                fontSize: '0.85rem', 
                fontWeight: isAgentEnabled ? '600' : '400', 
                color: isAgentEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                transition: 'all 0.3s ease'
              }}>
                AI Analyst
              </span>
              
              {/* Custom CSS Toggle Switch */}
              <div style={{ 
                width: '36px', height: '20px', borderRadius: '10px', 
                background: isAgentEnabled ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', 
                position: 'relative', transition: 'background 0.3s ease' 
              }}>
                <div style={{ 
                  position: 'absolute', top: '2px', 
                  left: isAgentEnabled ? '18px' : '2px', 
                  width: '16px', height: '16px', borderRadius: '50%', 
                  background: 'white', 
                  transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
                }} />
              </div>
            </div>
          )}
          <button 
            onClick={handleGenerateStandup} 
            disabled={isGeneratingStandup} 
            className="btn" 
            style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.5rem 1rem' }}
          >
            ✨ Generate Standup
          </button>
          {(userRole === 'admin' || userRole === 'project_admin') && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ New Task'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label className="form-label">Task Title</label>
              <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} rows="2"></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="form-input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.user?.id} value={m.user?.id}>{m.user?.name}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={handleSuggestAssignee} 
                  disabled={isSuggestingAssignee}
                  style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }}
                >
                  {isSuggestingAssignee ? '...' : '✨ Suggest'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Target Date / Deadline</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="date" 
                  className="form-input" 
                  value={targetDate} 
                  onChange={(e) => setTargetDate(e.target.value)} 
                  min={new Date().toISOString().split('T')[0]} // Prevents picking past dates
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  className="btn" 
                  onClick={handlePredictDeadline} 
                  disabled={isPredictingDeadline}
                  style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }}
                >
                  {isPredictingDeadline ? '...' : '✨ Predict'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginTop: '0.5rem' }}>Create Task</button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <KanbanColumn title="To Do" items={todo} statusValue="todo" />
        <KanbanColumn title="In Progress" items={inProgress} statusValue="in_progress" />
        <KanbanColumn title="Done" items={done} statusValue="done" />
      </div>

      {selectedTaskId && (
        <TaskDetailsModal 
          projectId={projectId} 
          taskId={selectedTaskId} 
          onClose={() => {
            setSelectedTaskId(null);
            fetchTasks(); // Refresh board so new assignees show up instantly
          }} 
          userRole={userRole} 
          members={members}
        />
      )}

      {/* AI Daily Standup Modal */}
      {showStandupModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '600px', padding: '2rem', position: 'relative' }}>
            <button 
              onClick={() => { setShowStandupModal(false); setStandupSummary(null); }} 
              style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              &times;
            </button>
            <h3 style={{ color: 'var(--accent-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ✨ Daily Standup Summary
            </h3>
            {isGeneratingStandup ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Analyzing team activity from the last 24 hours...</p>
                <div style={{ color: 'var(--accent-primary)', fontSize: '1.5rem' }}>⏳</div>
              </div>
            ) : (
              <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '1.5rem', borderRadius: 'var(--border-radius)', borderLeft: '4px solid var(--accent-primary)' }}>
                <p style={{ lineHeight: '1.6', color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>
                  {standupSummary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectTasks;
