/**
 * Task List Component
 * Displays tasks created by the AI assistant
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  task_type: string;
  status: 'needsAction' | 'completed';
  created_at: string;
}

interface TaskListProps {
  refreshTrigger?: number;
  onTaskChange?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export function TaskList({ refreshTrigger, onTaskChange }: TaskListProps) {
  const { user, getAuthHeaders } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!user?.id) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/google/tasks`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      } else {
        console.error('Tasks fetch failed:', response.status);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchTasks();
      // Poll for new tasks every 60 seconds
      const interval = setInterval(fetchTasks, 60000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchTasks();
    }
  }, [refreshTrigger]);

  const handleComplete = async (id: string) => {
    if (!user?.id) return;
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/google/tasks/${id}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        setTasks(prev => prev.map(t =>
          t.id === id ? { ...t, status: 'completed' as const } : t
        ));
        onTaskChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to complete task');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/google/tasks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setTasks(prev => prev.filter(t => t.id !== id));
        onTaskChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete task');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-900/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30';
      case 'low': return 'text-green-400 bg-green-900/30';
      default: return 'text-gray-400 bg-gray-700';
    }
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isOverdue = date < now;
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    return { text: formattedDate, isOverdue };
  };

  // Separate pending and completed tasks
  const pendingTasks = tasks.filter(t => t.status === 'needsAction');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400">
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          {pendingTasks.length > 0 && (
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
          )}
          Tasks {pendingTasks.length > 0 && `(${pendingTasks.length})`}
        </h3>
        <button
          onClick={fetchTasks}
          className="text-xs text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500">
          No tasks yet. Ask me to create a task!
        </div>
      ) : (
        <div className="divide-y divide-gray-700">
          {/* Pending Tasks */}
          {pendingTasks.map((task) => {
            const dueInfo = formatDueDate(task.due_date);
            return (
              <div key={task.id} className="p-3 hover:bg-gray-800/50">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleComplete(task.id)}
                    className="mt-0.5 w-5 h-5 rounded border-2 border-gray-500 hover:border-green-400 hover:bg-green-900/30 flex items-center justify-center transition-colors"
                    title="Mark as complete"
                  >
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white">{task.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {dueInfo && (
                        <span className={`text-xs ${dueInfo.isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                          Due: {dueInfo.text}
                        </span>
                      )}
                    </div>
                    {task.notes && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete task"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          {/* Completed Tasks (collapsed by default) */}
          {completedTasks.length > 0 && (
            <details className="group">
              <summary className="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-800/30 list-none flex items-center gap-2">
                <span className="text-gray-600">▸</span>
                <span className="group-open:hidden">Show {completedTasks.length} completed</span>
                <span className="hidden group-open:inline">Hide completed</span>
              </summary>
              {completedTasks.map((task) => (
                <div key={task.id} className="p-3 bg-gray-800/30">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded bg-green-900/50 flex items-center justify-center text-green-400 text-xs">
                      ✓
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-500 line-through">{task.title}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Delete task"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskList;
