import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';
import AiToast from './components/AiToast';
import { Toaster } from 'react-hot-toast';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { token } = useContext(AuthContext);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Public Route Wrapper (redirect to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { token } = useContext(AuthContext);
  if (token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <>
      {/* Global Animated Background */}
      <div className="animated-bg-container">
        <div className="glow-orb glow-orb-primary"></div>
        <div className="glow-orb glow-orb-secondary"></div>
      </div>
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/project/:projectId" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AiToast />
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#1e1e2e',
            color: '#fff',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }
        }}/>
      </div>
    </>
  );
}

export default App;
