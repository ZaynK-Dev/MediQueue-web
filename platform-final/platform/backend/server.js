const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

// Set up Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Pass io instance to request
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

const { startNotificationListener } = require('./services/NotificationService');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/hospitals', require('./routes/hospitals'));
app.use('/api/appointments', require('./routes/appointments'));

// Start listening for Firestore changes
startNotificationListener();

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));