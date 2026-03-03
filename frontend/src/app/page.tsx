"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ChatRoom from '@/components/ChatRoom';
import { MessageCircle } from 'lucide-react';

export default function Home() {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [pin, setPin] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() && roomId.trim() && pin.trim()) setJoined(true);
  };

  if (joined) {
    return <ChatRoom roomId={roomId} userName={userName} pin={pin} onLeave={() => setJoined(false)} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/20"
          >
            <MessageCircle size={28} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Blink</h1>
          <p className="mt-2 text-sm text-zinc-400">Ephemeral rooms. Zero traces.</p>
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Display Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="e.g. Neo"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="Enter a secret phrase"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Room PIN (Set or Enter)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="4-digit pin"
              maxLength={10}
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <MessageCircle size={18} />
            Enter Room
          </button>
        </form>
      </motion.div>
    </div>
  );
}
