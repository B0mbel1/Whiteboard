import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import './Sidebar.css';

const Sidebar = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const [currentUser] = useState(() => {
    return {
      name: 'User' + Math.floor(Math.random() * 1000),
      color: `hsl(${Math.random() * 360}, 80%, 60%)`
    };
  });

  const socket = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.current = io('http://localhost:3001');

    // Join event
    socket.current.emit('join', currentUser);

    // Listen for users
    socket.current.on('users', (userList) => {
      setUsers(userList);
    });

    // Listen for messages
    socket.current.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.current.disconnect();
    };
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const message = { user: currentUser.name, text: input };
    socket.current.emit('chat-message', message);
    setInput('');
  };

  return (
    <div className="sidebar">
      <div className="user-camera">
        <div className="camera-placeholder">📹 Twoja kamera</div>
      </div>

      <div className="users-list">
        <h4>Online ({users.length})</h4>
        {users.map((user, index) => (
          <div key={index} className="user-item">
            <span className="user-color" style={{ backgroundColor: user.color }} />
            <span className="user-name">{user.name}</span>
          </div>
        ))}
      </div>

      <div className="chat-section">
        <h4>Chat</h4>
        <div className="chat-messages">
          {messages.map((msg, i) => {
            const isMine = msg.user === currentUser.name;
            const userColor = users.find(u => u.name === msg.user)?.color || '#fff';
            return (
              <div key={i} className={`message-bubble ${isMine ? 'mine' : ''}`}>
                <div className="bubble-content">
                  <span className="message-user" style={{ color: userColor }}>{msg.user}</span>
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