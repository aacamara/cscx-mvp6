import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CSAgentType } from '../../types/agents';

// Demo user ID for development (replaced by real auth in production)
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
const API_URL = import.meta.env.VITE_API_URL || '';

interface ChatHistoryMessage {
  id: string;
  customer_id: string | null;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_type: CSAgentType | null;
  session_id: string | null;
  created_at: string;
  customer_name?: string;
}

interface ChatHistoryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  onSelectMessage?: (message: ChatHistoryMessage) => void;
}

export const ChatHistoryDropdown: React.FC<ChatHistoryDropdownProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  onSelectMessage
}) => {
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAllChats, setShowAllChats] = useState(!customerId);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch chat history
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (!showAllChats && customerId) {
        params.append('customerId', customerId);
      }
      if (search.trim()) {
        params.append('search', search.trim());
      }
      params.append('limit', '20');

      const response = await fetch(`${API_URL}/api/chat/history?${params.toString()}`, {
        headers: {
          'x-user-id': DEMO_USER_ID
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, search, showAllChats]);

  // Fetch on open and when filters change
  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, fetchHistory]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchHistory();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (!isOpen) return null;

  // Format timestamp
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get agent icon
  const getAgentIcon = (agentType: CSAgentType | null) => {
    const icons: Record<CSAgentType, string> = {
      onboarding: '🚀',
      adoption: '📈',
      renewal: '🔄',
      risk: '⚠️',
      strategic: '🎯'
    };
    return agentType ? icons[agentType] || '🤖' : '💬';
  };

  // Truncate content
  const truncate = (str: string, len: number) => {
    if (str.length <= len) return str;
    return str.substring(0, len).trim() + '...';
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '8px',
        width: '380px',
        maxHeight: '500px',
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 1000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #333',
        background: '#0a0a0a'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🕒</span>
            Chat History
          </h4>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '14px',
            color: '#666'
          }}>
            🔍
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: '#111',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Toggle: All Chats vs This Customer */}
        {customerId && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px'
          }}>
            <button
              onClick={() => setShowAllChats(false)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: !showAllChats ? '#e63946' : '#111',
                border: `1px solid ${!showAllChats ? '#e63946' : '#333'}`,
                borderRadius: '6px',
                color: !showAllChats ? '#fff' : '#888',
                fontSize: '12px',
                fontWeight: !showAllChats ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              This Customer
            </button>
            <button
              onClick={() => setShowAllChats(true)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: showAllChats ? '#e63946' : '#111',
                border: `1px solid ${showAllChats ? '#e63946' : '#333'}`,
                borderRadius: '6px',
                color: showAllChats ? '#fff' : '#888',
                fontSize: '12px',
                fontWeight: showAllChats ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              All Chats
            </button>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
      }}>
        {isLoading ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#666'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#666'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>💬</div>
            <p style={{ margin: 0, fontSize: '13px' }}>
              {search ? 'No messages match your search' : 'No chat history yet'}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#555' }}>
              Start a conversation to see it here
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => onSelectMessage?.(msg)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '4px',
                background: '#111',
                cursor: onSelectMessage ? 'pointer' : 'default',
                transition: 'background 0.2s',
                border: '1px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1a1a1a';
                e.currentTarget.style.borderColor = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#111';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              {/* Message Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>
                    {msg.role === 'user' ? '👤' : getAgentIcon(msg.agent_type)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#999' }}>
                    {msg.role === 'user' ? 'You' : (msg.agent_type ? `${msg.agent_type.charAt(0).toUpperCase() + msg.agent_type.slice(1)} Agent` : 'Assistant')}
                  </span>
                  {/* Customer badge for all chats view */}
                  {showAllChats && msg.customer_id && (
                    <span style={{
                      fontSize: '10px',
                      background: '#2a2a3a',
                      color: '#818cf8',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {msg.customer_name || 'Customer'}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>

              {/* Message Content */}
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: '#ccc',
                lineHeight: '1.4',
                wordBreak: 'break-word'
              }}>
                {truncate(msg.content, 120)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {messages.length > 0 && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #333',
          background: '#0a0a0a',
          fontSize: '11px',
          color: '#666',
          textAlign: 'center'
        }}>
          Showing {messages.length} recent message{messages.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ChatHistoryDropdown;
