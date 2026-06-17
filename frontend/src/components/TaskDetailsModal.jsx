import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { SocketContext } from '../context/SocketContext';

const TaskDetailsModal = ({ projectId, taskId, onClose, userRole, members }) => {
  const { user } = useContext(AuthContext);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newSubtask, setNewSubtask] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [selectedAiSuggestions, setSelectedAiSuggestions] = useState(new Set());

  const formatMemberName = (member) => {
    if (!member || !member.user) return 'Unassigned';
    let displayName = member.user.name;
    if (member.user.id === user.id) displayName += " (Me)";
    else if (member.role === 'admin') displayName += " (Admin)";
    else if (member.role === 'project_admin') displayName += " (Project Admin)";
    return `${displayName} - ${member.user.email}`;
  };

  const sortedMembers = members ? [...members].sort((a, b) => {
    if (a.user.id === user.id) return -1;
    if (b.user.id === user.id) return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    if (a.role === 'project_admin' && b.role !== 'project_admin') return -1;
    if (b.role === 'project_admin' && a.role !== 'project_admin') return 1;
    return a.user.name.localeCompare(b.user.name);
  }) : [];

  const socket = useContext(SocketContext);

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  useEffect(() => {
    if (!socket) return;

    const handleSubtaskCreated = (newSubtask) => {
      console.log("WebSocket Event Received: subtask_created", newSubtask);
      if (newSubtask.taskId !== taskId) return;
      setTask(prev => {
        if (!prev) return prev;
        if (prev.subtasks?.find(s => s.id === newSubtask.id)) return prev;
        return { ...prev, subtasks: [...(prev.subtasks || []), newSubtask] };
      });
    };

    const handleSubtaskUpdated = (updatedSubtask) => {
      console.log("WebSocket Event Received: subtask_updated", updatedSubtask);
      if (updatedSubtask.taskId !== taskId) return;
      setTask(prev => {
        if (!prev) return prev;
        return { ...prev, subtasks: prev.subtasks.map(s => s.id === updatedSubtask.id ? updatedSubtask : s) };
      });
    };

    const handleSubtaskDeleted = (data) => {
      console.log("WebSocket Event Received: subtask_deleted", data);
      if (data.taskId !== taskId) return;
      setTask(prev => {
        if (!prev) return prev;
        return { ...prev, subtasks: prev.subtasks.filter(s => s.id !== data.subtaskId) };
      });
    };

    const handleAttachmentAdded = (newAttachment) => {
      console.log("WebSocket Event Received: task_attachment", newAttachment);
      if (newAttachment.taskId !== taskId) return;
      setTask(prev => {
        if (!prev) return prev;
        if (prev.attachments?.find(a => a.id === newAttachment.id)) return prev;
        return { ...prev, attachments: [...(prev.attachments || []), newAttachment] };
      });
    };

    const handleAttachmentDeleted = (data) => {
      console.log("WebSocket Event Received: delete_attachment", data);
      if (data.taskId !== taskId) return;
      setTask(prev => {
        if (!prev) return prev;
        return { ...prev, attachments: prev.attachments.filter(a => a.id !== data.attachmentId) };
      });
    };

    const handleSubtasksBatchCreated = (newSubtasksArray) => {
      console.log("WebSocket Event Received: subtasks_created_batch", newSubtasksArray);
      if (!newSubtasksArray || newSubtasksArray.length === 0) return;
      if (newSubtasksArray[0].taskId !== taskId) return;
      
      setTask(prev => {
        if (!prev) return prev;
        const existingIds = new Set(prev.subtasks?.map(s => s.id) || []);
        const toAdd = newSubtasksArray.filter(s => !existingIds.has(s.id));
        return { ...prev, subtasks: [...(prev.subtasks || []), ...toAdd] };
      });
    };

    socket.on("subtask_created", handleSubtaskCreated);
    socket.on("subtasks_created_batch", handleSubtasksBatchCreated);
    socket.on("subtask_updated", handleSubtaskUpdated);
    socket.on("subtask_deleted", handleSubtaskDeleted);
    socket.on("task_attachment", handleAttachmentAdded);
    socket.on("delete_attachment", handleAttachmentDeleted);

    return () => {
      socket.off("subtask_created", handleSubtaskCreated);
      socket.off("subtasks_created_batch", handleSubtasksBatchCreated);
      socket.off("subtask_updated", handleSubtaskUpdated);
      socket.off("subtask_deleted", handleSubtaskDeleted);
      socket.off("task_attachment", handleAttachmentAdded);
      socket.off("delete_attachment", handleAttachmentDeleted);
    };
  }, [socket, taskId]);

  const fetchTaskDetails = async () => {
    try {
      const response = await api.get(`/tasks/${projectId}/t/${taskId}`);
      setTask(response.data.task);
    } catch (err) {
      console.error(err);
      alert('Failed to load task details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm("Are you sure you want to completely delete this task? This cannot be undone.")) return;
    try {
      await api.delete(`/tasks/${projectId}/t/${taskId}`);
      onClose(); // Close modal, the websocket will remove it from the board
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting task');
    }
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    try {
      await api.post(`/projects/${projectId}/t/${taskId}/subtasks`, { title: newSubtask });
      setNewSubtask('');
      // fetchTaskDetails() removed because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding subtask');
    }
  };

  const handleToggleSubtask = async (subtaskId, currentStatus) => {
    try {
      await api.patch(`/projects/${projectId}/t/${taskId}/subtasks/${subtaskId}/status`, { isCompleted: !currentStatus });
      // fetchTaskDetails() removed because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    if (!window.confirm("Delete this subtask?")) return;
    try {
      await api.delete(`/projects/${projectId}/t/${taskId}/subtasks/${subtaskId}`);
      // fetchTaskDetails() removed because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting subtask');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingFile(true);
      // We must explicitly override Content-Type so Axios lets the browser set the boundary for multipart/form-data
      await api.post(`/tasks/${projectId}/t/${taskId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // fetchTaskDetails() removed because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error uploading file');
    } finally {
      setUploadingFile(false);
      // Reset input
      e.target.value = null;
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm("Delete this file? This cannot be undone.")) return;
    try {
      await api.delete(`/tasks/${projectId}/t/${taskId}/attachments/${attachmentId}`);
      // fetchTaskDetails() removed because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting file');
    }
  };

  const handleAssigneeChange = async (newAssigneeId) => {
    try {
      await api.patch(`/tasks/${projectId}/t/${taskId}`, { 
        assigneeId: newAssigneeId ? parseInt(newAssigneeId) : null 
      });
      fetchTaskDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating assignee');
    }
  };

  const handleGenerateAIBreakdown = async (retry = false) => {
    try {
      setIsGenerating(true);
      const payload = retry ? { previousSuggestions: aiSuggestions } : {};
      const res = await api.post(`/tasks/${projectId}/t/${taskId}/ai-breakdown/generate`, payload);
      setAiSuggestions(res.data.subtasks);
      setSelectedAiSuggestions(new Set(res.data.subtasks)); // Select all by default
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating AI subtasks');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleAiSuggestion = (sub) => {
    setSelectedAiSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sub)) newSet.delete(sub);
      else newSet.add(sub);
      return newSet;
    });
  };

  const handleSaveAIBreakdown = async () => {
    if (selectedAiSuggestions.size === 0) return;
    try {
      setIsGenerating(true);
      await api.post(`/tasks/${projectId}/t/${taskId}/ai-breakdown/save`, { subtasks: Array.from(selectedAiSuggestions) });
      setAiSuggestions([]);
      setSelectedAiSuggestions(new Set());
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving AI subtasks');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) return null; // Or a spinner

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div className="glass-panel" style={{ width: '90%', maxWidth: '600px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
        >
          &times;
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingRight: '2rem', marginTop: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{task.title}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{task.description}</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            {(userRole === 'admin' || userRole === 'project_admin') && (
              <button 
                onClick={handleDeleteTask}
                className="btn"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', marginBottom: '0.5rem' }}
              >
                Delete Task
              </button>
            )}
            
            {task.targetDate && (
              <span style={{ 
                fontSize: '0.8rem', 
                color: new Date(task.targetDate) < new Date() && task.status !== 'done' ? '#fca5a5' : 'var(--text-secondary)',
                background: new Date(task.targetDate) < new Date() && task.status !== 'done' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                padding: '0.2rem 0.6rem', borderRadius: '4px',
                border: new Date(task.targetDate) < new Date() && task.status !== 'done' ? '1px solid rgba(239, 68, 68, 0.5)' : 'none'
              }}>
                🎯 Due: {new Date(task.targetDate).toLocaleDateString()}
              </span>
            )}
            <span style={{ 
              background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', 
              padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' 
            }}>
              {task.status.replace('_', ' ').toUpperCase()}
            </span>

            {(userRole === 'admin' || userRole === 'project_admin') ? (
              <select 
                className="form-input" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-primary)', width: 'auto' }}
                value={task.assignee?.id || ''}
                onChange={(e) => handleAssigneeChange(e.target.value)}
              >
                <option value="">Unassigned</option>
                {sortedMembers.map(m => (
                  <option key={m.user?.id} value={m.user?.id}>{formatMemberName(m)}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Assigned to: {task.assignee ? formatMemberName(members?.find(m => m.user?.id === task.assignee.id)) : 'Unassigned'}
              </span>
            )}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', marginBottom: '1.5rem' }} />

        <h3 style={{ marginBottom: '1rem' }}>Subtasks</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {task.subtasks && task.subtasks.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No subtasks yet.</p>}
          {task.subtasks && task.subtasks.map(sub => (
            <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--border-radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: sub.isCompleted ? 0.5 : 1 }}>
                <input 
                  type="checkbox" 
                  checked={sub.isCompleted} 
                  onChange={() => handleToggleSubtask(sub.id, sub.isCompleted)}
                  style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                />
                <span style={{ textDecoration: sub.isCompleted ? 'line-through' : 'none' }}>{sub.title}</span>
              </div>
              {(userRole === 'admin' || userRole === 'project_admin') && (
                <button onClick={() => handleDeleteSubtask(sub.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
              )}
            </div>
          ))}
        </div>

        {(userRole === 'admin' || userRole === 'project_admin') && (
          <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Add a new subtask..." 
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Add</button>
            
            {/* The AI Breakdown Button */}
            <button 
              type="button" 
              onClick={() => handleGenerateAIBreakdown(false)} 
              disabled={isGenerating} 
              className="btn" 
              style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.5rem 1rem' }}
            >
              {isGenerating && aiSuggestions.length === 0 ? 'Thinking...' : '✨ AI Breakdown'}
            </button>
          </form>
        )}

        {/* AI Preview Panel */}
        {aiSuggestions.length > 0 && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--accent-primary)', background: 'rgba(139, 92, 246, 0.05)' }}>
            <h4 style={{ margin: 0, marginBottom: '1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ✨ AI Breakdown Preview
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {aiSuggestions.map((sub, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedAiSuggestions.has(sub)} 
                    onChange={() => handleToggleAiSuggestion(sub)}
                    style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                  />
                  <span>{sub}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => handleSaveAIBreakdown()} 
                disabled={isGenerating || selectedAiSuggestions.size === 0}
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.5rem' }}
              >
                {isGenerating ? 'Saving...' : 'Save Selected'}
              </button>
              <button 
                onClick={() => handleGenerateAIBreakdown(true)} 
                disabled={isGenerating}
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.5rem' }}
              >
                {isGenerating ? 'Thinking...' : 'Regenerate ↻'}
              </button>
            </div>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', marginBottom: '1.5rem' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Attachments</h3>
          
          {/* Permission Logic: Allowed if unassigned, OR if uploader is assignee, OR if uploader is admin/project_admin */}
          {(!task.assignee || task.assignee.id === user.id || userRole === 'admin' || userRole === 'project_admin') && (
            <div style={{ position: 'relative' }}>
              <input 
                type="file" 
                id="file-upload" 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
                disabled={uploadingFile}
              />
              <label 
                htmlFor="file-upload" 
                className="btn btn-secondary" 
                style={{ cursor: uploadingFile ? 'wait' : 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                {uploadingFile ? 'Uploading...' : '+ Upload File'}
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {task.attachments && task.attachments.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No files attached.</p>}
          {task.attachments && task.attachments.map(file => (
            <div key={file.id} className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <a 
                  href={file.fileUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.9rem', wordBreak: 'break-all' }}
                >
                  {file.fileName.length > 25 ? file.fileName.substring(0, 25) + '...' : file.fileName}
                </a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                {(userRole === 'admin' || userRole === 'project_admin' || userRole === 'member') && (
                  <button onClick={() => handleDeleteAttachment(file.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default TaskDetailsModal;
