let socket = null;

if (typeof io === 'function') {
    const socketHost = window.location.hostname || '127.0.0.1';
    socket = io(`http://${socketHost}:3000`);
}

function handleConnection() {
    if (!socket) {
        console.warn('Socket.IO client is unavailable. Running in local mode.');
        return;
    }
}

function getSocket() {
    return socket;
}

window.socketIO = { handleConnection, getSocket };
