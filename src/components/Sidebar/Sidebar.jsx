import React, { useRef, useEffect, useState } from 'react';
import './Sidebar.css';

const Sidebar = ({ whiteboardId, socket, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const messagesEndRef = useRef(null);

  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);

  // Kamera użytkownika
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(mediaStream => {
        mediaStream.getVideoTracks().forEach(track => track.enabled = false); // start off
        setStream(mediaStream);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      })
      .catch(err => console.error("Nie udało się uruchomić kamerki:", err));

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const toggleCamera = () => {
    if (!stream) return;
    stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    setCameraOn(prev => !prev);
  };

  // Socket.io: ustawienie listenerów
  useEffect(() => {
    if (!socket || !whiteboardId || !currentUser) return;

    // Dołącz do whiteboard
    socket.emit('join-whiteboard', { whiteboardId, user: currentUser });

    const handleWhiteboardData = (data) => {
      setUsers(data.users);
    };

    const handleUserJoined = (data) => {
      setUsers(prev => {
        const filtered = prev.filter(u => u.id !== data.user.id);
        return [...filtered, data.user];
      });
    };

    const handleUserLeft = (data) => {
      setUsers(data.users);
    };

    const handleChatMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };

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
  }, [socket, whiteboardId, currentUser]);

  // Auto-scroll chat
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

    socket.emit('chat-message', { whiteboardId, message });
    setInput('');
  };

  return (
    <div className="sidebar">
      {/* Kamera */}
      <div className="user-camera">
        <video ref={videoRef} autoPlay playsInline className="camera-video" />
        <button className="camera-toggle-btn" onClick={toggleCamera}>
          {cameraOn ? 'Wyłącz kamerę' : 'Włącz kamerę'}
        </button>
      </div>

      {/* Lista użytkowników */}
      <div className="users-list">
        <h4>Online ({users.length})</h4>
        {users.map((user, i) => (
          <div key={user.id || i} className="user-item">
            <span className="user-color" style={{ backgroundColor: user.color }} />
            <span className="user-name">
              {user.name} {user.id === currentUser.id ? '(You)' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Chat */}
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
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
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
