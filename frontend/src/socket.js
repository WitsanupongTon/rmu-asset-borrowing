import { io } from 'socket.io-client';

// ใช้ค่าจาก Environment Variable บน Vercel ถ้าไม่มีให้ถอยไปใช้ URL Render ตรงๆ
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://rmu-asset-borrowing.onrender.com';

const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['polling', 'websocket']
});

export default socket;