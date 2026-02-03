import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = 'cscx_offline_message_queue';

interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
  customerId?: string;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>(() => {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist queue to localStorage
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(messageQueue));
  }, [messageQueue]);

  // Add message to queue
  const queueMessage = useCallback((content: string, customerId?: string) => {
    const message: QueuedMessage = {
      id: `queued_${Date.now()}`,
      content,
      timestamp: Date.now(),
      customerId,
    };
    setMessageQueue(prev => [...prev, message]);
    return message.id;
  }, []);

  // Remove message from queue (after successful send)
  const dequeueMessage = useCallback((id: string) => {
    setMessageQueue(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // Get next message to send
  const getNextQueuedMessage = useCallback(() => {
    return messageQueue[0] || null;
  }, [messageQueue]);

  // Clear all queued messages
  const clearQueue = useCallback(() => {
    setMessageQueue([]);
  }, []);

  return {
    isOnline,
    messageQueue,
    queuedCount: messageQueue.length,
    queueMessage,
    dequeueMessage,
    getNextQueuedMessage,
    clearQueue,
  };
}

export default useOnlineStatus;
