import React, { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = ({ whiteboardId, socket, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    console.log("🔧 Setting up sidebar listeners");

    // Listen for initial whiteboard data
    const handleWhiteboardData = (data) => {
      console.log("👥 Received initial users:", data.users);
      setUsers(data.users);
    };

    // Listen for user joined - only update if it's not current user
    const handleUserJoined = (data) => {
      console.log("👤 User joined:", data.user);
      setUsers(prev => {
        // Filter out any existing instance of this user and add the new one
        const filtered = prev.filter(user => user.id !== data.user.id);
        return [...filtered, data.user];
      });
    };

    // Listen for user left
    const handleUserLeft = (data) => {
      console.log("👤 User left:", data.userId);
      setUsers(data.users);
    };

    // Listen for messages
    const handleChatMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };

    // Set up listeners
    socket.on('whiteboard-data', handleWhiteboardData);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('chat-message', handleChatMessage);

    return () => {
      socket.off('whiteboard-data', handleWhiteboardData);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('chat-message', handleChatMessage);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket || !whiteboardId) return;
    
    const message = { 
      user: currentUser.name, 
      text: input,
      color: currentUser.color,
      timestamp: Date.now()
    };
    
    socket.emit('chat-message', {
      whiteboardId,
      message
    });
    
    setInput('');
  };

  return (
    <div className="sidebar">
      <div className="user-camera">
        <div className="camera-placeholder">
          📹 {currentUser.name}
          {whiteboardId && (
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              Room: {whiteboardId}
            </div>
          )}
        </div>
      </div>

      <div className="users-list">
        <h4>Online ({users.length})</h4>
        {users.map((user, index) => (
          <div key={user.id || `user-${index}`} className="user-item">
            <span className="user-color" style={{ backgroundColor: user.color }} />
            <span className="user-name">
              {user.name} {user.id === currentUser.id ? '(You)' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="chat-section">
        <h4>Chat</h4>
        <div className="chat-messages">
          {messages.map((msg, i) => {
            const isMine = msg.user === currentUser.name;
            return (
              <div key={i} className={`message-bubble ${isMine ? 'mine' : ''}`}>
                <div className="bubble-content">
                  <span className="message-user" style={{ color: msg.color || '#fff' }}>
                    {msg.user}
                  </span>
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input">
          <input
            type="text"
            placeholder="Napisz wiadomość..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage}>➤</button>
        </div>
      </div>

      <div className="notes-section">
        <h4>Notatki</h4>
        <textarea placeholder="Dodaj notatkę..." />
      </div>
    </div>
  );
};

export default Sidebar;