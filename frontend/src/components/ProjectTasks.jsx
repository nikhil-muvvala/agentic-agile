import React, { useState, useEffect, useContext, useCallback, memo } from 'react';
import api from '../services/api';
import TaskDetailsModal from './TaskDetailsModal';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ---------------------------------------------------------
// Extracted & Memoized Components
// ---------------------------------------------------------
const isUrgentTask = (targetDate, status) => {
  if (!targetDate || status === 'done') return false;
  const target = new Date(targetDate);
  const today = new Date();
  target.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return target <= today;
};

const TaskCard = memo(({ task, onTaskClick }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('taskStatus', task.status);
    e.dataTransfer.setData('taskAssigneeId', task.assignee?.id || '');
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="glass-panel task-card-hover" 
      style={{ 
        padding: '1.25rem', 
        background: 'rgba(255, 255, 255, 0.03)', 
        border: '1px solid rgba(255, 255, 255, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
        cursor: 'grab',
        position: 'relative' 
      }}
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
        {task.description?.length > 50 ? task.description.substring(0, 50) + '...' : task.description}
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 'auto', gap: '0.5rem' }}>
        {task.targetDate && (() => {
          const urgent = isUrgentTask(task.targetDate, task.status);
          return (
            <span style={{ 
              fontSize: '0.75rem', 
              color: urgent ? '#fca5a5' : 'var(--text-primary)',
              background: urgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              padding: '0.2rem 0.5rem', borderRadius: '4px',
              border: urgent ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
              display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '500',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              🎯 Target Date: {new Date(task.targetDate).toLocaleDateString()}
            </span>
          );
        })()}
        
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', flexShrink: 0 }}
          onClick={() => onTaskClick(task.id)}
        >
          View Details
        </button>
      </div>
    </div>
  );
});

const KanbanColumn = memo(({ title, items, statusValue, onDrop, onTaskClick }) => {
  const handleDragOver = (e) => {
    e.preventDefault(); // Required to allow dropping
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const taskStatus = e.dataTransfer.getData('taskStatus');
    const taskAssigneeId = e.dataTransfer.getData('taskAssigneeId');
    if (taskId) onDrop(parseInt(taskId, 10), statusValue, taskStatus, taskAssigneeId);
  };

  return (
    <div 
      className="glass-panel" 
      style={{ 
        flex: 1, 
        padding: '1.5rem', 
        background: 'rgba(0, 0, 0, 0.2)', 
        border: '1px solid rgba(255, 255, 255, 0.03)',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column'
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h4 style={{ 
        marginBottom: '1.5rem', textAlign: 'center', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
        paddingBottom: '1rem', color: 'var(--text-primary)',
        fontWeight: '700', letterSpacing: '0.5px'
      }}>{title} <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>({items.length})</span></h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.map(task => (
          <TaskCard key={task.id} task={task} onTaskClick={onTaskClick} />
        ))}
        {items.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Drop tasks here</div>}
      </div>
    </div>
  );
});
// ---------------------------------------------------------

const ProjectTasks = ({ projectId, userRole }) => {
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isAgentEnabled, setIsAgentEnabled] = useState(true);
  
  const [isPredictingDeadline, setIsPredictingDeadline] = useState(false);
  const [isSuggestingAssignee, setIsSuggestingAssignee] = useState(false);
  
  const [members, setMembers] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // AI Standup state
  const [showStandupModal, setShowStandupModal] = useState(false);
  const [standupSummary, setStandupSummary] = useState(null);
  const [isGeneratingStandup, setIsGeneratingStandup] = useState(false);

  // Custom Confirm Modal state
  const [confirmMove, setConfirmMove] = useState(null);

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
      toast.error(err.response?.data?.message || 'Error fetching tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
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
      // Wait for socket to update list, or fetch manually as backup
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Optimistic UI for Drag and Drop
  const handleDrop = useCallback(async (taskId, newStatus, currentStatus, taskAssigneeId) => {
    
    if (userRole !== 'admin' && userRole !== 'project_admin') {
      // 1. Cannot drag someone else's task
      if (taskAssigneeId && parseInt(taskAssigneeId) !== user.id) {
         toast.error("Forbidden: You cannot move tasks assigned to other members.");
         return;
      }
      
      // 2. Linear Progression Rules
      const strictOrder = ['todo', 'in_progress', 'done', 'blocked'];
      const currentIndex = strictOrder.indexOf(currentStatus);
      const targetIndex = strictOrder.indexOf(newStatus);

      if (targetIndex < currentIndex) {
         toast.error("Forbidden: Only Admins can move tasks backwards.");
         return;
      }

      // 3. Prompt members before executing valid forward moves
      if (targetIndex > currentIndex) {
         setConfirmMove({ taskId, newStatus });
         return; // Pause execution and wait for modal
      }
    }

    executeDrop(taskId, newStatus);
  }, [projectId, userRole, user.id]);

  const executeDrop = async (taskId, newStatus) => {
    setConfirmMove(null);
    // 1. Optimistic Update (Instant snap)
    setTasks(prevTasks => {
      return prevTasks.map(t => {
        if (t.id === taskId) {
          return { ...t, status: newStatus };
        }
        return t;
      });
    });

    // 2. Network Request
    try {
      await api.patch(`/tasks/${projectId}/t/${taskId}/status`, { status: newStatus });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error updating status');
      fetchTasks(); 
    }
  };

  const handlePredictDeadline = async () => {
    if (!title) return toast.error("Please enter a task title first!");
    try {
      setIsPredictingDeadline(true);
      const res = await api.post(`/tasks/${projectId}/predict-deadline`, { title, description });
      const days = res.data.predictedDays || 3;
      
      // Calculate future date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      setTargetDate(futureDate.toISOString().split('T')[0]); // Format YYYY-MM-DD
      toast.success(`AI predicted ${days} days for this task!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error predicting deadline');
    } finally {
      setIsPredictingDeadline(false);
    }
  };

  const handleSuggestAssignee = async () => {
    if (!title) return toast.error("Please enter a task title first!");
    try {
      setIsSuggestingAssignee(true);
      const res = await api.post(`/tasks/${projectId}/suggest-assignee`, { title, description });
      if (res.data.assigneeId) {
        if (res.data.assigneeId === -1) {
          toast.error("No related user found. Not enough project history to suggest an assignee!");
        } else {
          setAssigneeId(res.data.assigneeId.toString());
          toast.success("AI successfully suggested the best assignee!");
        }
      }
    } catch (err) {
      toast.error('No related user found. Not enough data for the AI to make a suggestion.');
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
      toast.error(err.response?.data?.message || 'Error generating Standup');
      setShowStandupModal(false);
    } finally {
      setIsGeneratingStandup(false);
    }
  };

  const handleTaskClick = useCallback((taskId) => {
    setSelectedTaskId(taskId);
  }, []);

  const formatMemberName = (member) => {
    if (!member || !member.user) return 'Unassigned';
    let displayName = member.user.name;
    if (member.user.id === user.id) displayName += " (Me)";
    else if (member.role === 'admin') displayName += " (Admin)";
    else if (member.role === 'project_admin') displayName += " (Project Admin)";
    return `${displayName} - ${member.user.email}`;
  };

  if (loading) return <div className="spinner-container"><div className="spinner"></div></div>;

  const sortedMembers = [...members].sort((a, b) => {
    if (a.user.id === user.id) return -1;
    if (b.user.id === user.id) return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    if (a.role === 'project_admin' && b.role !== 'project_admin') return -1;
    if (b.role === 'project_admin' && a.role !== 'project_admin') return 1;
    return a.user.name.localeCompare(b.user.name);
  });

  const todo = tasks.filter(t => t.status === 'todo');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const blocked = tasks.filter(t => t.status === 'blocked');
  const done = tasks.filter(t => t.status === 'done');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Tasks Board</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* AI Analyst Toggle Pill */}
          {(userRole === 'admin' || userRole === 'project_admin') && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '0.75rem', 
              background: 'rgba(255, 255, 255, 0.03)', 
              padding: '0.6rem 1.2rem', borderRadius: '30px', 
              border: '1px solid rgba(139, 92, 246, 0.3)',
              boxShadow: isAgentEnabled ? '0 0 10px rgba(139, 92, 246, 0.2)' : 'none',
              cursor: 'pointer'
            }} 
            title="Enable Event-Driven AI to monitor task changes, find solutions for blockers, and recommend new assignments when developers finish tasks."
            onClick={() => setIsAgentEnabled(!isAgentEnabled)}>
              <span style={{ fontSize: '1.2rem' }}>🤖</span>
              <span style={{ fontSize: '1rem', color: isAgentEnabled ? '#c4b5fd' : 'var(--text-secondary)', fontWeight: '600' }}>
                AI Event Manager
              </span>
              
              {/* Pill Switch */}
              <div style={{ 
                width: '44px', height: '24px', borderRadius: '12px', 
                background: isAgentEnabled ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'all 0.3s ease'
              }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '2px', left: isAgentEnabled ? '22px' : '2px',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}></div>
              </div>
            </div>
          )}

          {/* Analyze Last 24 Hrs Button */}
          <button 
            className="btn-premium" 
            onClick={handleGenerateStandup}
            disabled={isGeneratingStandup}
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', padding: '0.7rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem' }}
          >
            {isGeneratingStandup ? 'Generating...' : '✨ Analyze Last 24 Hrs'}
          </button>

          {/* New Task Button */}
          {(userRole === 'admin' || userRole === 'project_admin') && (
            <button className="btn-premium" onClick={() => setShowForm(!showForm)} style={{ background: 'linear-gradient(135deg, #6d28d9, #4c1d95)', padding: '0.7rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem' }}>
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
                  {sortedMembers.map(m => (
                    <option key={m.user?.id} value={m.user?.id}>{formatMemberName(m)}</option>
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
                  min={new Date().toISOString().split('T')[0]} 
                  style={{ flex: 1, colorScheme: 'dark' }}
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

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginTop: '0.5rem' }} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <KanbanColumn title="To Do" items={todo} statusValue="todo" onDrop={handleDrop} onTaskClick={handleTaskClick} />
        <KanbanColumn title="In Progress" items={inProgress} statusValue="in_progress" onDrop={handleDrop} onTaskClick={handleTaskClick} />
        <KanbanColumn title="Done" items={done} statusValue="done" onDrop={handleDrop} onTaskClick={handleTaskClick} />
        <KanbanColumn title="Blocked" items={blocked} statusValue="blocked" onDrop={handleDrop} onTaskClick={handleTaskClick} />
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
      {/* Custom Confirm Modal */}
      {confirmMove && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>Confirm Move</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Are you sure you want to move this task forward? Only Admins can move tasks backwards to a previous state.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setConfirmMove(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => executeDrop(confirmMove.taskId, confirmMove.newStatus)}
              >
                Yes, Move It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectTasks;
