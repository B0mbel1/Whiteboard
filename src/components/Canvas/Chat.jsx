import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

const Chat = ({ socket, whiteboardId, currentUser, onClose, initialMessages = [] }) => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef(null);

  console.log("💬 Chat: Component mounted with", initialMessages.length, "initial messages");
  console.log("💬 Chat: Current user:", currentUser);
  console.log("💬 Chat: Whiteboard ID:", whiteboardId);

  useEffect(() => {
    if (!socket || !whiteboardId) {
      console.error("💬 Chat: No socket or whiteboardId");
      return;
    }

    console.log("💬 Chat: Socket initialized for whiteboard:", whiteboardId);

    // Nasłuchuj na NOWE wiadomości
    const handleChatMessage = (data) => {
      console.log("💬 Chat: Received NEW message:", data);

      if (data && data.message && data.whiteboardId === whiteboardId) {
        console.log("💬 Chat: Processing message from:", data.message.user?.name);

        setMessages(prev => {
          // Sprawdź czy wiadomość już istnieje
          const exists = prev.some(msg => msg.id === data.message.id);
          if (exists) {
            console.log("💬 Chat: Message already exists, skipping");
            return prev;
          }

          const newMessage = {
            id: data.message.id || `msg_${Date.now()}`,
            user: data.message.user || {
              id: 'unknown',
              name: 'Unknown',
              color: '#666'
            },
            text: data.message.text,
            timestamp: data.message.timestamp || new Date().toISOString()
          };

          console.log("💬 Chat: Adding new message:", newMessage.text);
          return [...prev, newMessage];
        });

        // Automatycznie przewiń
        // setTimeout(() => {
        //   messagesContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
        // }, 100);
      }
    };

    // Nasłuchuj na pełną historię chatu
    const handleChatHistory = (data) => {
      console.log("💬 Chat: Received FULL history:", data?.messages?.length || 0);

      if (data && data.whiteboardId === whiteboardId) {
        const validMessages = (data.messages || []).filter(msg =>
          msg && typeof msg === 'object' && msg.text
        ).map(msg => ({
          id: msg.id || `msg_${Date.now()}_${Math.random()}`,
          user: msg.user || { id: 'unknown', name: 'Unknown', color: '#666' },
          text: msg.text,
          timestamp: msg.timestamp || new Date().toISOString()
        }));

        console.log("💬 Chat: Setting messages to history:", validMessages.length);
        setMessages(validMessages);
      }
    };

    // Nasłuchuj na błąd
    const handleChatError = (error) => {
      console.error("💬 Chat: Socket error:", error);
    };

    // Zarejestruj nasłuchiwacze
    socket.on('chat-message', handleChatMessage);
    socket.on('chat-history', handleChatHistory);
    socket.on('error', handleChatError);

    // Proś o świeżą historię przy otwarciu chatu
    console.log("💬 Chat: Requesting fresh chat history for:", whiteboardId);
    socket.emit('get-chat-history', { whiteboardId });

    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('chat-history', handleChatHistory);
      socket.off('error', handleChatError);
    };
  }, [socket, whiteboardId, currentUser]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;

      // Przewiń kontener na sam dół (scrollHeight)
      messagesContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket || !whiteboardId) {
      console.error("💬 Chat: Cannot send - missing input, socket, or whiteboardId");
      return;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message = {
      id: messageId,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        color: currentUser.color
      },
      text: input.trim(),
      timestamp: new Date().toISOString(),
      whiteboardId
    };

    console.log("💬 Chat: Emitting chat-message:", message.text);
    console.log("💬 Chat: From user:", currentUser.name);
    console.log("💬 Chat: Socket ID:", socket.id);

    socket.emit('chat-message', {
      whiteboardId,
      message
    });

    // Dodaj wiadomość lokalnie od razu
    setMessages(prev => [...prev, message]);
    setInput('');

    // Przewiń
    // setTimeout(() => {
    //   messagesContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
    // }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const handleCloseChat = (e) => {
    e.stopPropagation();
    if (onClose) onClose();
  };

  // Sortuj wiadomości
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  console.log("💬 Chat: Rendering", sortedMessages.length, "messages");

  return (
    <div className="chat-container">
      <div className="chat-window">
        <div className="chat-header">
          <div className="chat-header-info">
            <h3>💬 Chat</h3>
            <div className="chat-message-count">
              {sortedMessages.length} Wiadomoś{sortedMessages.length !== 1 ? 'ci' : 'ć'}
            </div>
          </div>
          <button className="chat-close-btn" onClick={handleCloseChat}>
            ×
          </button>
        </div>

        <div className="chat-messages-container">
          <div className="chat-messages" ref={messagesContainerRef}>
            {sortedMessages.length === 0 ? (
              <div className="chat-empty">
                <p>💭 Brak wiadomości. Rozpocznij wiadomości!</p>
              </div>
            ) : (
              sortedMessages.map((msg, index) => {
                if (!msg || !msg.text) return null;

                const msgUser = msg.user || { id: 'unknown', name: 'Unknown', color: '#666' };
                const isCurrentUser = msgUser.id === currentUser?.id;
                const prevMsg = sortedMessages[index - 1];
                const prevMsgUser = prevMsg?.user || { id: 'unknown' };
                const isSameSender = prevMsg && prevMsgUser.id === msgUser.id;
                const showTimestamp = !isSameSender || index === 0;

                return (
                  <div
                    key={msg.id || index}
                    className={`chat-message ${isCurrentUser ? 'own' : 'other'} ${isSameSender ? 'same-sender' : ''}`}
                  >
                    {showTimestamp && !isCurrentUser && (
                      <div className="chat-message-header">
                        <span
                          className="chat-message-sender"
                          style={{ color: msgUser.color || '#666' }}
                        >
                          {msgUser.name || 'Unknown'}
                        </span>
                        <span className="chat-message-time">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    {showTimestamp && isCurrentUser && (
                      <div className="chat-message-header own-header">
                        <span className="chat-message-time">
                          {formatTime(msg.timestamp)}
                        </span>
                        <span className="chat-message-sender" style={{ color: msgUser.color }}>
                          Ty
                        </span>
                      </div>
                    )}

                    <div className="chat-message-bubble">
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            {/* <div
              ref={messagesContainerRef}
              style={{ float: "left", clear: "both", height: 0, width: 0, padding: 0, margin: 0, visibility: "hidden" }}
            /> */}
          </div>
        </div>

        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea
              className="chat-textarea"
              placeholder="Napisz wiadomość..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={1}
              maxLength={500}
            />
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!input.trim()}
              title="Wyślij wiadomość"
            >
              ➤
            </button>
          </div>
          <div className="chat-input-hint">
            Naciśnij Enter aby wysłać, Shift+Enter aby pisać w nowej linii
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;