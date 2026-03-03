"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatRoom from '@/components/ChatRoom';
import { BlinkLogo } from '@/components/BlinkLogo';
import { MessageCircle, AlertCircle } from 'lucide-react';

interface FieldErrors {
  userName?: string;
  roomId?: string;
  pin?: string;
}

export default function Home() {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [pin, setPin] = useState('');
  const [joined, setJoined] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};

    // Username validation
    const trimmedName = userName.trim();
    if (!trimmedName) {
      newErrors.userName = 'Display name is required';
    } else if (trimmedName.length < 2) {
      newErrors.userName = 'Name must be at least 2 characters';
    } else if (trimmedName.length > 20) {
      newErrors.userName = 'Name must be under 20 characters';
    } else if (!/^[a-zA-Z0-9_\- ]+$/.test(trimmedName)) {
      newErrors.userName = 'Only letters, numbers, spaces, - and _ allowed';
    }

    // Room ID validation
    const trimmedRoom = roomId.trim();
    if (!trimmedRoom) {
      newErrors.roomId = 'Room ID is required';
    } else if (trimmedRoom.length < 3) {
      newErrors.roomId = 'Room ID must be at least 3 characters';
    } else if (trimmedRoom.length > 30) {
      newErrors.roomId = 'Room ID must be under 30 characters';
    } else if (!/^[a-zA-Z0-9_\-]+$/.test(trimmedRoom)) {
      newErrors.roomId = 'No spaces or special characters allowed';
    }

    // PIN validation
    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      newErrors.pin = 'Room PIN is required';
    } else if (!/^\d+$/.test(trimmedPin)) {
      newErrors.pin = 'PIN must contain only numbers';
    } else if (trimmedPin.length < 4) {
      newErrors.pin = 'PIN must be at least 4 digits';
    } else if (trimmedPin.length > 8) {
      newErrors.pin = 'PIN must be under 8 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) setJoined(true);
  };

  // Clear individual field errors on input change
  const handleNameChange = (val: string) => {
    setUserName(val);
    if (errors.userName) setErrors(prev => ({ ...prev, userName: undefined }));
  };
  const handleRoomChange = (val: string) => {
    setRoomId(val);
    if (errors.roomId) setErrors(prev => ({ ...prev, roomId: undefined }));
  };
  const handlePinChange = (val: string) => {
    setPin(val);
    if (errors.pin) setErrors(prev => ({ ...prev, pin: undefined }));
  };

  if (joined) {
    return <ChatRoom roomId={roomId.trim()} userName={userName.trim()} pin={pin.trim()} onLeave={() => setJoined(false)} />;
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
            className="mx-auto mb-6 flex items-center justify-center"
          >
            <BlinkLogo size={64} />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Blink</h1>
          <p className="mt-2 text-sm text-zinc-400">Ephemeral rooms. Zero traces.</p>
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-5" noValidate>
          {/* Display Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Display Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`h-12 w-full rounded-xl border bg-zinc-950 px-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:ring-1 ${errors.userName
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                : 'border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500'
                }`}
              placeholder="e.g. Neo"
              maxLength={20}
            />
            <AnimatePresence>
              {errors.userName && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5"
                >
                  <AlertCircle size={12} /> {errors.userName}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Room ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => handleRoomChange(e.target.value)}
              className={`h-12 w-full rounded-xl border bg-zinc-950 px-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:ring-1 ${errors.roomId
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                : 'border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500'
                }`}
              placeholder="e.g. my-secret-room"
              maxLength={30}
            />
            <AnimatePresence>
              {errors.roomId && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5"
                >
                  <AlertCircle size={12} /> {errors.roomId}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Room PIN */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Room PIN (Set or Enter)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              className={`h-12 w-full rounded-xl border bg-zinc-950 px-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:ring-1 ${errors.pin
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                : 'border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500'
                }`}
              placeholder="4-8 digit numeric PIN"
              maxLength={8}
            />
            <AnimatePresence>
              {errors.pin && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5"
                >
                  <AlertCircle size={12} /> {errors.pin}
                </motion.p>
              )}
            </AnimatePresence>
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
