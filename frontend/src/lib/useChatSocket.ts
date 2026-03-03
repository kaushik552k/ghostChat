import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface ChatMessage {
    roomId: string;
    senderId: string;
    text: string;
    timestamp: number;
}

export function useChatSocket(roomId: string, senderId: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!roomId) return;

        // Connect to Backend WebSocket
        const socket = io('http://localhost:4000');
        socketRef.current = socket;

        socket.emit('join-room', roomId);

        socket.on('room-history', (history: ChatMessage[]) => {
            setMessages(history);
        });

        socket.on('receive-message', (payload: ChatMessage) => {
            setMessages((prev) => [...prev, payload]);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, [roomId]);

    const sendMessage = (text: string) => {
        if (!socketRef.current) return;

        const payload: ChatMessage = {
            roomId,
            senderId,
            text,
            timestamp: Date.now(),
        };

        socketRef.current.emit('send-message', payload);
    };

    return {
        messages,
        sendMessage,
        socket: socketRef.current,
    };
}
