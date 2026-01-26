/**
 * Execution Replay Component
 * Step-by-step replay of agent execution with timing controls
 * Play through steps with pause/resume/step controls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

interface ReplayStep {
  index: number;
  id: string;
  type: string;
  name: string;
  description?: string;
  input?: any;
  output?: any;
  relativeTime: number; // ms from start
  duration: number;
  tokens?: { input: number; output: number };
  metadata?: Record<string, any>;
  status: 'completed' | 'error' | 'pending';
}

interface StateSnapshot {
  stepIndex: number;
  completedSteps: number;
  totalSteps: number;
  currentStatus: string;
  tokensUsed: { input: number; output: number };
}

interface ReplayData {
  runId: string;
  agentName: string;
  agentType: string;
  input: string;
  output?: string;
  status: string;
  totalDuration: number;
  steps: ReplayStep[];
  stateSnapshots: StateSnapshot[];
  totalSteps: number;
}

type PlaybackSpeed = 0.5 | 1 | 2 | 4;

interface Props {
  runId: string;
  onClose?: () => void;
  onStepSelect?: (step: ReplayStep) => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Main Component
// ============================================

export function ExecutionReplay({ runId, onClose, onStepSelect }: Props) {
  const { getAuthHeaders } = useAuth();
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Refs for playback control
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);

  // Build headers
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers = getAuthHeaders();
    if (!headers['x-user-id']) {
      headers['x-user-id'] = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    }
    return headers;
  }, [getAuthHeaders]);

  // Fetch replay data
  useEffect(() => {
    const fetchReplayData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/traces/${runId}/replay`, {
          headers: buildHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch replay data');
        }

        const data = await response.json();
        setReplayData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchReplayData();
  }, [runId, buildHeaders]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !replayData) {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();

    playbackRef.current = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) * playbackSpeed;
      lastTickRef.current = now;

      setElapsedTime(prev => {
        const newTime = prev + delta;

        // Find current step based on elapsed time
        const newStepIndex = replayData.steps.findIndex(
          (step, idx) => {
            const stepEnd = step.relativeTime + step.duration;
            const nextStep = replayData.steps[idx + 1];
            const nextStart = nextStep?.relativeTime || Infinity;
            return newTime >= step.relativeTime && newTime < nextStart;
          }
        );

        if (newStepIndex !== -1 && newStepIndex !== currentStepIndex) {
          setCurrentStepIndex(newStepIndex);
        }

        // Check if playback is complete
        if (newTime >= replayData.totalDuration) {
          setIsPlaying(false);
          setCurrentStepIndex(replayData.steps.length - 1);
          return replayData.totalDuration;
        }

        return newTime;
      });
    }, 50);

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, replayData, playbackSpeed, currentStepIndex]);

  // Playback controls
  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);

  const reset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(-1);
    setElapsedTime(0);
  };

  const stepForward = () => {
    if (!replayData) return;
    setIsPlaying(false);
    setCurrentStepIndex(prev => Math.min(prev + 1, replayData.steps.length - 1));
    if (currentStepIndex + 1 < replayData.steps.length) {
      setElapsedTime(replayData.steps[currentStepIndex + 1].relativeTime);
    }
  };

  const stepBackward = () => {
    if (!replayData) return;
    setIsPlaying(false);
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
    if (currentStepIndex > 0) {
      setElapsedTime(replayData.steps[currentStepIndex - 1].relativeTime);
    }
  };

  const jumpToStep = (index: number) => {
    if (!replayData || index < 0 || index >= replayData.steps.length) return;
    setIsPlaying(false);
    setCurrentStepIndex(index);
    setElapsedTime(replayData.steps[index].relativeTime);
    onStepSelect?.(replayData.steps[index]);
  };

  const seekTo = (time: number) => {
    if (!replayData) return;
    setElapsedTime(time);

    const stepIndex = replayData.steps.findIndex((step, idx) => {
      const nextStep = replayData.steps[idx + 1];
      const nextStart = nextStep?.relativeTime || Infinity;
      return time >= step.relativeTime && time < nextStart;
    });

    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex);
    }
  };

  // Format time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = ms % 1000;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${Math.floor(remainingMs / 100)}`;
  };

  // Get current state
  const currentState = replayData?.stateSnapshots[currentStepIndex] || {
    stepIndex: -1,
    completedSteps: 0,
    totalSteps: replayData?.totalSteps || 0,
    currentStatus: 'pending',
    tokensUsed: { input: 0, output: 0 },
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white text-center">
          <div className="animate-spin text-4xl mb-4">&#128260;</div>
          <p>Loading replay data...</p>
        </div>
      </div>
    );
  }

  if (error || !replayData) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">&#10060;</div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Replay</h2>
          <p className="text-gray-400 mb-4">{error || 'Unknown error'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentStep = currentStepIndex >= 0 ? replayData.steps[currentStepIndex] : null;
  const progress = (elapsedTime / replayData.totalDuration) * 100;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xl">&#9654;&#65039;</span>
          <div>
            <h1 className="text-lg font-bold text-white">Execution Replay</h1>
            <p className="text-sm text-gray-400">{replayData.agentName}</p>
          </div>
        </div>

        {/* Playback Info */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-mono text-white">
              {formatTime(elapsedTime)} / {formatTime(replayData.totalDuration)}
            </div>
            <div className="text-xs text-gray-500">Elapsed / Total</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {currentStepIndex + 1} / {replayData.totalSteps}
            </div>
            <div className="text-xs text-gray-500">Step</div>
          </div>

          <div className="text-center">
            <div className="text-lg text-white">
              {currentState.tokensUsed.input + currentState.tokensUsed.output}
            </div>
            <div className="text-xs text-gray-500">Tokens Used</div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline Panel */}
        <div className="w-80 border-r border-gray-700 flex flex-col bg-gray-900/50">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 uppercase">Steps</h3>
          </div>

          <div className="flex-1 overflow-auto">
            {replayData.steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isPast = index < currentStepIndex;

              return (
                <div
                  key={step.id}
                  onClick={() => jumpToStep(index)}
                  className={`p-3 border-b border-gray-800 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-cscx-accent/20 border-l-2 border-l-cscx-accent'
                      : isPast
                      ? 'bg-green-900/10 border-l-2 border-l-green-500'
                      : 'hover:bg-gray-800 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">#{index + 1}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">
                        {step.type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTime(step.relativeTime)}
                    </span>
                  </div>

                  <p className="text-sm text-white truncate">{step.name}</p>

                  {step.duration > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Duration: {step.duration}ms
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Detail Panel */}
        <div className="flex-1 flex flex-col">
          {/* Current Step Content */}
          <div className="flex-1 overflow-auto p-6">
            {currentStep ? (
              <div className="max-w-3xl mx-auto">
                {/* Step Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    currentStep.status === 'completed' ? 'bg-green-500/20' :
                    currentStep.status === 'error' ? 'bg-red-500/20' :
                    'bg-blue-500/20'
                  }`}>
                    {currentStep.type === 'tool_call' ? '&#128295;' :
                     currentStep.type === 'llm_call' ? '&#129302;' :
                     currentStep.type === 'thinking' ? '&#129504;' :
                     currentStep.type === 'decision' ? '&#128256;' :
                     currentStep.type === 'error' ? '&#10060;' : '&#8226;'}
                  </div>

                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">{currentStep.name}</h2>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-700 rounded">{currentStep.type}</span>
                      <span>Duration: {currentStep.duration}ms</span>
                      {currentStep.tokens && (
                        <span>Tokens: {currentStep.tokens.input + currentStep.tokens.output}</span>
                      )}
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-sm ${
                    currentStep.status === 'completed' ? 'bg-green-500 text-white' :
                    currentStep.status === 'error' ? 'bg-red-500 text-white' :
                    'bg-yellow-500 text-black'
                  }`}>
                    {currentStep.status}
                  </span>
                </div>

                {/* Description */}
                {currentStep.description && (
                  <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="text-gray-300">{currentStep.description}</p>
                  </div>
                )}

                {/* Input */}
                {currentStep.input !== undefined && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Input</h3>
                    <pre className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-300 overflow-auto max-h-64">
                      {typeof currentStep.input === 'string'
                        ? currentStep.input
                        : JSON.stringify(currentStep.input, null, 2)
                      }
                    </pre>
                  </div>
                )}

                {/* Output */}
                {currentStep.output !== undefined && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Output</h3>
                    <pre className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-300 overflow-auto max-h-64">
                      {typeof currentStep.output === 'string'
                        ? currentStep.output
                        : JSON.stringify(currentStep.output, null, 2)
                      }
                    </pre>
                  </div>
                )}

                {/* Metadata */}
                {currentStep.metadata && Object.keys(currentStep.metadata).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Metadata</h3>
                    <pre className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-300 overflow-auto max-h-32">
                      {JSON.stringify(currentStep.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">&#9654;&#65039;</div>
                  <p className="text-lg">Press play to start replay</p>
                  <p className="text-sm mt-2">Or click a step to jump directly</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-2">
            <div
              className="relative h-2 bg-gray-700 rounded-full cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                seekTo(percent * replayData.totalDuration);
              }}
            >
              <div
                className="absolute h-full bg-cscx-accent rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />

              {/* Step markers */}
              {replayData.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`absolute w-2 h-2 rounded-full -top-0 transform -translate-x-1/2 ${
                    index <= currentStepIndex ? 'bg-white' : 'bg-gray-500'
                  }`}
                  style={{ left: `${(step.relativeTime / replayData.totalDuration) * 100}%` }}
                />
              ))}

              {/* Current position */}
              <div
                className="absolute w-4 h-4 bg-white rounded-full -top-1 transform -translate-x-1/2 shadow-lg"
                style={{ left: `${progress}%` }}
              />
            </div>
          </div>

          {/* Playback Controls */}
          <div className="bg-gray-900 border-t border-gray-700 px-6 py-4">
            <div className="flex items-center justify-center gap-4">
              {/* Reset */}
              <button
                onClick={reset}
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Reset"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Step Back */}
              <button
                onClick={stepBackward}
                disabled={currentStepIndex <= 0}
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Previous Step"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={isPlaying ? pause : play}
                className="p-4 rounded-full bg-cscx-accent hover:bg-cscx-accent/80 text-white transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Step Forward */}
              <button
                onClick={stepForward}
                disabled={currentStepIndex >= replayData.steps.length - 1}
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Next Step"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>

              {/* Speed Control */}
              <div className="ml-6 flex items-center gap-2">
                <span className="text-sm text-gray-400">Speed:</span>
                {([0.5, 1, 2, 4] as PlaybackSpeed[]).map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-1 rounded text-sm transition-colors ${
                      playbackSpeed === speed
                        ? 'bg-cscx-accent text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExecutionReplay;
