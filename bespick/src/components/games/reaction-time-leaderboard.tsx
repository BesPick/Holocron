'use client';

import { useEffect, useState } from 'react';
import { Trophy, User, Medal } from 'lucide-react';

type LeaderboardEntry = {
  id: string;
  userName: string | null;
  score: number;
  averageTime: number;
  bestTime: number;
};

export function ReactionTimeLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/games/reaction-time/leaderboard');
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data.leaderboard || []);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Trophy size={48} className="mx-auto mb-2 opacity-50" />
        <p>No scores yet. Be the first!</p>
      </div>
    );
  }

  const getMedalIcon = (rank: number) => {
    if (rank === 0) return <Medal size={18} className="text-yellow-400" />;
    if (rank === 1) return <Medal size={18} className="text-slate-400" />;
    if (rank === 2) return <Medal size={18} className="text-amber-600" />;
    return null;
  };

  return (
    <div className="space-y-2">
      {leaderboard.slice(0, 20).map((entry, i) => (
        <div
          key={entry.id}
          className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
            i < 3
              ? 'bg-gradient-to-r from-primary/10 to-transparent border border-primary/20'
              : 'bg-muted/30 hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 w-12">
              {getMedalIcon(i) || (
                <span className="text-sm font-bold text-muted-foreground">
                  #{i + 1}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate">
                {entry.userName || 'Anonymous'}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-bold text-green-400 text-sm">
              {entry.averageTime}ms
            </span>
            <span className="text-xs text-muted-foreground">
              Best: {entry.bestTime}ms
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
