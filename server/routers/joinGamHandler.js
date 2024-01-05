// routes/chat.js
const express = require('express');
const router = express.Router();
const path = require('path')
// Define the Socket.IO logic within the router
router.io = null; // This property will be set by app.js

router.get('/', (req, res) => {
   res.send(router.io)
});
// Check if router.io is defined before using it
if (router.io) {
    router.io.on('connection', (socket) => {
        console.log('A user connected');

        // Handle events from the client within this specific route
        socket.on('chat message', (msg) => {
            console.log('Message from client:', msg);

            // Broadcast the message to all connected clients in this route
            router.io.emit('chat message', msg);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });
} else {
    console.error('Socket.IO not properly set in router');
}

module.exports = router;
