const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();
connectDB();

const app = express();

// 🟢 1. ย้าย CORS และ Middleware พื้นฐานมาไว้ด้านบนสุดก่อน
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🟢 2. สร้าง HTTP Server ห่อหุ้ม Express app
const server = http.createServer(app);

// 🟢 3. ตั้งค่า Socket.io พร้อมกำหนด CORS ให้ชัดเจน
const io = new Server(server, {
  cors: {
    origin: "*", // หรือใส่ ["http://localhost:5173", "http://localhost:3000"]
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// 🟢 4. ฝาก io เข้า req โดยตรงผ่าน Middleware เพื่อให้ Controller เรียกใช้ `req.io.emit()` ได้ง่ายๆ
app.use((req, res, next) => {
  req.io = io;
  next();
});

// 🟢 5. Event สำหรับดักรับการเชื่อมต่อ WebSocket
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔥 Client disconnected:', socket.id);
  });
});

// 🟢 6. Import Routes ต่างๆ
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/borrows', require('./routes/borrows'));
app.use('/api/users', require('./routes/users'));

app.get('/', (req, res) => {
  res.send('RMU Asset Borrowing API Running...');
});

const PORT = process.env.PORT || 5000;

// 🟢 7. เริ่มรัน Server ด้วย server.listen
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));