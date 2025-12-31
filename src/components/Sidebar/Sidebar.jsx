import React, { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = ({ socket, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionStates, setConnectionStates] = useState({});

  // 🔹 Stan zwinięcia panelu
  const [collapsed, setCollapsed] = useState(false);

  const videoRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [micOn, setMicOn] = useState(false);

  const streamRef = useRef(null);
  const peerConnections = useRef({});
  const iceCandidatesQueue = useRef({});

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // 1. Inicjalizacja kamery
  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      setCameraError(null);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        if (!mounted) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        // Domyślnie wyłączamy oba ślady (startujemy "po cichu" i bez wizji)
        mediaStream.getAudioTracks().forEach(track => track.enabled = false);
        mediaStream.getVideoTracks().forEach(track => track.enabled = false);

        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = true; // Lokalne wideo zawsze wyciszone, żeby nie słyszeć siebie
        }

        Object.keys(peerConnections.current).forEach(socketId => {
          const pc = peerConnections.current[socketId];
          const videoTrack = mediaStream.getVideoTracks()[0];
          const audioTrack = mediaStream.getAudioTracks()[0];

          pc.getTransceivers().forEach(transceiver => {
            if (transceiver.receiver.track.kind === 'video' && videoTrack && transceiver.sender) {
              transceiver.sender.replaceTrack(videoTrack).catch(e => console.error("Video replace err:", e));
            }
            if (transceiver.receiver.track.kind === 'audio' && audioTrack && transceiver.sender) {
              transceiver.sender.replaceTrack(audioTrack).catch(e => console.error("Audio replace err:", e));
            }
          });
        });

        const audioTracks = mediaStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.stop(); // Fizyczne zatrzymanie
          mediaStream.removeTrack(track); // Usuwamy z obiektu streamu
        });
        setMicOn(false);

      } catch (err) {
        console.error("❌ Błąd kamery/mikrofonu:", err);
        if (mounted) {
          setCameraError("Brak dostępu do urządzeń.");
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleCamera = () => {
    if (cameraError) {
      alert(cameraError);
      return;
    }
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
      }
    }
  };
  const toggleMic = async () => {
    if (micOn) {
      // 🔴 WYŁĄCZANIE (Fizyczne odcięcie)
      if (streamRef.current) {
        const audioTracks = streamRef.current.getAudioTracks();
        audioTracks.forEach(track => {
          track.stop(); // To sprawia, że dioda nagrywania gaśnie
          streamRef.current.removeTrack(track); // Usuwamy ślad
        });
      }
      setMicOn(false);
    } else {
      // 🟢 WŁĄCZANIE (Nowe żądanie dostępu)
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newAudioTrack = newStream.getAudioTracks()[0];

        if (streamRef.current) {
          streamRef.current.addTrack(newAudioTrack);
        }

        // Aktualizujemy ścieżkę we wszystkich połączeniach
        Object.values(peerConnections.current).forEach((pc) => {
          const senders = pc.getSenders();
          // Szukamy sendera odpowiedzialnego za audio
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio')
            || senders.find(s => !s.track && s.transport); // Czasem sender ma track null po stop()

          // Alternatywnie szukamy po transcieverze, co jest pewniejsze
          const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'audio');

          if (transceiver && transceiver.sender) {
            transceiver.sender.replaceTrack(newAudioTrack).catch(err => console.error("Replace Track Err:", err));
          }
        });

        setMicOn(true);
      } catch (err) {
        console.error("Błąd włączania mikrofonu:", err);
        alert("Nie udało się aktywować mikrofonu. Sprawdź uprawnienia.");
      }
    }
  };
  // 2. Logika WebRTC
  useEffect(() => {
    if (!socket) return;

    const processIceQueue = async (socketId, pc) => {
      const queue = iceCandidatesQueue.current[socketId];
      if (queue && queue.length > 0) {
        for (const candidate of queue) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("ICE candidate error:", e);
          }
        }
        iceCandidatesQueue.current[socketId] = [];
      }
    };



    const createPeerConnection = (socketId) => {
      if (peerConnections.current[socketId]) return peerConnections.current[socketId];

      console.log(`🛠️ Tworzenie PeerConnection dla ${socketId}`);
      const pc = new RTCPeerConnection(rtcConfig);

      pc.oniceconnectionstatechange = () => {
        setConnectionStates(prev => ({ ...prev, [socketId]: pc.iceConnectionState }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: socketId
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = (event.streams && event.streams[0])
          ? event.streams[0]
          : new MediaStream([event.track]);

        setRemoteStreams(prev => ({
          ...prev,
          [socketId]: remoteStream
        }));
      };

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
      } 
      if (!streamRef.current || streamRef.current.getAudioTracks().length === 0) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }
      if (!streamRef.current || streamRef.current.getVideoTracks().length === 0) {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }

      peerConnections.current[socketId] = pc;
      return pc;
    };

    const initiateCall = async (targetUserId) => {
      console.log(`📞 Dzwonię do: ${targetUserId}`);
      const pc = createPeerConnection(targetUserId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call-user", { offer: pc.localDescription, to: targetUserId });
      } catch (err) { console.error("Offer Error:", err); }
    };

    const handleWhiteboardData = (data) => {
      const others = data.users.filter(u => u.id !== socket.id);
      setUsers(others);
      others.forEach(user => initiateCall(user.id));
    };

    const handleUserJoined = async (data) => {
      if (data.user.id === socket.id) return;
      setUsers(prev => {
        const exists = prev.find(u => u.id === data.user.id);
        if (exists) return prev;
        return [...prev, data.user];
      });
    };

    const handleUserLeft = (data) => {
      const leftUserId = data.userId;
      setUsers(data.users.filter(u => u.id !== socket.id));

      if (peerConnections.current[leftUserId]) {
        peerConnections.current[leftUserId].close();
        delete peerConnections.current[leftUserId];
      }
      delete iceCandidatesQueue.current[leftUserId];

      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[leftUserId];
        return newStreams;
      });
      setConnectionStates(prev => {
        const newStates = { ...prev };
        delete newStates[leftUserId];
        return newStates;
      });
    };

    const handleCallMade = async (data) => {
      const pc = createPeerConnection(data.socket);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await processIceQueue(data.socket, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("make-answer", { answer, to: data.socket });
      } catch (err) { console.error("Answer Error:", err); }
    };

    const handleAnswerMade = async (data) => {
      const pc = peerConnections.current[data.socket];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processIceQueue(data.socket, pc);
        } catch (err) { console.error("RemoteDesc Error:", err); }
      }
    };

    const handleIceCandidate = async (data) => {
      const pc = peerConnections.current[data.socket];
      if (pc) {
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { }
        } else {
          if (!iceCandidatesQueue.current[data.socket]) iceCandidatesQueue.current[data.socket] = [];
          iceCandidatesQueue.current[data.socket].push(data.candidate);
        }
      }
    };

    socket.on('whiteboard-data', handleWhiteboardData);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on("call-made", handleCallMade);
    socket.on("answer-made", handleAnswerMade);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off('whiteboard-data', handleWhiteboardData);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('call-made', handleCallMade);
      socket.off('answer-made', handleAnswerMade);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
    }
  }, []);

  return (
    <>
      {/* 🔹 PRZYCISK ZWIJANIA (ZAKŁADKA) */}
      <div
        className={`sidebar-toggle ${collapsed ? 'collapsed' : ''}`}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Pokaż kamery' : 'Ukryj kamery'}
      >
        <span className="arrow">➤</span>
      </div>

      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="user-camera local-camera">
          <div className="video-container" style={{ position: 'relative', minHeight: '150px', background: '#000', borderRadius: '6px' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
              style={{ display: cameraError ? 'none' : 'block' }}
            />
            {cameraError && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#e74c3c', padding: '10px', textAlign: 'center', fontSize: '12px',
                flexDirection: 'column'
              }}>
                <span style={{ fontSize: '20px', marginBottom: '5px' }}>🚫</span>
                {cameraError}
              </div>
            )}
          </div>
          <div className="controls-row">
            <button
              className={`control-btn ${cameraOn ? 'active' : ''}`}
              onClick={toggleCamera}
              disabled={!!cameraError}
              title="Włącz/Wyłącz kamerę"
            >
              {cameraOn ? '📷 Włączona' : '📷 Wyłączona'}
            </button>

            <button
              className={`control-btn ${micOn ? 'active' : ''}`}
              onClick={toggleMic}
              disabled={!!cameraError}
              title="Włącz/Wyłącz mikrofon"
            >
              {micOn ? '🎤 Włączony' : '🎤 Wyłączony'}
            </button>
          </div>
        </div>

        <div className="remote-users-section">
          <h4>Inni uczestnicy ({users.length})</h4>
          <div className="remote-videos-grid">
            {users.map((user) => (
              <div key={user.id} className="remote-video-wrapper">
                {remoteStreams[user.id] ? (
                  <RemoteVideo stream={remoteStreams[user.id]} />
                ) : (
                  <div className="video-placeholder">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span>Łączenie...</span>
                      <span style={{ fontSize: '10px', marginTop: '5px', color: '#95a5a6' }}>
                        Stan: {connectionStates[user.id] || 'init'}
                      </span>
                    </div>
                  </div>
                )}
                <span className="remote-user-name">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

const RemoteVideo = ({ stream }) => {
  const ref = useRef();
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(e => console.log("Play error:", e));
    }
  }, [stream]);

  return <video ref={ref} autoPlay playsInline className="remote-video" key={stream.id} />;
};

export default Sidebar;