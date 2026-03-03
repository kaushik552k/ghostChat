import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatSocket } from '@/lib/useChatSocket';
import { useWebRTC } from '@/lib/useWebRTC';
import { Send, Video, VideoOff, Phone, PhoneOff, Mic, MicOff, LogOut, Users, Crown } from 'lucide-react';
import { BlinkLogo } from '@/components/BlinkLogo';
import { toast } from 'sonner';

interface ChatRoomProps {
    roomId: string;
    userName: string;
    pin: string;
    onLeave: () => void;
}

/** Auto-bind MediaStream to <video> */
function RemoteVideo({ stream, label }: { stream: MediaStream, label: string }) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.srcObject = stream;
    }, [stream]);

    return (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 shadow-lg">
            <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
            <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">{label}</span>
        </div>
    );
}

/** Auto-bind audio stream (no video element) */
function RemoteAudio({ stream }: { stream: MediaStream }) {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.srcObject = stream;
    }, [stream]);
    return <audio ref={ref} autoPlay />;
}

export default function ChatRoom({ roomId, userName, pin, onLeave }: ChatRoomProps) {
    const [joinError, setJoinError] = useState('');

    const handleRoomDestroyed = () => {
        toast.error('The Admin has closed this room. Redirecting...');
        setTimeout(() => onLeave(), 1500);
    };

    const handleJoinError = (msg: string) => {
        setJoinError(msg);
    };

    const handleUserJoined = useCallback((name: string) => {
        toast(`⚡ ${name} joined the room`, {
            style: {
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#e0e7ff',
                borderRadius: '1rem',
            },
            duration: 3000,
        });
    }, []);

    const handleUserLeft = useCallback((name: string) => {
        toast(`👋 ${name} left the room`, {
            style: {
                background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
                border: '1px solid rgba(120, 113, 108, 0.3)',
                color: '#d6d3d1',
                borderRadius: '1rem',
            },
            duration: 3000,
        });
    }, []);

    const { messages, activeUsers, adminUser, typingUsers, sendMessage, emitTyping, emitStopTyping, socket } = useChatSocket(
        roomId, userName, pin, handleRoomDestroyed, handleJoinError, handleUserJoined, handleUserLeft
    );
    const {
        localStream, remoteStreams, isCallActive, callType, incomingCall,
        isVideoMuted, isAudioMuted, toggleVideo, toggleAudio,
        initiateCall, acceptCall, rejectCall, endCall
    } = useWebRTC({ socket, roomId, userName });

    const [text, setText] = useState('');
    const [showSidebar, setShowSidebar] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
        emitTyping();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            emitStopTyping();
        }, 2000);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim()) {
            sendMessage(text.trim());
            setText('');
            emitStopTyping();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    const typingArray = Array.from(typingUsers);

    if (joinError) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-100">
                <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center backdrop-blur">
                    <h2 className="mb-2 text-2xl font-bold text-red-500">Access Denied</h2>
                    <p className="mb-6 text-zinc-400">{joinError}</p>
                    <button onClick={onLeave} className="rounded-xl bg-red-500 px-6 py-2 font-medium text-white hover:bg-red-600 transition-colors">Go Back</button>
                </div>
            </div>
        );
    }

    const remoteStreamEntries = Array.from(remoteStreams.entries());
    const totalVideos = remoteStreamEntries.length + 1;
    const gridCols = totalVideos <= 2 ? 'grid-cols-1 sm:grid-cols-2' : totalVideos <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';

    const isAudioCall = callType === 'audio';

    return (
        <div className="flex h-screen w-full bg-zinc-950 font-sans text-zinc-100 relative overflow-hidden">

            {/* Main Chat Area */}
            <div className="flex flex-col h-full w-full">
                {/* Incoming Call Overlay */}
                <AnimatePresence>
                    {incomingCall && !isCallActive && (
                        <motion.div
                            initial={{ opacity: 0, y: -50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -50 }}
                            className="absolute left-1/2 top-20 z-50 flex w-[90%] max-w-sm -translate-x-1/2 flex-col items-center justify-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl"
                        >
                            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${incomingCall.callType === 'audio' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                {incomingCall.callType === 'audio' ? <Phone size={28} /> : <Video size={28} />}
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold">{incomingCall.senderId}</h3>
                                <p className="text-sm text-zinc-400">
                                    Incoming {incomingCall.callType === 'audio' ? 'Audio' : 'Video'} Call...
                                </p>
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
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-medium text-white shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
                                >
                                    <Phone size={18} /> Accept
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-3 sm:px-6 backdrop-blur-md">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                        >
                            <BlinkLogo size={36} />
                        </motion.div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight truncate max-w-[120px] sm:max-w-none">Room: <span className="text-cyan-400">{roomId}</span></h1>
                            <p className="text-xs text-zinc-500">{userName} • Blink</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl transition-colors ${showSidebar ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                            title="Active Users"
                        >
                            <Users size={18} />
                        </button>

                        {/* Audio Call Button */}
                        <button
                            onClick={() => initiateCall('audio')}
                            disabled={isCallActive}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isCallActive ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600'}`}
                            title="Audio Call"
                        >
                            <Phone size={18} />
                        </button>

                        {/* Video Call Button */}
                        <button
                            onClick={() => initiateCall('video')}
                            disabled={isCallActive}
                            className={`flex h-10 px-4 items-center justify-center gap-2 rounded-xl transition-colors ${isCallActive ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-600'}`}
                            title="Video Call"
                        >
                            <Video size={18} /> <span className="hidden sm:inline text-sm font-medium">Video</span>
                        </button>

                        <button
                            onClick={onLeave}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20"
                            title="Leave Room"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </header>

                {/* Call Area — Audio or Video */}
                <AnimatePresence>
                    {isCallActive && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-b border-zinc-900 bg-zinc-950"
                        >
                            {isAudioCall ? (
                                /* ===== AUDIO CALL UI ===== */
                                <div className="p-4 sm:p-6">
                                    {/* Hidden audio elements */}
                                    {remoteStreamEntries.map(([peerId, stream]) => (
                                        <RemoteAudio key={peerId} stream={stream} />
                                    ))}

                                    <div className="flex flex-col items-center gap-4">
                                        <div className="flex items-center gap-2 text-emerald-400">
                                            <Phone size={20} />
                                            <span className="text-sm font-semibold uppercase tracking-wider">Audio Call</span>
                                        </div>

                                        {/* Participant pills */}
                                        <div className="flex flex-wrap justify-center gap-3">
                                            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2">
                                                <motion.div
                                                    animate={{ scale: [1, 1.3, 1] }}
                                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                                    className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                                                />
                                                <span className="text-sm font-medium text-zinc-300">You</span>
                                            </div>
                                            {remoteStreamEntries.map(([peerId]) => (
                                                <div key={peerId} className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2">
                                                    <motion.div
                                                        animate={{ scale: [1, 1.3, 1] }}
                                                        transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                                                        className="h-2.5 w-2.5 rounded-full bg-cyan-500"
                                                    />
                                                    <span className="text-sm font-medium text-zinc-300">{peerId}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Controls */}
                                        <div className="flex gap-3 mt-2">
                                            <button onClick={toggleAudio} className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs font-semibold transition-all ${isAudioMuted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                                                {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />} Mic
                                            </button>
                                            <button onClick={endCall} className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-red-600 shadow-lg shadow-red-500/20">
                                                <PhoneOff size={16} /> End Call
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ===== VIDEO CALL UI ===== */
                                <div className="p-2 sm:p-4">
                                    <div className={`grid gap-3 ${gridCols}`}>
                                        {remoteStreamEntries.map(([peerId, stream]) => (
                                            <RemoteVideo key={peerId} stream={stream} label={peerId} />
                                        ))}
                                        <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 shadow-lg">
                                            {localStream && !isVideoMuted ? (
                                                <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover transform -scale-x-100" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500 bg-zinc-900 flex-col gap-2">
                                                    <VideoOff size={24} className="text-zinc-600" /> Camera Hidden
                                                </div>
                                            )}
                                            <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">You</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                                        <button onClick={toggleVideo} className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold transition-all ${isVideoMuted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                                            {isVideoMuted ? <VideoOff size={16} /> : <Video size={16} />} Camera
                                        </button>
                                        <button onClick={toggleAudio} className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold transition-all ${isAudioMuted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                                            {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />} Mic
                                        </button>
                                        <button onClick={endCall} className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-red-500 px-3 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold text-white transition-all hover:bg-red-600 shadow-lg shadow-red-500/20">
                                            <PhoneOff size={16} /> End Call
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Message Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                        <AnimatePresence>
                            {messages.map((msg, idx) => {
                                const isSystem = msg.senderId === '__system__';
                                const isMe = msg.senderId === userName;

                                // System message (call events)
                                if (isSystem) {
                                    return (
                                        <motion.div
                                            key={`${msg.timestamp}-${idx}`}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex justify-center"
                                        >
                                            <div className="flex items-center gap-2 rounded-full border border-zinc-800/50 bg-zinc-900/40 px-4 py-1.5">
                                                <span className="text-xs text-zinc-500">{msg.text}</span>
                                            </div>
                                        </motion.div>
                                    );
                                }

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
                                        <div className={`relative max-w-[85%] rounded-[1.25rem] px-5 py-3 shadow-sm ${isMe
                                            ? 'bg-cyan-500 text-white rounded-tr-md'
                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-md'
                                            }`}>
                                            <p className="text-[15px] leading-relaxed break-words">{msg.text}</p>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Typing Indicator */}
                <AnimatePresence>
                    {typingArray.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="mx-auto w-full max-w-4xl px-6 pb-1"
                        >
                            <p className="text-xs text-cyan-400/80 flex items-center gap-2">
                                <span className="flex gap-0.5">
                                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                </span>
                                {typingArray.length === 1
                                    ? `${typingArray[0]} is typing`
                                    : `${typingArray.join(', ')} are typing`
                                }
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input Area */}
                <div className="mx-auto w-full max-w-4xl p-3 sm:p-4 sm:pb-8 pb-safe">
                    <form onSubmit={submit} className="relative flex w-full items-center">
                        <input
                            value={text}
                            onChange={handleInputChange}
                            placeholder="Type a message..."
                            className="h-12 sm:h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-4 sm:pl-6 pr-12 sm:pr-14 text-zinc-100 placeholder-zinc-500 shadow-inner backdrop-blur focus:border-cyan-500/50 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 transition-all text-sm sm:text-base"
                        />
                        <button
                            type="submit"
                            disabled={!text.trim()}
                            className="absolute right-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white transition-transform active:scale-90 disabled:opacity-50"
                        >
                            <Send size={16} className="ml-[2px]" />
                        </button>
                    </form>
                </div>
            </div>

            {/* Sidebar backdrop + panel */}
            <AnimatePresence>
                {showSidebar && (
                    <>
                        {/* Backdrop — click to close */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowSidebar(false)}
                            className="absolute inset-0 z-30 bg-black/40"
                        />
                        {/* Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                            className="absolute right-0 top-0 bottom-0 w-full sm:w-[280px] border-l border-zinc-900 bg-zinc-950/98 backdrop-blur-xl p-5 sm:p-6 z-40 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <Users className="text-cyan-400" size={20} />
                                    <h2 className="text-lg font-bold">Active Members</h2>
                                </div>
                                <button onClick={() => setShowSidebar(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 transition-colors">
                                    ✕
                                </button>
                            </div>
                            <ul className="flex flex-col gap-3">
                                {activeUsers.length === 0 && <li className="text-sm text-zinc-600 italic">No one else here...</li>}
                                {activeUsers.map((user, i) => {
                                    const isAdmin = user === adminUser;
                                    return (
                                        <li key={i} className={`flex items-center gap-3 rounded-lg p-3 ${isAdmin ? 'border border-amber-500/30 bg-amber-500/5' : 'border border-zinc-800/50 bg-zinc-900/50'}`}>
                                            <div className={`h-2 w-2 rounded-full ${isAdmin ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                                            <span className="text-sm font-medium text-zinc-300 truncate flex-1">{user}</span>
                                            {isAdmin && <Crown size={14} className="text-amber-400 shrink-0" />}
                                        </li>
                                    );
                                })}
                            </ul>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
