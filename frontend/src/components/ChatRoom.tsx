import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatSocket } from '@/lib/useChatSocket';
import { useWebRTC } from '@/lib/useWebRTC';
import { Send, Video, VideoOff, Phone, PhoneOff } from 'lucide-react';

export default function ChatRoom({ roomId, userName }: { roomId: string, userName: string }) {
    const { messages, sendMessage, socket } = useChatSocket(roomId, userName);
    const { localStream, remoteStream, isCallActive, incomingCall, initiateCall, acceptCall, rejectCall, endCall } = useWebRTC({ socket, roomId, userName });
    const [text, setText] = useState('');

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim()) {
            sendMessage(text.trim());
            setText('');
        }
    }

    return (
        <div className="flex h-screen w-full flex-col bg-zinc-950 font-sans text-zinc-100 relative">

            {/* Incoming Call Overlay Dialog */}
            <AnimatePresence>
                {incomingCall && !isCallActive && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="absolute left-1/2 top-20 z-50 flex w-[90%] max-w-sm -translate-x-1/2 flex-col items-center justify-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl"
                    >
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                            <Video size={28} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold">{incomingCall.senderId}</h3>
                            <p className="text-sm text-zinc-400">Incoming Video Call...</p>
                        </div>
                        <div className="mt-2 flex w-full gap-4">
                            <button
                                onClick={rejectCall}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/10 py-3 font-medium text-red-500 transition-colors hover:bg-red-500/20"
                            >
                                <PhoneOff size={18} /> Decline
                            </button>
                            <button
                                onClick={acceptCall}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-medium text-white shadow-lg shadow-green-500/20 transition-transform active:scale-95"
                            >
                                <Phone size={18} /> Accept
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Header */}
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-6 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-purple-500/20"
                    >
                        <span className="font-black text-white">G</span>
                    </motion.div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Room: <span className="text-indigo-400">{roomId}</span></h1>
                        <p className="text-xs text-zinc-500">{userName} • Ephemeral Mode</p>
                    </div>
                </div>
                <button
                    onClick={isCallActive ? endCall : initiateCall}
                    className={`flex h-10 w-10 flex-col items-center justify-center rounded-full transition-colors ${isCallActive ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                    {isCallActive ? <VideoOff size={18} /> : <Video size={18} />}
                </button>
            </header>

            {/* Video Area (Only shows when active) */}
            <AnimatePresence>
                {isCallActive && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex flex-col gap-4 border-b border-zinc-900 bg-zinc-950 p-4 sm:flex-row"
                    >
                        <div className="relative aspect-video flex-1 overflow-hidden rounded-xl bg-zinc-900 shadow-lg">
                            {remoteStream ? (
                                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">Waiting for peer...</div>
                            )}
                            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs backdrop-blur">Peer</span>
                        </div>
                        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-lg sm:w-1/3">
                            {localStream ? (
                                <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">Starting camera...</div>
                            )}
                            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs backdrop-blur">You</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                    <AnimatePresence>
                        {messages.map((msg, idx) => {
                            const isMe = msg.senderId === userName;
                            return (
                                <motion.div
                                    key={`${msg.timestamp}-${idx}`}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                >
                                    {!isMe && <span className="mb-1 ml-1 text-xs font-semibold text-zinc-500">{msg.senderId}</span>}
                                    <div className={`relative max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${isMe
                                            ? 'bg-zinc-100 text-zinc-950 rounded-tr-sm'
                                            : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-sm'
                                        }`}>
                                        <p className="text-[15px] leading-relaxed">{msg.text}</p>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Input Area (Kibo UI style) */}
            <div className="mx-auto w-full max-w-3xl p-4 pb-8">
                <form onSubmit={submit} className="relative flex w-full items-center">
                    <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Whisper into the void..."
                        className="h-14 w-full rounded-full border border-zinc-800 bg-zinc-900/50 pl-6 pr-14 text-zinc-100 placeholder-zinc-500 shadow-inner backdrop-blur focus:border-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!text.trim()}
                        className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition-transform active:scale-90 disabled:opacity-50"
                    >
                        <Send size={16} className="ml-1" />
                    </button>
                </form>
            </div>

        </div>
    )
}
