import { useEffect, useRef, useState } from 'react';
import Peer, { Instance, SignalData } from 'simple-peer';
import { Socket } from 'socket.io-client';

interface UseWebRTCProps {
    socket: Socket | null;
    roomId: string;
    userName: string;
}

export function useWebRTC({ socket, roomId, userName }: UseWebRTCProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isCallActive, setIsCallActive] = useState(false);

    // Track incoming call state
    const [incomingCall, setIncomingCall] = useState<{ senderId: string, signal: SignalData } | null>(null);

    const peerRef = useRef<Instance | null>(null);

    const startLocalMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            return stream;
        } catch (err) {
            console.error("Failed to access media devices", err);
            return null;
        }
    };

    const stopLocalMedia = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
    };

    const initiateCall = async () => {
        if (!socket) return;
        const stream = await startLocalMedia();
        if (!stream) return;

        setIsCallActive(true);

        const peer = new Peer({
            initiator: true,
            trickle: true,
            stream: stream,
        });

        peer.on('signal', (data: SignalData) => {
            if (data.type === 'offer') {
                socket.emit('webrtc-offer', { roomId, senderId: userName, signal: data });
            } else {
                socket.emit('webrtc-ice-candidate', { roomId, senderId: userName, signal: data });
            }
        });

        peer.on('stream', (rStream: MediaStream) => {
            setRemoteStream(rStream);
        });

        peerRef.current = peer;
    };

    const acceptCall = async () => {
        if (!socket || !incomingCall) return;
        setIsCallActive(true);
        const stream = await startLocalMedia();

        const peer = new Peer({
            initiator: false,
            trickle: true,
            stream: stream || undefined,
        });

        // If the peer fails (e.g., cross calling or other person closed), end cleanly
        peer.on('error', (err) => {
            console.log('Peer error:', err);
            endCall();
        });

        peer.on('close', () => {
            endCall();
        });

        peer.on('signal', (data: SignalData) => {
            if (data.type === 'answer') {
                socket.emit('webrtc-answer', { roomId, senderId: userName, signal: data });
            } else {
                socket.emit('webrtc-ice-candidate', { roomId, senderId: userName, signal: data });
            }
        });

        peer.on('stream', (rStream: MediaStream) => {
            setRemoteStream(rStream);
        });

        peer.signal(incomingCall.signal);
        peerRef.current = peer;
        setIncomingCall(null);
    };

    const rejectCall = () => {
        if (socket && incomingCall) {
            // Signal the sender that the call was rejected
            socket.emit('webrtc-rejected', { roomId, senderId: userName, targetId: incomingCall.senderId });
        }
        setIncomingCall(null);
    };

    const endCall = () => {
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        stopLocalMedia();
        setRemoteStream(null);
        setIsCallActive(false);
        setIncomingCall(null);
    };

    useEffect(() => {
        if (!socket) return;

        socket.on('webrtc-offer', (payload: { senderId: string, signal: SignalData }) => {
            if (payload.senderId === userName) return;
            // If already in a call, we could send busy, but for now just ignore or queue
            if (isCallActive) return;

            console.log('Incoming call from', payload.senderId);
            setIncomingCall(payload);
        });

        socket.on('webrtc-answer', (payload: { senderId: string, signal: SignalData }) => {
            if (payload.senderId === userName) return;
            if (peerRef.current && !peerRef.current.destroyed) {
                peerRef.current.signal(payload.signal);
            }
        });

        socket.on('webrtc-ice-candidate', (payload: { senderId: string, signal: SignalData }) => {
            if (payload.senderId === userName) return;
            if (peerRef.current && !peerRef.current.destroyed) {
                peerRef.current.signal(payload.signal);
            }
        });

        socket.on('webrtc-rejected', (payload: { senderId: string, targetId: string }) => {
            // If we are the target of the rejection (we initiated it and they clicked decline)
            if (payload.targetId === userName) {
                console.log(`${payload.senderId} declined the call.`);
                // Stop our camera and reset our state
                endCall();
            }
        });

        return () => {
            socket.off('webrtc-offer');
            socket.off('webrtc-answer');
            socket.off('webrtc-ice-candidate');
            socket.off('webrtc-rejected');
        };
    }, [socket, roomId, userName, isCallActive]);

    return {
        localStream,
        remoteStream,
        isCallActive,
        incomingCall,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall
    };
}
