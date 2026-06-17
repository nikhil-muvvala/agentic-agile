import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useContext(AuthContext); // We need the user/token to connect

  useEffect(() => {
    // Only connect if the user is logged in and we have a token
    const token = localStorage.getItem('token');
    
    if (user && token) {
      // 1. Initialize the socket connection
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const newSocket = io(BACKEND_URL, {
        auth: { token }
      });

      // 2. Set up basic connection listeners for debugging
      newSocket.on('connect', () => {
        console.log('✅ Connected to WebSockets!');
      });

      newSocket.on('connect_error', (err) => {
        console.error('❌ WebSocket Connection Error:', err.message);
      });

      setSocket(newSocket);

      // Cleanup: disconnect when the user logs out or the component unmounts
      return () => {
        newSocket.disconnect();
      };
    } else if (socket) {
      // If user logs out, kill the socket
      socket.disconnect();
      setSocket(null);
  }}, [user?.id]);
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
