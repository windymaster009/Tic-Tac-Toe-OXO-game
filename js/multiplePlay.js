const state = {
    socket: null,
    playerID: null,
    playerSymbol: null,
    roomCode: '',
    connected: false
};

function init(socket) {
    state.socket = socket || null;

    if (!state.socket) {
        return state;
    }

    if (state.socket.connected) {
        state.connected = true;
        state.playerID = state.socket.id;
    }

    state.socket.on('connect', () => {
        state.connected = true;
        state.playerID = state.socket.id;
    });

    state.socket.on('disconnect', () => {
        state.connected = false;
    });

    return state;
}

function getState() {
    return { ...state };
}

function setPlayer(symbol, roomCode) {
    state.playerSymbol = symbol;
    state.roomCode = roomCode;
}

window.multiplayer = {
    init,
    getState,
    setPlayer
};
