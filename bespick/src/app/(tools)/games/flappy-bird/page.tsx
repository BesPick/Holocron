'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bird, RotateCcw, Trophy } from 'lucide-react';

type LeaderboardEntry = {
  id: string;
  userName: string | null;
  score: number;
};

const BASE_WIDTH = 400;
const BASE_HEIGHT = 600;
const BIRD_SIZE = 30;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
const GRAVITY = 0.4;
const JUMP_FORCE = -7;
const PIPE_SPEED = 2.5;

type Pipe = {
  x: number;
  topHeight: number;
  passed: boolean;
};

export default function FlappyBirdPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: BASE_WIDTH, height: BASE_HEIGHT });

  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle');
  const birdRef = useRef({ y: BASE_HEIGHT / 2, velocity: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const scaleRef = useRef(1);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/games/flappy-bird/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  }, []);

  const saveScore = async (finalScore: number) => {
    if (finalScore <= 0) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/games/flappy-bird/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore }),
      });

      if (response.ok) {
        await fetchLeaderboard();
      }
    } catch (error) {
      console.error('Failed to save score:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const drawBird = (ctx: CanvasRenderingContext2D, y: number) => {
    const x = 80;
    
    // Bird body (yellow)
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(x, y, BIRD_SIZE / 2, BIRD_SIZE / 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wing
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(x - 5, y + 2, 10, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x + 8, y - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(x + 10, y - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Beak
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x + 15, y);
    ctx.lineTo(x + 25, y + 3);
    ctx.lineTo(x + 15, y + 6);
    ctx.closePath();
    ctx.fill();
  };

  const drawPipe = (ctx: CanvasRenderingContext2D, pipe: Pipe) => {
    // Top pipe
    const gradient1 = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
    gradient1.addColorStop(0, '#16a34a');
    gradient1.addColorStop(0.5, '#22c55e');
    gradient1.addColorStop(1, '#16a34a');
    ctx.fillStyle = gradient1;
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
    
    // Top pipe cap
    ctx.fillStyle = '#15803d';
    ctx.fillRect(pipe.x - 5, pipe.topHeight - 25, PIPE_WIDTH + 10, 25);
    
    // Bottom pipe
    const bottomY = pipe.topHeight + PIPE_GAP;
    ctx.fillStyle = gradient1;
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, BASE_HEIGHT - bottomY);
    
    // Bottom pipe cap
    ctx.fillStyle = '#15803d';
    ctx.fillRect(pipe.x - 5, bottomY, PIPE_WIDTH + 10, 25);
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    gradient.addColorStop(0, '#0ea5e9');
    gradient.addColorStop(0.7, '#7dd3fc');
    gradient.addColorStop(1, '#bae6fd');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    
    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const drawCloud = (x: number, y: number, scale: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
      ctx.arc(x + 25 * scale, y - 10 * scale, 25 * scale, 0, Math.PI * 2);
      ctx.arc(x + 50 * scale, y, 20 * scale, 0, Math.PI * 2);
      ctx.arc(x + 25 * scale, y + 5 * scale, 15 * scale, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(50, 80, 1);
    drawCloud(250, 120, 0.8);
    drawCloud(320, 60, 0.6);
    
    // Ground
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(0, BASE_HEIGHT - 50, BASE_WIDTH, 50);
    ctx.fillStyle = '#65a30d';
    ctx.fillRect(0, BASE_HEIGHT - 50, BASE_WIDTH, 10);
  };

  const drawScore = (ctx: CanvasRenderingContext2D, currentScore: number) => {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    const text = currentScore.toString();
    ctx.strokeText(text, BASE_WIDTH / 2, 60);
    ctx.fillText(text, BASE_WIDTH / 2, 60);
  };

  const checkCollision = (birdY: number, pipes: Pipe[]): boolean => {
    const birdX = 80;
    const birdRadius = BIRD_SIZE / 2 - 3;
    
    // Ground collision
    if (birdY + birdRadius > BASE_HEIGHT - 50 || birdY - birdRadius < 0) {
      return true;
    }
    
    // Pipe collision
    for (const pipe of pipes) {
      if (birdX + birdRadius > pipe.x && birdX - birdRadius < pipe.x + PIPE_WIDTH) {
        if (birdY - birdRadius < pipe.topHeight || birdY + birdRadius > pipe.topHeight + PIPE_GAP) {
          return true;
        }
      }
    }
    
    return false;
  };

  const gameLoop = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Cap at 60fps
    const deltaTime = currentTime - lastTimeRef.current;
    if (deltaTime < FRAME_TIME) {
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    lastTimeRef.current = currentTime - (deltaTime % FRAME_TIME);

    // Normalize physics to 60fps
    const timeScale = deltaTime / FRAME_TIME;

    // Update bird with delta time
    birdRef.current.velocity += GRAVITY * timeScale;
    birdRef.current.y += birdRef.current.velocity * timeScale;

    // Update pipes
    pipesRef.current = pipesRef.current.filter(pipe => pipe.x + PIPE_WIDTH > 0);
    pipesRef.current.forEach(pipe => {
      pipe.x -= PIPE_SPEED * timeScale;
      
      // Check if bird passed pipe
      if (!pipe.passed && pipe.x + PIPE_WIDTH < 80) {
        pipe.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }
    });

    // Add new pipes
    if (pipesRef.current.length === 0 || pipesRef.current[pipesRef.current.length - 1].x < BASE_WIDTH - 200) {
      const minHeight = 80;
      const maxHeight = BASE_HEIGHT - PIPE_GAP - 130;
      const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
      pipesRef.current.push({
        x: BASE_WIDTH,
        topHeight,
        passed: false,
      });
    }

    // Check collision
    if (checkCollision(birdRef.current.y, pipesRef.current)) {
      gameStateRef.current = 'gameover';
      setGameState('gameover');
      cancelAnimationFrame(animationRef.current);
      
      if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current);
      }
      saveScore(scoreRef.current);
      return;
    }

    // Draw
    ctx.save();
    ctx.scale(scaleRef.current, scaleRef.current);
    drawBackground(ctx);
    pipesRef.current.forEach(pipe => drawPipe(ctx, pipe));
    drawBird(ctx, birdRef.current.y);
    drawScore(ctx, scoreRef.current);
    ctx.restore();

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [highScore]);

  const startGame = useCallback(() => {
    birdRef.current = { y: BASE_HEIGHT / 2, velocity: 0 };
    pipesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    lastTimeRef.current = performance.now();
    gameStateRef.current = 'playing';
    setGameState('playing');
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  const jump = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      birdRef.current.velocity = JUMP_FORCE;
    } else if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
      startGame();
    }
  }, [startGame]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      jump();
    }
  }, [jump]);

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    jump();
  }, [jump]);

  const handleTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    jump();
  }, [jump]);

  // Handle responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const maxWidth = Math.min(window.innerWidth - 32, BASE_WIDTH);
      const maxHeight = Math.min(window.innerHeight - 200, BASE_HEIGHT);
      const scale = Math.min(maxWidth / BASE_WIDTH, maxHeight / BASE_HEIGHT, 1);
      
      scaleRef.current = scale;
      setCanvasSize({
        width: Math.floor(BASE_WIDTH * scale),
        height: Math.floor(BASE_HEIGHT * scale),
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Draw initial state
    ctx.save();
    ctx.scale(scaleRef.current, scaleRef.current);
    drawBackground(ctx);
    drawBird(ctx, BASE_HEIGHT / 2);
    ctx.restore();

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationRef.current);
    };
  }, [handleKeyDown, canvasSize]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
      <div ref={containerRef} className="relative touch-none">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleClick}
          onTouchStart={handleTouch}
          onTouchEnd={(e) => e.preventDefault()}
          className="rounded-lg shadow-2xl cursor-pointer border-4 border-slate-700"
          style={{ touchAction: 'none' }}
        />
        
        {/* Overlay for idle/gameover states */}
        {gameState !== 'playing' && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-lg px-4"
            onClick={handleClick}
            onTouchStart={handleTouch}
          >
            {gameState === 'idle' && (
              <>
                <Bird size={64} className="text-yellow-400 mb-4" />
                <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 text-center">Flappy Bird</h1>
                <p className="text-white/80 mb-6 text-center text-sm sm:text-base">Tap or press Space to start</p>
              </>
            )}
            
            {gameState === 'gameover' && (
              <>
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2">Game Over!</h2>
                <p className="text-xl sm:text-2xl text-yellow-400 mb-1">Score: {score}</p>
                <p className="text-base sm:text-lg text-white/60 mb-4">Best: {highScore}</p>
                {isSubmitting && <p className="text-sm text-white/60 mb-4">Saving score...</p>}
                <p className="text-white/80 text-center text-sm sm:text-base">Tap or press Space to play again</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls and Leaderboard */}
      <div className="mt-4 sm:mt-6 flex flex-col items-center gap-3 sm:gap-4 w-full max-w-sm px-4">
        <div className="flex gap-3 sm:gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (gameStateRef.current === 'playing') {
                gameStateRef.current = 'gameover';
                setGameState('gameover');
                cancelAnimationFrame(animationRef.current);
              }
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-white text-sm transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLeaderboard(!showLeaderboard);
              if (!showLeaderboard) fetchLeaderboard();
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-white text-sm transition-colors"
          >
            <Trophy size={16} />
            Leaderboard
          </button>
        </div>

        {showLeaderboard && (
          <div className="w-full bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-400" />
              Top Players
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No scores yet. Be the first!</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-2 bg-slate-700/50 rounded-lg"
                  >
                    <span className="w-8 font-bold text-slate-400">#{i + 1}</span>
                    <span className="flex-1 text-white truncate">
                      {entry.userName || 'Anonymous'}
                    </span>
                    <span className="font-bold text-green-400">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-slate-500 text-xs sm:text-sm text-center">
          Press <kbd className="px-2 py-1 bg-slate-700 rounded text-white">Space</kbd> or tap to flap
        </p>
      </div>
    </div>
  );
}
