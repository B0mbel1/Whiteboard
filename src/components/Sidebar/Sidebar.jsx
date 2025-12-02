import React, { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = ({ whiteboardId, socket, currentUser }) => {
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);

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
    </div>
  );
};

export default Sidebar;
