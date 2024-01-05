const socket = io('http://localhost:3000');
function handleConnection() {
    socket.on('connect', () => {
        multiplayer.getPlayerID(socket.id)
    })
}
window.socketIO = { handleConnection }