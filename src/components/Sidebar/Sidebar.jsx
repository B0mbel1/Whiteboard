import React from 'react';
import './Sidebar.css';

const Sidebar = () => {
  const users = [
    { name: 'User1', color: '#ff0000' },
    { name: 'User2', color: '#00ff00' },
    { name: 'User3', color: '#0000ff' }
  ];

  return (
    <div className="sidebar">
      {/* Kamera użytkownika */}
      <div className="user-camera">
        <div className="camera-placeholder">
          📹 Twoja kamera
        </div>
      </div>

      {/* Lista użytkowników */}
      <div className="users-list">
        <h4>Online ({users.length})</h4>
        {users.map((user, index) => (
          <div key={index} className="user-item">
            <span 
              className="user-color" 
              style={{ backgroundColor: user.color }}
            />
            <span className="user-name">{user.name}</span>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="chat-section">
        <h4>Chat</h4>
        <div className="chat-messages">
          <div className="message">User1: Cześć!</div>
          <div className="message">User2: Hej, jak tam rysowanie?</div>
        </div>
        <div className="chat-input">
          <input type="text" placeholder="Napisz wiadomość..." />
          <button>➤</button>
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