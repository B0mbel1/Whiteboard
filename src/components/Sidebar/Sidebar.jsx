import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './Sidebar.css';

const Sidebar = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const [stream, setStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false); // Domyślnie wyłączona
  const videoRef = useRef(null);
  const socket = useRef(null);
  const messagesEndRef = useRef(null);

  const [currentUser] = useState(() => ({
    name: 'User' + Math.floor(Math.random() * 1000),
    color: `hsl(${Math.random() * 360}, 80%, 60%)`
  }));

  // 🔹 Inicjalizacja socket.io i pobranie listy użytkowników
  useEffect(() => {
    socket.current = io('http://localhost:3001');

    socket.current.emit('join', currentUser);

    socket.current.on('users', (userList) => {
      setUsers(userList);
    });

    socket.current.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.current.disconnect();
    };
  }, [currentUser]);

  // 🔹 Obsługa kamery
 useEffect(() => {
    // Pobranie strumienia z kamerki
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        // Od razu wyłączamy track wideo
        mediaStream.getVideoTracks().forEach(track => track.enabled = false);

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Nie udało się uruchomić kamerki:", err));

    // Sprzątanie przy unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 🔹 Auto scroll do najnowszej wiadomości
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔹 Wysyłanie wiadomości
  const sendMessage = () => {
    if (!input.trim()) return;
    const message = { user: currentUser.name, text: input };
    socket.current.emit('chat-message', message);
    setInput('');
  };

  // 🔹 Włączanie/wyłączanie kamery
  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setCameraOn(prev => !prev);
    }
  };


  return (
    <div className="sidebar">
      {/* Kamera użytkownika */}
      <div className="user-camera">
        <video ref={videoRef} autoPlay playsInline className="camera-video" />
        <button className="camera-toggle-btn" onClick={toggleCamera}>
          {cameraOn ? 'Wyłącz kamerę' : 'Włącz kamerę'}
        </button>
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
          {messages.map((msg, i) => {
            const isMine = msg.user === currentUser.name;
            const userColor =
              users.find((u) => u.name === msg.user)?.color || '#fff';
            return (
              <div key={i} className={`message-bubble ${isMine ? 'mine' : ''}`}>
                <div className="bubble-content">
                  <span className="message-user" style={{ color: userColor }}>
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

      {/* Notatki */}
      <div className="notes-section">
        <h4>Notatki</h4>
        <textarea placeholder="Dodaj notatkę..." />
      </div>
    </div>
  );
};

export default Sidebar;
