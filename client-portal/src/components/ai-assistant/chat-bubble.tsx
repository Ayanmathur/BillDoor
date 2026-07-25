'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import './chat-bubble.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I can help you look up customer info, bills, appointments, and revenue data. Just ask!',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickActions = [
    { label: "📊 Today's Revenue", query: "Show today's revenue summary" },
    { label: '👥 Search Customer', query: 'List my recent customers' },
    { label: '📄 Recent Bills', query: 'Show my recent bills' },
    { label: '💰 Expenses', query: 'Show my monthly expenses' },
    { label: '📅 Appointments', query: "Check today's appointment schedule" },
    { label: '➕ Create Bill', query: 'How do I create a new bill?' },
  ];

  const handleQuickClick = (query: string) => {
    if (loading) return;
    setInputValue(query);
    handleSendWithQuery(query);
  };

  const handleSendWithQuery = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: queryText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch');
      }

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response || 'I checked your business records.',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try asking again in a moment.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    handleSendWithQuery(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const renderFormattedContent = (text: string) => {
    // Simple markdown link parser: [Text](URL)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const label = match[1];
      const url = match[2];
      parts.push(
        <a
          key={match.index}
          href={url}
          onClick={(e) => {
            if (url.startsWith('/')) {
              e.preventDefault();
              window.location.href = url;
            }
          }}
          className="chat-action-link"
        >
          {label} →
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <>
      {!isOpen && (
        <button className="chat-bubble-btn" onClick={() => setIsOpen(true)} title="BillDoor AI Assistant">
          <MessageCircle size={24} />
        </button>
      )}

      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} />
              <span>BillDoor Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-msg ${msg.role}`}>
                {renderFormattedContent(msg.content)}
              </div>
            ))}

            {/* Quick Action Suggestion Boxes */}
            {messages.length <= 2 && !loading && (
              <div className="chat-quick-actions">
                <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                  RECOMMENDED QUICK ACTIONS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {quickActions.map((qa, i) => (
                    <button
                      key={i}
                      className="chat-chip-btn"
                      onClick={() => handleQuickClick(qa.query)}
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Ask about revenue, bills, or customers..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button onClick={handleSend} disabled={loading || !inputValue.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
