import { io } from 'socket.io-client';

const SOCKET_URL = 'https://rmu-asset-borrowing.onrender.com';

const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['polling', 'websocket']
});

export default socket;