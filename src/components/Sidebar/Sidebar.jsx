import React, { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = () => {
  const users = [
    { name: 'User1', color: '#ff0000' },
    { name: 'User2', color: '#00ff00' },
    { name: 'User3', color: '#0000ff' }
  ];

  const [messages, setMessages] = useState([
    { user: 'User1', text: 'Cześć!' },
    { user: 'User2', text: 'Hej, jak tam rysowanie?' }
  ]);

  const [input, setInput] = useState('');
  const currentUser = 'User1'; // Możesz dynamicznie ustawiać później

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (input.trim() === '') return;
    setMessages([...messages, { user: currentUser, text: input }]);
    setInput('');
  };

  return (
    <div className="sidebar">
      {/* Kamera użytkownika */}
      <div className="user-camera">
        <div className="camera-placeholder">📹 Twoja kamera</div>
      </div>

      {/* Lista użytkowników */}
      <div className="users-list">
        <h4>Online ({users.length})</h4>
        {users.map((user, index) => (
          <div key={index} className="user-item">
            <span className="user-color" style={{ backgroundColor: user.color }} />
            <span className="user-name">{user.name}</span>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="chat-section">
        <h4>Chat</h4>
        <div className="chat-messages">
          {messages.map((msg, i) => {
            const isMine = msg.user === currentUser;
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

      {/* Notki */}
      <div className="notes-section">
        <h4>Notatki</h4>
        <textarea placeholder="Dodaj notatkę..." />
      </div>
    </div>
  );
};

export default Sidebar;
