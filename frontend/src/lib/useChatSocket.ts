import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface ChatMessage {
    roomId: string;
    senderId: string;
    text: string;
    timestamp: number;
}

export function useChatSocket(
    roomId: string,
    senderId: string,
    pin: string,
    onRoomDestroyed: () => void,
    onJoinError: (msg: string) => void,
    onUserJoined?: (userName: string) => void,
    onUserLeft?: (userName: string) => void
) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeUsers, setActiveUsers] = useState<string[]>([]);
    const [adminUser, setAdminUser] = useState<string>('');
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const socketRef = useRef<Socket | null>(null);

    const onRoomDestroyedRef = useRef(onRoomDestroyed);
    const onJoinErrorRef = useRef(onJoinError);
    const onUserJoinedRef = useRef(onUserJoined);
    const onUserLeftRef = useRef(onUserLeft);
    onRoomDestroyedRef.current = onRoomDestroyed;
    onJoinErrorRef.current = onJoinError;
    onUserJoinedRef.current = onUserJoined;
    onUserLeftRef.current = onUserLeft;

    useEffect(() => {
        if (!roomId || !pin) return;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[ChatSocket] Connected, joining room...');
            socket.emit('join-room', { roomId, userName: senderId, pin });
        });

        socket.on('join-error', (data: { message: string }) => {
            onJoinErrorRef.current(data.message);
        });

        socket.on('join-success', (data: { isAdmin: boolean, adminUser: string }) => {
            setAdminUser(data.adminUser);
        });

        socket.on('room-history', (history: ChatMessage[]) => {
            setMessages(history);
        });

        socket.on('receive-message', (payload: ChatMessage) => {
            setMessages((prev) => [...prev, payload]);
        });

        socket.on('room-users-update', (users: string[]) => {
            setActiveUsers(users);
        });

        socket.on('room-destroyed', () => {
            onRoomDestroyedRef.current();
        });

        // Join/Leave notifications
        socket.on('user-joined', (data: { userName: string }) => {
            onUserJoinedRef.current?.(data.userName);
        });

        socket.on('user-left', (data: { userName: string }) => {
            onUserLeftRef.current?.(data.userName);
        });

        // Typing indicators
        socket.on('typing', (data: { userName: string }) => {
            setTypingUsers(prev => {
                const next = new Set(prev);
                next.add(data.userName);
                return next;
            });
        });

        socket.on('stop-typing', (data: { userName: string }) => {
            setTypingUsers(prev => {
                const next = new Set(prev);
                next.delete(data.userName);
                return next;
            });
        });

        return () => {
            if (roomId) socket.emit('leave-room', roomId);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [roomId, senderId, pin]);

    const sendMessage = useCallback((text: string) => {
        if (!socketRef.current) return;

        const payload: ChatMessage = {
            roomId,
            senderId,
            text,
            timestamp: Date.now(),
        };

        socketRef.current.emit('send-message', payload);
        // Stop typing when message is sent
        socketRef.current.emit('stop-typing', { roomId, userName: senderId });
    }, [roomId, senderId]);

    const emitTyping = useCallback(() => {
        if (!socketRef.current) return;
        socketRef.current.emit('typing', { roomId, userName: senderId });
    }, [roomId, senderId]);

    const emitStopTyping = useCallback(() => {
        if (!socketRef.current) return;
        socketRef.current.emit('stop-typing', { roomId, userName: senderId });
    }, [roomId, senderId]);

    return {
        messages,
        activeUsers,
        adminUser,
        typingUsers,
        sendMessage,
        emitTyping,
        emitStopTyping,
        socket: socketRef.current,
    };
}
