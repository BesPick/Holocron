'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, RotateCcw, Trophy, User } from 'lucide-react';

const WAITING = 0;
const READY = 1;
const TOO_EARLY = 2;
const CLICK_NOW = 3;
const RESULT = 4;

const MIN_DELAY_BEFORE_NEXT = 1500;

type LeaderboardEntry = {
  id: string;
  userName: string | null;
  score: number;
  averageTime: number;
  bestTime: number;
};

export default function ReactionTimePage() {
  const [gameState, setGameState] = useState(WAITING);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [results, setResults] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const gameStateRef = useRef(WAITING);
  const attemptsRef = useRef(0);
  const canClickRef = useRef(true);
  const resultsRef = useRef<number[]>([]);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/games/reaction-time/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const saveScore = async (newResults: number[]) => {
    if (newResults.length < 5) return;
    
    setIsSubmitting(true);
    const avg = Math.round(newResults.reduce((a, b) => a + b, 0) / newResults.length);
    const best = Math.min(...newResults);
    const score = Math.max(0, 500 - avg);

    try {
      const response = await fetch('/api/games/reaction-time/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          averageTime: avg,
          bestTime: best,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      }
    } catch (error) {
      console.error('Failed to save score:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startGame = () => {
    canClickRef.current = true;
    gameStateRef.current = READY;
    setGameState(READY);
    
    const delay = Math.random() * 3000 + 2000;
    
    timeoutRef.current = setTimeout(() => {
      startTimeRef.current = performance.now();
      gameStateRef.current = CLICK_NOW;
      
      if (gameAreaRef.current) {
        gameAreaRef.current.style.backgroundColor = '#22c55e';
      }
      if (titleRef.current) {
        titleRef.current.textContent = 'Click!';
      }
      if (subtitleRef.current) {
        subtitleRef.current.style.visibility = 'hidden';
      }
      
      setTimeout(() => setGameState(CLICK_NOW), 0);
    }, delay);
  };

  const startNextRound = () => {
    canClickRef.current = false;
    const cooldown = MIN_DELAY_BEFORE_NEXT + Math.random() * 1500;
    
    timeoutRef.current = setTimeout(() => {
      startGame();
    }, cooldown);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!canClickRef.current && gameStateRef.current !== CLICK_NOW) {
      return;
    }
    
    const clickTime = performance.now();
    const state = gameStateRef.current;
    
    if (state === WAITING) {
      startGame();
    } else if (state === READY) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      gameStateRef.current = TOO_EARLY;
      setGameState(TOO_EARLY);
      startNextRound();
    } else if (state === CLICK_NOW) {
      const time = Math.round(clickTime - startTimeRef.current);
      gameStateRef.current = RESULT;
      attemptsRef.current += 1;
      resultsRef.current = [...resultsRef.current, time];
      
      if (gameAreaRef.current) {
        gameAreaRef.current.style.backgroundColor = '#1e293b';
      }
      if (titleRef.current) {
        titleRef.current.textContent = `${time} ms`;
      }
      if (subtitleRef.current) {
        subtitleRef.current.textContent = attemptsRef.current < 5 
          ? `Attempt ${attemptsRef.current}/5 • Next round starting...` 
          : 'All done! Click to restart';
        subtitleRef.current.style.visibility = 'visible';
      }
      
      setTimeout(() => {
        setReactionTime(time);
        setResults(resultsRef.current);
        setAttempts(attemptsRef.current);
        setGameState(RESULT);
        
        if (resultsRef.current.length >= 5) {
          saveScore(resultsRef.current);
        }
      }, 0);
      
      if (attemptsRef.current < 5) {
        startNextRound();
      }
    } else if (state === RESULT) {
      if (attemptsRef.current >= 5) {
        gameStateRef.current = WAITING;
        attemptsRef.current = 0;
        resultsRef.current = [];
        setGameState(WAITING);
        setAttempts(0);
        setResults([]);
        setReactionTime(null);
      }
    }
  };

  const resetGame = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    gameStateRef.current = WAITING;
    attemptsRef.current = 0;
    resultsRef.current = [];
    setGameState(WAITING);
    setReactionTime(null);
    setResults([]);
    setAttempts(0);
  };

  const averageTime = results.length > 0 
    ? Math.round(results.reduce((a, b) => a + b, 0) / results.length)
    : null;

  const bestTime = results.length > 0 ? Math.min(...results) : null;

  const getBackgroundClass = () => {
    switch (gameState) {
      case READY: return 'bg-red-600';
      case CLICK_NOW: return 'bg-green-600';
      case TOO_EARLY: return 'bg-orange-600';
      default: return 'bg-slate-800';
    }
  };

  const getMessage = () => {
    switch (gameState) {
      case WAITING:
        return { title: 'Reaction Time Test', subtitle: 'Click anywhere to start' };
      case READY:
        return { title: 'Wait for green...', subtitle: "Don't click yet!" };
      case CLICK_NOW:
        return { title: 'CLICK!', subtitle: '' };
      case TOO_EARLY:
        return { title: 'Too early!', subtitle: 'Next round starting...' };
      case RESULT:
        return { 
          title: `${reactionTime} ms`, 
          subtitle: attempts < 5 ? `Attempt ${attempts}/5 • Next round starting...` : 'All done! Click to restart'
        };
      default:
        return { title: '', subtitle: '' };
    }
  };

  const { title, subtitle } = getMessage();

  return (
    <div className="flex flex-col h-full min-h-screen">
      <div
        ref={gameAreaRef}
        onMouseDown={handleMouseDown}
        className={`flex-1 flex flex-col items-center justify-center cursor-pointer select-none min-h-100 transition-none ${getBackgroundClass()}`}
      >
        <div className="text-center">
          {gameState === WAITING && (
            <div className="mb-6">
              <Zap size={80} className="text-green-500 mx-auto" />
            </div>
          )}
          
          {gameState === RESULT && (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-6 mx-auto">
              <span className="text-3xl font-bold text-white">{attempts}</span>
            </div>
          )}

          <h1 ref={titleRef} className="text-5xl font-bold text-white mb-4">{title}</h1>
          
          <p 
            ref={subtitleRef} 
            className="text-xl text-white/80"
            style={{ visibility: subtitle ? 'visible' : 'hidden' }}
          >
            {subtitle || ' '}
          </p>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-slate-900/95 border-t border-slate-700 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Trophy size={20} className="text-yellow-400" />
                Your Results
              </h2>
              <button
                onMouseDown={resetGame}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm mb-1">Attempts</p>
                <p className="text-2xl font-bold text-white">{results.length}</p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm mb-1">Average</p>
                <p className="text-2xl font-bold text-cyan-400">{averageTime} ms</p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm mb-1">Best</p>
                <p className="text-2xl font-bold text-green-400">{bestTime} ms</p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm mb-1">Last</p>
                <p className="text-2xl font-bold text-white">{results[results.length - 1]} ms</p>
              </div>
            </div>

            {results.length >= 5 && (
              <>
                <div className="mt-4 p-4 bg-linear-to-r from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30 text-center text-white">
                  <span className="font-bold text-cyan-400">Final Average: {averageTime} ms</span>
                  <span className="text-slate-400 ml-2">
                    {averageTime && averageTime < 200 ? '🔥 Incredible!' : 
                     averageTime && averageTime < 250 ? '⚡ Great!' : 
                     averageTime && averageTime < 300 ? '👍 Good!' : '💪 Keep practicing!'}
                  </span>
                  {isSubmitting && <span className="ml-2 text-sm text-slate-400">(Saving...)</span>}
                </div>

                {leaderboard.length > 0 && (
                  <div className="mt-6 border-t border-slate-700 pt-6">
                    <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                      <Trophy size={16} className="text-yellow-400" />
                      Leaderboard (Best Scores)
                    </h3>
                    <div className="bg-slate-800/60 rounded-lg overflow-hidden">
                      {leaderboard.slice(0, 10).map((entry, i) => (
                        <div 
                          key={entry.id} 
                          className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 last:border-0"
                        >
                          <span className="w-6 font-bold text-slate-400">#{i + 1}</span>
                          <span className="flex-1 text-white ml-2 flex items-center gap-1">
                            <User size={14} className="text-slate-500" />
                            {entry.userName || 'Anonymous'}
                          </span>
                          <span className="font-bold text-green-400">{entry.averageTime}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
