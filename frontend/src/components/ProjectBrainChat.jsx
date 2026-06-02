import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import './ProjectBrainChat.css'; // We will create this

const ProjectBrainChat = ({ projectId, isOpen, setIsOpen }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsgText = input.trim();
        setInput('');

        // Append user message instantly
        const updatedMessages = [...messages, { role: 'user', text: userMsgText }];
        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            // Map the history for Gemini format
            const geminiHistory = updatedMessages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                text: msg.text
            }));

            const response = await api.post(`/projects/${projectId}/brain/chat`, {
                question: userMsgText,
                history: geminiHistory
            });

            // Append AI response and sources
            setMessages(prev => [
                ...prev,
                { 
                    role: 'model', 
                    text: response.data.answer, 
                    sources: response.data.sources 
                }
            ]);

        } catch (err) {
            console.error("Project Brain Error:", err);
            setMessages(prev => [
                ...prev,
                { role: 'model', text: "Error: I couldn't connect to the Project Brain. Please try again later." }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {isOpen ? (
                <div className="project-brain-sidebar">
                    <div className="project-brain-header">
                        <h3>🧠 Project Brain</h3>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
                    </div>
                
                <div className="project-brain-messages">
                    {messages.length === 0 && (
                        <div className="brain-empty-state">
                            <p>Ask me anything about the project history, architectural decisions, or completed tasks!</p>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-bubble-container ${msg.role}`}>
                            <div className={`chat-bubble ${msg.role}`}>
                                <p>{msg.text}</p>
                            </div>
                            
                            {/* Render Citations if AI has sources */}
                            {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                                <div className="chat-sources">
                                    <span className="source-label">Sources:</span>
                                    {msg.sources.map((src, i) => (
                                        <span key={i} className="source-pill">
                                            {src.type === 'task_completion' ? '📘 Task' : '📝 Note'} #{src.id}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="chat-bubble-container model">
                            <div className="chat-bubble model loading-bubble">
                                <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="project-brain-input-area" onSubmit={handleSendMessage}>
                    <input 
                        type="text" 
                        placeholder="Ask the Project Brain..." 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()}>
                        Send
                    </button>
                </form>
                </div>
            ) : (
                <button className="project-brain-fab" onClick={() => setIsOpen(true)}>
                    🧠
                </button>
            )}
        </>
    );
};

export default ProjectBrainChat;
