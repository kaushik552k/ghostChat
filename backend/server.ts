import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ephemeralListPush, ephemeralSet, ephemeralListGet, ephemeralGet, ephemeralDelete, ephemeralSetAdd, ephemeralSetRemove, ephemeralSetMembers } from './redisClient';

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

// Track socket ID to room & user name mapping dynamically in memory
const activeClients = new Map<string, { roomId: string, userName: string }>();

const handleUserLeave = async (socketId: string) => {
    const clientRef = activeClients.get(socketId);
    if (!clientRef) return;

    const { roomId, userName } = clientRef;
    activeClients.delete(socketId);

    // Remove from Redis set
    await ephemeralSetRemove(`room_users:${roomId}`, userName);

    // Notify others that this user left
    io.to(roomId).emit('user-left', { userName });

    // Broadcast new users list
    const remainingUsers = await ephemeralSetMembers(`room_users:${roomId}`);
    io.to(roomId).emit('room-users-update', remainingUsers);

    // Check if Admin
    const currentAdmin = await ephemeralGet(`room_admin:${roomId}`);
    if (currentAdmin === userName) {
        console.log(`[Socket] Admin ${userName} left. Destroying room ${roomId}.`);
        // Destroy the entire room
        io.to(roomId).emit('room-destroyed');
        await ephemeralDelete([
            `room_pin:${roomId}`,
            `room_admin:${roomId}`,
            `room_active:${roomId}`,
            `room_msgs:${roomId}`,
            `room_users:${roomId}`
        ]);
        // Force remaining sockets to leave
        const socketsInRoom = await io.in(roomId).fetchSockets();
        for (const s of socketsInRoom) {
            s.leave(roomId);
        }
    }
};

io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, userName, pin }: { roomId: string, userName: string, pin: string }) => {
        // --- Server-side validation ---
        if (!roomId || !userName || !pin) {
            socket.emit('join-error', { message: 'All fields are required.' });
            return;
        }
        const trimName = userName.trim();
        const trimRoom = roomId.trim();
        const trimPin = pin.trim();

        if (trimName.length < 2 || trimName.length > 20) {
            socket.emit('join-error', { message: 'Display name must be 2-20 characters.' });
            return;
        }
        if (!/^[a-zA-Z0-9_\- ]+$/.test(trimName)) {
            socket.emit('join-error', { message: 'Display name contains invalid characters.' });
            return;
        }
        if (trimRoom.length < 3 || trimRoom.length > 30) {
            socket.emit('join-error', { message: 'Room ID must be 3-30 characters.' });
            return;
        }
        if (!/^[a-zA-Z0-9_\-]+$/.test(trimRoom)) {
            socket.emit('join-error', { message: 'Room ID can only contain letters, numbers, hyphens, and underscores.' });
            return;
        }
        if (!/^\d{4,8}$/.test(trimPin)) {
            socket.emit('join-error', { message: 'PIN must be a 4-8 digit number.' });
            return;
        }

        // Check if username is already taken in this room
        const existingUsers = await ephemeralSetMembers(`room_users:${trimRoom}`);
        if (existingUsers.includes(trimName)) {
            socket.emit('join-error', { message: `"${trimName}" is already in this room. Choose a different name.` });
            return;
        }

        // --- PIN check ---
        const existingPin = await ephemeralGet(`room_pin:${trimRoom}`);

        if (existingPin) {
            if (existingPin !== trimPin) {
                socket.emit('join-error', { message: 'Incorrect Room PIN.' });
                return;
            }
        } else {
            await ephemeralSet(`room_pin:${trimRoom}`, trimPin);
            await ephemeralSet(`room_admin:${trimRoom}`, trimName);
            console.log(`[Socket] Room ${trimRoom} created by ${trimName} with PIN`);
        }

        socket.join(roomId);
        activeClients.set(socket.id, { roomId, userName });
        console.log(`[Socket] ${socket.id} (${userName}) joined room ${roomId}`);

        const currentAdmin = await ephemeralGet(`room_admin:${roomId}`);
        socket.emit('join-success', { isAdmin: currentAdmin === userName, adminUser: currentAdmin });

        // Record active participant in the room's users set
        await ephemeralSetAdd(`room_users:${roomId}`, userName);
        await ephemeralSet(`room_active:${roomId}`, Date.now().toString());

        // Broadcast active members list to everyone
        const activeUsers = await ephemeralSetMembers(`room_users:${roomId}`);
        io.to(roomId).emit('room-users-update', activeUsers);

        // Notify others that this user joined
        socket.to(roomId).emit('user-joined', { userName });

        // Fetch existing messages from the Redis List for this room
        const messages = await ephemeralListGet(`room_msgs:${roomId}`);
        socket.emit('room-history', messages.map(m => JSON.parse(m)));
    });

    socket.on('leave-room', async (roomId: string) => {
        await handleUserLeave(socket.id);
        socket.leave(roomId);
        console.log(`[Socket] ${socket.id} left room ${roomId}`);
    });

    // Typing indicator relay
    socket.on('typing', (data: { roomId: string, userName: string }) => {
        socket.to(data.roomId).emit('typing', { userName: data.userName });
    });

    socket.on('stop-typing', (data: { roomId: string, userName: string }) => {
        socket.to(data.roomId).emit('stop-typing', { userName: data.userName });
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

    socket.on('webrtc-call-ended', (data: { roomId: string, senderId: string }) => {
        socket.to(data.roomId).emit('webrtc-call-ended', data);
    });

    socket.on('webrtc-call-start', (data: { roomId: string, senderId: string }) => {
        socket.to(data.roomId).emit('webrtc-call-start', data);
    });

    socket.on('disconnect', async () => {
        console.log(`Socket disconnected: ${socket.id}`);
        await handleUserLeave(socket.id);
    });
});

const PORT = 4000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
