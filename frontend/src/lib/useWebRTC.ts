import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { Instance, SignalData } from 'simple-peer';
import { Socket } from 'socket.io-client';

export type CallType = 'audio' | 'video';

interface UseWebRTCProps {
    socket: Socket | null;
    roomId: string;
    userName: string;
}

/**
 * Multi-peer mesh WebRTC hook with audio/video call support.
 *
 * Call flow:
 * 1. User A clicks "Video" or "Audio" → starts media, emits `webrtc-call-start`
 *    with callType.
 * 2. Other users see incoming call dialog showing call type.
 * 3. User B clicks "Accept" → starts appropriate media, emits `webrtc-call-start`.
 * 4. Existing in-call users create INITIATOR peers to the new joiner.
 * 5. The new joiner's handleOffer auto-creates RESPONDER peers.
 *
 * IMPORTANT: We use `isCallActiveRef` (a ref) instead of `isCallActive` (state)
 * inside socket handlers to avoid stale closure issues.
 */
export function useWebRTC({ socket, roomId, userName }: UseWebRTCProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [isCallActive, setIsCallActive] = useState(false);
    const [callType, setCallType] = useState<CallType>('video');
    const [incomingCall, setIncomingCall] = useState<{ senderId: string; callType: CallType } | null>(null);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);

    const peersRef = useRef<Map<string, Instance>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const callParticipantsRef = useRef<Set<string>>(new Set());
    const callStartTimeRef = useRef<number>(0);

    // Synchronous ref mirrors the isCallActive state
    const isCallActiveRef = useRef(false);
    // Ref for callType so socket handlers can read the latest value
    const callTypeRef = useRef<CallType>('video');

    const startLocalMedia = async (type: CallType) => {
        if (localStreamRef.current) return localStreamRef.current;
        try {
            const constraints = type === 'audio'
                ? { audio: true, video: false }
                : { audio: true, video: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
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

    /** Format seconds into M:SS */
    const formatDuration = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const endCall = useCallback(() => {
        // Calculate duration
        const duration = callStartTimeRef.current
            ? Date.now() - callStartTimeRef.current
            : 0;
        const typeLabel = callTypeRef.current === 'audio' ? '📞 Audio Call' : '📹 Video Call';

        peersRef.current.forEach((peer) => {
            if (!peer.destroyed) peer.destroy();
        });
        peersRef.current.clear();
        callParticipantsRef.current.clear();
        setRemoteStreams(new Map());

        if (socket) {
            socket.emit('webrtc-call-ended', { roomId, senderId: userName, callType: callTypeRef.current });

            // Emit call-ended system message
            if (duration > 0) {
                socket.emit('call-event', {
                    roomId,
                    text: `${typeLabel} ended • ${formatDuration(duration)}`,
                    timestamp: Date.now(),
                });
            }
        }

        stopLocalMedia();
        setIsCallActive(false);
        isCallActiveRef.current = false;
        callStartTimeRef.current = 0;
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

    /** Initiator: announce call to the room */
    const initiateCall = useCallback(async (type: CallType) => {
        if (!socket) return;
        const stream = await startLocalMedia(type);
        if (!stream) return;

        setCallType(type);
        callTypeRef.current = type;
        setIsCallActive(true);
        isCallActiveRef.current = true;
        callParticipantsRef.current.clear();
        callStartTimeRef.current = Date.now();

        // Emit call-started system message
        const typeLabel = type === 'audio' ? '📞 Audio Call' : '📹 Video Call';
        socket.emit('call-event', {
            roomId,
            text: `${userName} started a ${typeLabel}`,
            timestamp: Date.now(),
        });

        socket.emit('webrtc-call-start', { roomId, senderId: userName, callType: type });
    }, [socket, roomId, userName]);

    /** Accept an incoming call */
    const acceptCall = useCallback(async () => {
        if (!socket || !incomingCall) return;

        const type = incomingCall.callType || 'video';
        setCallType(type);
        callTypeRef.current = type;
        setIsCallActive(true);
        isCallActiveRef.current = true;
        callStartTimeRef.current = Date.now();

        const stream = await startLocalMedia(type);
        if (!stream) return;

        setIncomingCall(null);

        // Announce ourselves — existing in-call users will create INITIATOR peers to us
        socket.emit('webrtc-call-start', { roomId, senderId: userName, callType: type });
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

    // Register socket handlers ONCE
    useEffect(() => {
        if (!socket) return;

        const handleCallStart = (payload: { senderId: string; callType?: CallType }) => {
            if (payload.senderId === userName) return;

            if (isCallActiveRef.current && localStreamRef.current) {
                if (!peersRef.current.has(payload.senderId)) {
                    createPeerTo(payload.senderId, true, localStreamRef.current);
                }
                return;
            }
            setIncomingCall(prev => prev ? prev : {
                senderId: payload.senderId,
                callType: payload.callType || 'video',
            });
        };

        const handleOffer = (payload: { senderId: string, targetId?: string, signal: SignalData }) => {
            if (payload.senderId === userName) return;
            if (payload.targetId && payload.targetId !== userName) return;

            if (isCallActiveRef.current && localStreamRef.current) {
                createPeerTo(payload.senderId, false, localStreamRef.current, payload.signal);
                return;
            }

            if (!isCallActiveRef.current) {
                setIncomingCall(prev => prev ? prev : {
                    senderId: payload.senderId,
                    callType: 'video',
                });
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
                callStartTimeRef.current = 0;
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
    }, [socket, userName, createPeerTo, removePeer, endCall, stopLocalMedia]);

    return {
        localStream,
        remoteStreams,
        isCallActive,
        callType,
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
