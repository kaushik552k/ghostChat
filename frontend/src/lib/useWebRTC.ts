import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { Instance, SignalData } from 'simple-peer';
import { Socket } from 'socket.io-client';

interface UseWebRTCProps {
    socket: Socket | null;
    roomId: string;
    userName: string;
}

/**
 * Multi-peer mesh WebRTC hook.
 *
 * Call flow:
 * 1. User A clicks "Video" → starts local media, emits `webrtc-call-start`
 * 2. Other users see incoming call dialog.
 * 3. User B clicks "Accept" → starts local media, creates INITIATOR peer
 *    targeting A, sends `webrtc-offer` with targetId=A.
 * 4. A receives the offer → creates NON-INITIATOR peer for B, answers.
 * 5. If user C also accepts, C creates initiator peer for A.
 *    B's acceptCall also emits call-start, so A and B both know about each new joiner.
 *
 * IMPORTANT: We use `isCallActiveRef` (a ref) instead of `isCallActive` (state)
 * inside socket handlers to avoid stale closure issues. The ref is updated
 * synchronously and always reflects the latest value.
 */
export function useWebRTC({ socket, roomId, userName }: UseWebRTCProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [isCallActive, setIsCallActive] = useState(false);
    const [incomingCall, setIncomingCall] = useState<{ senderId: string } | null>(null);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);

    const peersRef = useRef<Map<string, Instance>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const callParticipantsRef = useRef<Set<string>>(new Set());

    // *** KEY FIX: synchronous ref mirrors the isCallActive state ***
    // Socket handlers read this ref instead of the state, avoiding stale closures.
    const isCallActiveRef = useRef(false);

    const startLocalMedia = async () => {
        if (localStreamRef.current) return localStreamRef.current;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            console.error("Failed to access media devices", err);
            return null;
        }
    };

    const stopLocalMedia = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
    }, []);

    const removePeer = useCallback((peerId: string) => {
        const peer = peersRef.current.get(peerId);
        if (peer && !peer.destroyed) peer.destroy();
        peersRef.current.delete(peerId);
        callParticipantsRef.current.delete(peerId);
        setRemoteStreams(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });
    }, []);

    const endCall = useCallback(() => {
        peersRef.current.forEach((peer) => {
            if (!peer.destroyed) peer.destroy();
        });
        peersRef.current.clear();
        callParticipantsRef.current.clear();
        setRemoteStreams(new Map());

        if (socket) {
            socket.emit('webrtc-call-ended', { roomId, senderId: userName });
        }

        stopLocalMedia();
        setIsCallActive(false);
        isCallActiveRef.current = false;
        setIncomingCall(null);
        setIsVideoMuted(false);
        setIsAudioMuted(false);
    }, [socket, roomId, userName, stopLocalMedia]);

    /** Create a peer connection to a specific user */
    const createPeerTo = useCallback((targetId: string, initiator: boolean, stream: MediaStream, incomingSignal?: SignalData) => {
        if (!socket) return;
        // Don't duplicate
        if (peersRef.current.has(targetId)) {
            const existing = peersRef.current.get(targetId)!;
            if (!existing.destroyed && incomingSignal) {
                existing.signal(incomingSignal);
            }
            return;
        }

        console.log(`[WebRTC] Creating ${initiator ? 'initiator' : 'responder'} peer → ${targetId}`);

        const peer = new Peer({ initiator, trickle: true, stream });

        peer.on('signal', (data: SignalData) => {
            if (data.type === 'offer') {
                socket.emit('webrtc-offer', { roomId, senderId: userName, targetId, signal: data });
            } else if (data.type === 'answer') {
                socket.emit('webrtc-answer', { roomId, senderId: userName, targetId, signal: data });
            } else {
                socket.emit('webrtc-ice-candidate', { roomId, senderId: userName, targetId, signal: data });
            }
        });

        peer.on('stream', (rStream: MediaStream) => {
            console.log(`[WebRTC] Got stream from ${targetId}`);
            setRemoteStreams(prev => {
                const next = new Map(prev);
                next.set(targetId, rStream);
                return next;
            });
        });

        peer.on('error', (err) => {
            console.log(`[WebRTC] Peer error with ${targetId}:`, err);
            removePeer(targetId);
        });

        peer.on('close', () => {
            removePeer(targetId);
        });

        if (incomingSignal) {
            peer.signal(incomingSignal);
        }

        peersRef.current.set(targetId, peer);
        callParticipantsRef.current.add(targetId);
    }, [socket, roomId, userName, removePeer]);

    /** Initiator: announce call to the room (no peer created yet) */
    const initiateCall = useCallback(async () => {
        if (!socket) return;
        const stream = await startLocalMedia();
        if (!stream) return;

        // Update BOTH state and ref synchronously
        setIsCallActive(true);
        isCallActiveRef.current = true;
        callParticipantsRef.current.clear();

        // Broadcast "I'm starting a call" — peers are created when others accept
        socket.emit('webrtc-call-start', { roomId, senderId: userName });
    }, [socket, roomId, userName]);

    /** Accept an incoming call — announce ourselves, let existing users initiate to us */
    const acceptCall = useCallback(async () => {
        if (!socket || !incomingCall) return;

        // Update BOTH state and ref synchronously
        setIsCallActive(true);
        isCallActiveRef.current = true;

        const stream = await startLocalMedia();
        if (!stream) return;

        setIncomingCall(null);

        // Announce ourselves — existing in-call users will create INITIATOR peers to us
        // via handleCallStart. Our handleOffer will auto-create RESPONDER peers.
        // This avoids the dual-initiator deadlock.
        socket.emit('webrtc-call-start', { roomId, senderId: userName });
    }, [socket, incomingCall, roomId, userName]);

    const rejectCall = useCallback(() => {
        if (socket && incomingCall) {
            socket.emit('webrtc-rejected', { roomId, senderId: userName, targetId: incomingCall.senderId });
        }
        setIncomingCall(null);
    }, [socket, incomingCall, roomId, userName]);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoMuted(!videoTrack.enabled);
            }
        }
    }, []);

    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioMuted(!audioTrack.enabled);
            }
        }
    }, []);

    // Register socket handlers ONCE (no isCallActive dependency!)
    // Handlers use isCallActiveRef.current for the latest value.
    useEffect(() => {
        if (!socket) return;

        const handleCallStart = (payload: { senderId: string }) => {
            if (payload.senderId === userName) return;

            // Use REF, not state — always up-to-date
            if (isCallActiveRef.current && localStreamRef.current) {
                // Already in a call — connect to this new joiner
                if (!peersRef.current.has(payload.senderId)) {
                    createPeerTo(payload.senderId, true, localStreamRef.current);
                }
                return;
            }
            // Not in a call — show incoming call dialog (don't overwrite existing)
            setIncomingCall(prev => prev ? prev : { senderId: payload.senderId });
        };

        const handleOffer = (payload: { senderId: string, targetId?: string, signal: SignalData }) => {
            if (payload.senderId === userName) return;
            if (payload.targetId && payload.targetId !== userName) return;

            // Use REF for latest call state
            if (isCallActiveRef.current && localStreamRef.current) {
                createPeerTo(payload.senderId, false, localStreamRef.current, payload.signal);
                return;
            }

            // Not in a call — show dialog
            if (!isCallActiveRef.current) {
                setIncomingCall(prev => prev ? prev : { senderId: payload.senderId });
            }
        };

        const handleAnswer = (payload: { senderId: string, targetId?: string, signal: SignalData }) => {
            if (payload.senderId === userName) return;
            if (payload.targetId && payload.targetId !== userName) return;
            const peer = peersRef.current.get(payload.senderId);
            if (peer && !peer.destroyed) {
                peer.signal(payload.signal);
            }
        };

        const handleIceCandidate = (payload: { senderId: string, targetId?: string, signal: SignalData }) => {
            if (payload.senderId === userName) return;
            if (payload.targetId && payload.targetId !== userName) return;
            const peer = peersRef.current.get(payload.senderId);
            if (peer && !peer.destroyed) {
                peer.signal(payload.signal);
            }
        };

        const handleRejected = (payload: { senderId: string, targetId: string }) => {
            if (payload.targetId === userName) {
                console.log(`${payload.senderId} declined the call.`);
                removePeer(payload.senderId);
                if (peersRef.current.size === 0) {
                    endCall();
                }
            }
        };

        const handleCallEnded = (payload: { senderId: string }) => {
            if (payload.senderId === userName) return;
            console.log(`${payload.senderId} left the call.`);
            removePeer(payload.senderId);
            if (peersRef.current.size === 0) {
                stopLocalMedia();
                setIsCallActive(false);
                isCallActiveRef.current = false;
                setIsVideoMuted(false);
                setIsAudioMuted(false);
            }
        };

        socket.on('webrtc-call-start', handleCallStart);
        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);
        socket.on('webrtc-rejected', handleRejected);
        socket.on('webrtc-call-ended', handleCallEnded);

        return () => {
            socket.off('webrtc-call-start', handleCallStart);
            socket.off('webrtc-offer', handleOffer);
            socket.off('webrtc-answer', handleAnswer);
            socket.off('webrtc-ice-candidate', handleIceCandidate);
            socket.off('webrtc-rejected', handleRejected);
            socket.off('webrtc-call-ended', handleCallEnded);
        };
        // Removed isCallActive from deps — we use the ref now
    }, [socket, userName, createPeerTo, removePeer, endCall, stopLocalMedia]);

    return {
        localStream,
        remoteStreams,
        isCallActive,
        incomingCall,
        isVideoMuted,
        isAudioMuted,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleVideo,
        toggleAudio
    };
}
