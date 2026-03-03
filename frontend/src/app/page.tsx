"use client";

import { useState } from 'react';
import ChatRoom from '@/components/ChatRoom';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 font-sans text-white">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-8 shadow-xl">
          <h1 className="text-center text-3xl font-bold tracking-tight text-zinc-100">
            GhostChat 👻
          </h1>
          <p className="mb-4 text-center text-sm text-zinc-400">
            Ephemeral P2P Chat. Self-destructs in 1 hour.
          </p>
          <input
            type="text"
            placeholder="Display Name"
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Room ID (e.g. secret123)"
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button
            onClick={() => { if (roomId && name) setJoined(true); }}
            className="h-10 rounded-lg bg-white font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  return <ChatRoom roomId={roomId} userName={name} />;
}
