import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ephemeralListPush, ephemeralSet, ephemeralListGet } from './redisClient';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

interface ChatMessagePayload {
    roomId: string;
    senderId: string;
    text: string;
    timestamp: number;
}

interface SignalData {
    roomId: string;
    senderId: string;
    signal: any;
}

io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    socket.on('join-room', async (roomId: string) => {
        socket.join(roomId);
        console.log(`[Socket] ${socket.id} joined room ${roomId}`);

        // Register the room's access actively to keep alive temporarily
        await ephemeralSet(`room_active:${roomId}`, Date.now().toString());

        // Fetch existing messages from the Redis List for this room
        const messages = await ephemeralListGet(`room_msgs:${roomId}`);
        socket.emit('room-history', messages.map(m => JSON.parse(m)));
    });

    socket.on('send-message', async (payload: ChatMessagePayload) => {
        console.log(`[Socket] Message in ${payload.roomId} from ${payload.senderId}`);

        // 1-Hour rule strictly maintained inside ephemeralListPush via pipeline
        await ephemeralListPush(`room_msgs:${payload.roomId}`, JSON.stringify(payload));

        // Broadcast message to everyone in the room including the sender
        io.to(payload.roomId).emit('receive-message', payload);
    });

    // Strict blind relay for WebRTC as per instructions
    socket.on('webrtc-offer', (payload: SignalData) => {
        socket.to(payload.roomId).emit('webrtc-offer', payload);
    });

    socket.on('webrtc-answer', (payload: SignalData) => {
        socket.to(payload.roomId).emit('webrtc-answer', payload);
    });

    socket.on('webrtc-ice-candidate', (data) => {
        socket.to(data.roomId).emit('webrtc-ice-candidate', data);
    });

    socket.on('webrtc-rejected', (data) => {
        socket.to(data.roomId).emit('webrtc-rejected', data);
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

const PORT = 4000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
