import React, { useEffect, useState, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';

const AiToast = () => {
    const socket = useContext(SocketContext);
    const { user } = useContext(AuthContext);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!socket) return;

        // Listen for the specific AI Agent event
        const handleAiAlert = (data) => {

            console.log("🤖 AI Advisor Alert Received:", data);
            setToast(data);
            
            // Auto-hide after 15 seconds so it doesn't stay on screen forever
            setTimeout(() => setToast(null), 15000);
        };

        socket.on("ai_advisor_alert", handleAiAlert);

        return () => socket.off("ai_advisor_alert", handleAiAlert);
    }, [socket]);

    if (!toast) return null;

    return (
        <div className="glass-panel" style={{
            position: 'fixed', bottom: '110px', right: '30px', zIndex: 10000,
            width: '350px', padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            animation: 'slideIn 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                <h4 style={{ margin: 0, color: 'var(--accent-primary)' }}>AI Advisor</h4>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {toast.message}
            </p>
            <button 
                onClick={() => setToast(null)}
                className="btn btn-secondary" 
                style={{ marginTop: '15px', width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
            >
                Dismiss
            </button>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AiToast;
