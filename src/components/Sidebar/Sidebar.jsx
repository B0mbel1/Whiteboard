import React, { useRef, useEffect, useState } from 'react';
import './Sidebar.css';

const Sidebar = () => {
  const users = [
    { name: 'User1', color: '#ff0000' },
    { name: 'User2', color: '#00ff00' },
    { name: 'User3', color: '#0000ff' }
  ];

  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false); // Domyślnie wyłączona

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        mediaStream.getVideoTracks().forEach(track => track.enabled = false);
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Nie udało się uruchomić kamerki:", err));

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="camera-video"
        />
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
          <div className="message">User1: Cześć!</div>
          <div className="message">User2: Hej, jak tam rysowanie?</div>
        </div>
        <div className="chat-input">
          <input type="text" placeholder="Napisz wiadomość..." />
          <button>➤</button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
