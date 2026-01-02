import React, { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = ({ socket, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionStates, setConnectionStates] = useState({});

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

        mediaStream.getAudioTracks().forEach(track => track.enabled = false);
        mediaStream.getVideoTracks().forEach(track => track.enabled = false);

        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = true;
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
          track.stop();
          mediaStream.removeTrack(track);
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
      if (streamRef.current) {
        const audioTracks = streamRef.current.getAudioTracks();
        audioTracks.forEach(track => {
          track.stop();
          streamRef.current.removeTrack(track);
        });
      }
      setMicOn(false);
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newAudioTrack = newStream.getAudioTracks()[0];

        if (streamRef.current) {
          streamRef.current.addTrack(newAudioTrack);
        }

        Object.values(peerConnections.current).forEach((pc) => {
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
    if (!socket || !currentUser) return;

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

    // Tworzymy połączenie używając SOCKET ID, bo to jest adres sieciowy
    const createPeerConnection = (socketId) => {
      if (peerConnections.current[socketId]) return peerConnections.current[socketId];

      console.log(`🛠️ Tworzenie PeerConnection dla SOCKET: ${socketId}`);
      const pc = new RTCPeerConnection(rtcConfig);

      pc.oniceconnectionstatechange = () => {
        setConnectionStates(prev => ({ ...prev, [socketId]: pc.iceConnectionState }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: socketId // Wysyłamy do Socket ID
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = (event.streams && event.streams[0])
          ? event.streams[0]
          : new MediaStream([event.track]);

        setRemoteStreams(prev => ({
          ...prev,
          [socketId]: remoteStream // Mapujemy strumień do Socket ID
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

    // 🟢 ZMIANA: initiateCall przyjmuje teraz targetSocketId
    const initiateCall = async (targetSocketId) => {
      console.log(`📞 Dzwonię do SOCKET: ${targetSocketId}`);
      const pc = createPeerConnection(targetSocketId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call-user", { offer: pc.localDescription, to: targetSocketId });
      } catch (err) { console.error("Offer Error:", err); }
    };

    const handleWhiteboardData = (data) => {
      const others = data.users.filter(u => u.id !== currentUser.id);
      setUsers(others);

      // 🟢 ZMIANA KLUCZOWA: Dzwonimy używając user.socketId, a nie user.id
      others.forEach(user => {
        if (user.socketId) {
          initiateCall(user.socketId);
        }
      });
    };

    const handleUserJoined = async (data) => {
      if (data.user.id === currentUser.id) return;
      setUsers(prev => {
        const exists = prev.find(u => u.id === data.user.id);
        if (exists) return prev;
        return [...prev, data.user];
      });
      // Uwaga: Zazwyczaj joiner dzwoni do reszty (handleWhiteboardData), więc tu nie musimy inicjować
    };

    const handleUserLeft = (data) => {
      // data.userId w zdarzeniu user-left z serwera to Socket ID (według server.js)
      // Ale my filtrujemy listę wyświetlania po persistent ID.
      
      // 1. Znajdź użytkownika, który wychodzi, żeby upewnić się co do jego socketId
      // (W przypadku server.js, logicznie userId przy disconnect to socket.id, ale sprawdźmy to)
      const leftSocketId = data.userId; // Z serwera przychodzi socket.id jako userId przy disconnect

      // 2. Wyczyść połączenia WebRTC używając Socket ID
      if (peerConnections.current[leftSocketId]) {
        peerConnections.current[leftSocketId].close();
        delete peerConnections.current[leftSocketId];
      }
      delete iceCandidatesQueue.current[leftSocketId];

      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[leftSocketId];
        return newStreams;
      });
      setConnectionStates(prev => {
        const newStates = { ...prev };
        delete newStates[leftSocketId];
        return newStates;
      });

      // 3. Aktualizuj listę UI (tu musimy filtrować po czymś co mamy)
      // Ponieważ serwer wysyła nową listę 'users' w tym zdarzeniu, po prostu jej użyjmy:
      setUsers(data.users.filter(u => u.id !== currentUser.id));
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
  }, [socket, currentUser]);

  useEffect(() => {
    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
    }
  }, []);

  return (
    <>
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
                {/* 🟢 ZMIANA KLUCZOWA: Szukamy strumienia po user.socketId, a nie user.id */}
                {remoteStreams[user.socketId] ? (
                  <RemoteVideo stream={remoteStreams[user.socketId]} />
                ) : (
                  <div className="video-placeholder">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span>Łączenie...</span>
                      <span style={{ fontSize: '10px', marginTop: '5px', color: '#95a5a6' }}>
                        Stan: {connectionStates[user.socketId] || 'init'}
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