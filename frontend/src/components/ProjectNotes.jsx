import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { SocketContext } from '../context/SocketContext';

const ProjectNotes = ({ projectId, userRole }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const socket = useContext(SocketContext);

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewNote = (data) => {
      console.log("WebSocket Event Received: new_note", data);
      setNotes(prev => {
        if (prev.find(n => n.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    const handleUpdateNote = (data) => {
      console.log("WebSocket Event Received: notes_update", data);
      setNotes(prev => prev.map(n => 
        n.id === data.noteId ? { ...n, ...data } : n
      ));
    };

    const handleDeleteNoteEvent = (data) => {
      console.log("WebSocket Event Received: delete_note", data);
      setNotes(prev => prev.filter(n => n.id !== data.noteId));
    };

    socket.on("new_note", handleNewNote);
    socket.on("notes_update", handleUpdateNote);
    socket.on("delete_note", handleDeleteNoteEvent);

    return () => {
      socket.off("new_note", handleNewNote);
      socket.off("notes_update", handleUpdateNote);
      socket.off("delete_note", handleDeleteNoteEvent);
    };
  }, [socket]);

  const fetchNotes = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/notes`);
      setNotes(response.data.notes || []);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error fetching notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/notes`, { title, content });
      setTitle('');
      setContent('');
      setShowForm(false);
      // Removed fetchNotes() because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if(!window.confirm("Delete this note?")) return;
    try {
      await api.delete(`/projects/${projectId}/notes/${noteId}`);
      // Removed fetchNotes() because socket handles it
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting note');
    }
  };

  if (loading) return <p>Loading notes...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3>Project Notes</h3>
        {userRole === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Note'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <form onSubmit={handleCreateNote}>
            <div className="form-group">
              <label className="form-label">Note Title</label>
              <input 
                type="text" 
                className="form-input" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="e.g., Meeting Summary"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Content</label>
              <textarea 
                className="form-input" 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                rows="4" 
                placeholder="Write your note here..."
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Save Note</button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {notes.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No notes yet.</p>}
        {notes.map(note => (
          <div key={note.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>{note.title}</h4>
            <p style={{ whiteSpace: 'pre-wrap', flex: 1, marginBottom: '1rem' }}>{note.content}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>{new Date(note.createdAt).toLocaleDateString()}</span>
              {userRole === 'admin' && (
                <button onClick={() => handleDeleteNote(note.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectNotes;
