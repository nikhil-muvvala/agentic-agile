import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { SocketContext } from '../context/SocketContext';
import ConfirmModal from './ConfirmModal';

const isUrgentTask = (targetDate, status) => {
  if (!targetDate || status === 'done') return false;
  const target = new Date(targetDate);
  const today = new Date();
  target.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return target <= today;
};

const TaskDetailsModal = ({ projectId, taskId, onClose, userRole, members }) => {
  const { user } = useContext(AuthContext);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newSubtask, setNewSubtask] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [selectedAiSuggestions, setSelectedAiSuggestions] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');

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
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/tasks/${projectId}/t/${taskId}`);
      setShowDeleteConfirm(false);
      onClose(); // Close modal, the websocket will remove it from the board
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting task');
      setIsSubmitting(false);
    }
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/t/${taskId}/subtasks`, { title: newSubtask });
      setNewSubtask('');
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding subtask');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSubtask = async (subtaskId, currentStatus) => {
    try {
      await api.patch(`/projects/${projectId}/t/${taskId}/subtasks/${subtaskId}/status`, { isCompleted: !currentStatus });
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    if (!window.confirm("Delete this subtask?")) return;
    try {
      await api.delete(`/projects/${projectId}/t/${taskId}/subtasks/${subtaskId}`);
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
      await api.post(`/tasks/${projectId}/t/${taskId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Error uploading file');
    } finally {
      setUploadingFile(false);
      e.target.value = null;
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm("Delete this file? This cannot be undone.")) return;
    try {
      await api.delete(`/tasks/${projectId}/t/${taskId}/attachments/${attachmentId}`);
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

  const handleSaveDescription = async () => {
    try {
      await api.patch(`/tasks/${projectId}/t/${taskId}`, { description: editDescValue });
      setTask(prev => ({ ...prev, description: editDescValue }));
      setIsEditingDesc(false);
    } catch (err) {
      alert('Error updating description');
    }
  };

  const handleGenerateAIBreakdown = async (retry = false) => {
    try {
      setIsGenerating(true);
      const payload = retry ? { previousSuggestions: aiSuggestions } : {};
      const res = await api.post(`/tasks/${projectId}/t/${taskId}/ai-breakdown/generate`, payload);
      setAiSuggestions(res.data.subtasks);
      setSelectedAiSuggestions(new Set(res.data.subtasks));
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

  if (loading) return (
    <div className="modal-overlay">
      <div className="spinner-container"><div className="spinner"></div></div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', padding: '2.5rem', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        
        {/* TOP HEADER: Title and Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', flex: 1, wordBreak: 'break-word' }}>
            {task.title}
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            {(userRole === 'admin' || userRole === 'project_admin') && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.8rem', cursor: 'pointer', padding: '0.4rem 0.8rem', borderRadius: '6px', transition: 'all 0.2s', fontWeight: '600' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }} 
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
              >
                Delete Task
              </button>
            )}
            <button 
              onClick={onClose} 
              title="Close"
              style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '6px', padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={(e) => { e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255, 255, 255, 0.1)' }} 
              onMouseLeave={(e) => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='rgba(255, 255, 255, 0.05)' }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* DESCRIPTION */}
        <div style={{ marginBottom: '1.5rem' }}>
          {isEditingDesc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <textarea 
                className="input-premium"
                style={{ minHeight: '100px', resize: 'vertical' }}
                value={editDescValue}
                onChange={e => setEditDescValue(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-premium" onClick={handleSaveDescription}>Save</button>
                <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '8px', color: 'white', cursor: 'pointer' }} onClick={() => setIsEditingDesc(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div 
              style={{ position: 'relative', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', paddingRight: '4rem' }}
            >
              {task.description || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>No description provided.</span>}
              
              {(userRole === 'admin' || userRole === 'project_admin') && (
                <button 
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#c4b5fd', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.4)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'; e.currentTarget.style.color = '#c4b5fd'; }}
                  onClick={() => {
                    setEditDescValue(task.description || '');
                    setIsEditingDesc(true);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        {/* META TAGS (Status, Due Date, Assignee) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(0, 0, 0, 0.2)', padding: '1rem', borderRadius: '8px' }}>
          
          {/* Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
            <span style={{ 
              background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', 
              padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              {task.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Due Date Badge */}
          {task.targetDate && (() => {
            const urgent = isUrgentTask(task.targetDate, task.status);
            return (
              <>
                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Date</span>
                  <span style={{ 
                    fontSize: '0.8rem', fontWeight: 'bold',
                    color: urgent ? '#fca5a5' : 'var(--text-primary)',
                    background: urgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    padding: '0.2rem 0.6rem', borderRadius: '4px',
                    border: urgent ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    {new Date(task.targetDate).toLocaleDateString()}
                  </span>
                </div>
              </>
            );
          })()}

          {/* Assignee Selector */}
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assignee</span>
            {(userRole === 'admin' || userRole === 'project_admin') ? (
              <select 
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
                value={task.assignee?.id || ''}
                onChange={(e) => handleAssigneeChange(e.target.value)}
              >
                <option value="" style={{ background: 'var(--bg-dark)' }}>Unassigned</option>
                {sortedMembers.map(m => (
                  <option key={m.user?.id} value={m.user?.id} style={{ background: 'var(--bg-dark)' }}>{formatMemberName(m)}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {task.assignee ? formatMemberName(members?.find(m => m.user?.id === task.assignee.id)) : 'Unassigned'}
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
          <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              className="input-premium" 
              placeholder="Add a new subtask..." 
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-premium" style={{ padding: '0.5rem 1.5rem' }} disabled={isSubmitting}>
              {isSubmitting ? '...' : 'Add'}
            </button>
            
            <button 
              type="button" 
              onClick={() => handleGenerateAIBreakdown(false)} 
              disabled={isGenerating} 
              className="btn-premium" 
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              {isGenerating && aiSuggestions.length === 0 ? 'Thinking...' : '✨ AI Breakdown'}
            </button>
          </form>
        )}

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

        <ConfirmModal 
          isOpen={showDeleteConfirm}
          title="Delete Task"
          message="Are you sure you want to delete this task? This action cannot be undone and will delete all associated subtasks and attachments."
          confirmText="Delete Task"
          cancelText="Cancel"
          onConfirm={handleDeleteTask}
          onCancel={() => setShowDeleteConfirm(false)}
          isDestructive={true}
        />

      </div>
    </div>
  );
};

export default TaskDetailsModal;
