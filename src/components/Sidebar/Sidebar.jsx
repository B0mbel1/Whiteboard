import React, { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = ({ socket, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionStates, setConnectionStates] = useState({});
  
  const videoRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const streamRef = useRef(null);
  const peerConnections = useRef({}); 
  const iceCandidatesQueue = useRef({});

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // 1. Inicjalizacja kamery (na start)
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

        // Wycisz lokalnie
        mediaStream.getAudioTracks().forEach(track => track.enabled = false);
        mediaStream.getVideoTracks().forEach(track => track.enabled = false);

        streamRef.current = mediaStream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = true;
        }

        // Jeśli połączenia już trwają, podmień ścieżki (dla płynności)
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

      } catch (err) {
        console.error("❌ Błąd kamery:", err);
        if (mounted) {
            if (err.name === 'NotReadableError') {
                setCameraError("Kamera zajęta (zamknij inną kartę).");
            } else if (err.name === 'NotAllowedError') {
                setCameraError("Brak uprawnień.");
            } else {
                setCameraError("Błąd kamery.");
            }
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
      // Unikaj duplikatów
      if (peerConnections.current[socketId]) return peerConnections.current[socketId];

      console.log(`🛠️ Tworzenie PeerConnection dla ${socketId}`);
      const pc = new RTCPeerConnection(rtcConfig);

      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE State [${socketId}]: ${pc.iceConnectionState}`);
        setConnectionStates(prev => ({...prev, [socketId]: pc.iceConnectionState}));
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
        console.log(`🎥 Otrzymano Track od ${socketId}:`, event.track.kind);
        
        // Tworzymy strumień od razu, żeby React mógł go "zapiąć" do video
        const remoteStream = (event.streams && event.streams[0]) 
            ? event.streams[0] 
            : new MediaStream([event.track]);
            
        setRemoteStreams(prev => ({
            ...prev,
            [socketId]: remoteStream
        }));
      };

      // Dodajemy tracki lub puste transceivery (rezerwacja miejsca)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
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

    // --- Listenery Socketowe ---

    // 1. Gdy wchodzimy: pobieramy listę i DZWONIMY do wszystkich
    const handleWhiteboardData = (data) => {
        const others = data.users.filter(u => u.id !== socket.id);
        setUsers(others);

        // Ty (nowy) dzwonisz do starych. Dzięki temu połączenie nawiązuje się od razu.
        others.forEach(user => {
            initiateCall(user.id);
        });
    };

    // 2. Gdy ktoś inny wchodzi: tylko dodajemy go do listy UI (on zadzwoni do nas)
    const handleUserJoined = async (data) => {
      console.log("👤 User joined:", data.user.id);
      if (data.user.id === socket.id) return;

      setUsers(prev => {
         const exists = prev.find(u => u.id === data.user.id);
         if(exists) return prev;
         return [...prev, data.user];
      });
    };

    // 3. Gdy ktoś wychodzi: sprzątamy
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
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
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
    <div className="sidebar">
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
        <button 
            className="camera-toggle-btn" 
            onClick={toggleCamera}
            disabled={!!cameraError}
            style={{ opacity: cameraError ? 0.5 : 1 }}
        >
          {cameraError ? 'Kamera niedostępna' : (cameraOn ? 'Wyłącz kamerę' : 'Włącz kamerę')}
        </button>
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
                   <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                      <span>Łączenie...</span>
                      <span style={{fontSize:'10px', marginTop:'5px', color:'#95a5a6'}}>
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
  );
};

// Komponent Video - Wymusza odtwarzanie i aktualizację
const RemoteVideo = ({ stream }) => {
  const ref = useRef();
  
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      // Wymuszamy play, w razie gdyby przeglądarka zatrzymała autoplay
      ref.current.play().catch(e => console.log("Play error (expected if background):", e));
    }
  }, [stream]);

  return (
    <video 
      ref={ref} 
      autoPlay 
      playsInline 
      className="remote-video"
      key={stream.id} // Klucz wymusza re-render przy zmianie ID strumienia
    />
  );
};

export default Sidebar;