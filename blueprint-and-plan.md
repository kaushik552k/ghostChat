# GhostChat: Master Blueprint & Execution Plan

## 🎯 System Intent
Build a real-time, ephemeral chat and P2P video calling application. All data must self-destruct after 1 hour. The UI must utilize "Gen Z" Cute-alist aesthetics (Skiper UI + Kibo UI).

## 📋 Iterative Execution Plan
*AI INSTRUCTION: We will execute this plan one step at a time. Do not move to the next step until I explicitly confirm the current step is tested and working.*

- [ ] **Step 1: Infrastructure & Backend Base**
  - Initialize Node.js backend.
  - Connect to Redis (Docker container).
  - Setup basic Express server and Socket.io instance.
- [ ] **Step 2: The Ephemeral Data Layer (Backend)**
  - Implement Redis `SETEX` (3600s TTL) for all chat messages and room metadata.
  - Create WebSocket event listeners for `join-room`, `send-message`, and `disconnect`.
- [ ] **Step 3: WebRTC Signaling (Backend)**
  - Implement Socket.io relays for WebRTC `offer`, `answer`, and `ice-candidate` payloads.
  - Ensure the backend NEVER stores video data; it only acts as a signaling server.
- [ ] **Step 4: Frontend Base & State (Next.js)**
  - Initialize Next.js 15 (App Router), Tailwind CSS.
  - Setup WebSocket client connection state.
  - Implement room joining and message fetching logic.
- [ ] **Step 5: The Gen Z UI Integration (Frontend)**
  - Integrate **Kibo UI** for the bento-grid layout, chat input, and video dialogs.
  - Integrate **Skiper UI** for animated message cards, text reveals, and cursor trails.
- [ ] **Step 6: P2P Video Integration (Frontend)**
  - Implement `simple-peer` (or native WebRTC).
  - Bind local media streams to the Kibo UI video component.