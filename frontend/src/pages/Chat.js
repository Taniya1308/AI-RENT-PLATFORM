import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useWebSocket } from '../hooks/useWebSocket';
import api from '../utils/api';

export default function Chat() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef(null);

  const handleWsMessage = useCallback((data) => {
    if (data.type === 'new_message') {
      const msg = data.message;
      // Only append if it belongs to active conversation
      setMessages(prev => {
        if (prev.length > 0 && prev[0].conversation_id === msg.conversation_id) {
          // Avoid duplicates (REST + WS)
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });
      // Update last message in conversation list
      setConversations(prev => prev.map(c =>
        c.id === msg.conversation_id ? { ...c, last_message: msg.content, last_message_at: msg.created_at } : c
      ));
    }
  }, []);

  const { connected, send } = useWebSocket(handleWsMessage);

  useEffect(() => {
    api.get('/chat/conversations')
      .then(data => setConversations(data.conversations))
      .catch(err => addToast(err.message, 'error'))
      .finally(() => setLoadingConvs(false));
  }, [addToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function openConversation(conv) {
    setActiveConv(conv);
    setLoadingMsgs(true);
    try {
      const data = await api.get(`/chat/conversations/${conv.id}/messages`);
      setMessages(data.messages);
      // Mark as read via WS
      send({ type: 'mark_read', conversation_id: conv.id });
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !activeConv) return;

    const content = input.trim();
    setInput('');

    // Optimistic UI: add message immediately via REST and also send via WS
    try {
      if (connected) {
        send({ type: 'send_message', conversation_id: activeConv.id, content });
      } else {
        // Fallback to REST
        const data = await api.post(`/chat/conversations/${activeConv.id}/messages`, { content });
        setMessages(prev => [...prev, data.message]);
        setConversations(prev => prev.map(c =>
          c.id === activeConv.id ? { ...c, last_message: content } : c
        ));
      }
    } catch (err) {
      addToast(err.message, 'error');
      setInput(content); // Restore on error
    }
  }

  return (
    <div className="chat-page">
      {/* Sidebar: conversation list */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Messages</h2>
          <span className={`ws-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>

        {loadingConvs ? (
          <div className="chat-loading">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="chat-empty">
            <p>No conversations yet.</p>
            <p>Accept an interest request to start chatting.</p>
          </div>
        ) : (
          <div className="conversation-list">
            {conversations.map(conv => {
              const isActive = activeConv?.id === conv.id;
              const otherName = user.role === 'tenant' ? conv.owner_name : conv.tenant_name;
              return (
                <button
                  key={conv.id}
                  className={`conversation-item ${isActive ? 'active' : ''} ${conv.unread_count > 0 ? 'unread' : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <div className="conv-avatar">{otherName?.charAt(0).toUpperCase()}</div>
                  <div className="conv-info">
                    <div className="conv-header">
                      <span className="conv-name">{otherName}</span>
                      {conv.unread_count > 0 && (
                        <span className="unread-badge">{conv.unread_count}</span>
                      )}
                    </div>
                    <span className="conv-listing">{conv.listing_title}</span>
                    {conv.last_message && (
                      <span className="conv-last-msg">{conv.last_message}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main: message area */}
      <div className="chat-main">
        {!activeConv ? (
          <div className="chat-placeholder">
            <span>💬</span>
            <h3>Select a conversation</h3>
            <p>Choose a conversation from the left to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="conv-avatar large">
                {(user.role === 'tenant' ? activeConv.owner_name : activeConv.tenant_name)?.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{user.role === 'tenant' ? activeConv.owner_name : activeConv.tenant_name}</strong>
                <span className="chat-listing-name">{activeConv.listing_title}</span>
              </div>
            </div>

            <div className="messages-area">
              {loadingMsgs ? (
                <div className="chat-loading">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="chat-empty-msgs">No messages yet. Say hello!</div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-meta">
                        <span className="message-sender">{isMine ? 'You' : msg.sender_name}</span>
                        <span className="message-time">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="chat-input-bar">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                className="chat-input"
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
