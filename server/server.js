const express = require('express');
const { createServer } = require('node:http');
const path = require('node:path');

const app = express();
const server = createServer(app);
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const rooms = new Map();
const clientRoot = path.resolve(__dirname, '..');
const PLAYER_STALE_MS = 12000;
const MAX_ENERGY = 4;
const ABILITY_COSTS = {
  erase: 2,
  block: 1,
  shield: 1,
  swap: 3,
  undo: 2,
  double: 3
};

function createAbilityUsageState() {
  return {
    X: { erase: false, block: false, shield: false, swap: false, undo: false, double: false },
    O: { erase: false, block: false, shield: false, swap: false, undo: false, double: false }
  };
}

app.use(express.json());
app.use(express.static(clientRoot));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

function createRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));

  return code;
}

function getWinningCombination(board) {
  const winningCombinations = [
    [0, 1, 2, 3, 4], [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10], [7, 8, 9, 10, 11],
    [12, 13, 14, 15, 16], [13, 14, 15, 16, 17],
    [18, 19, 20, 21, 22], [19, 20, 21, 22, 23],
    [24, 25, 26, 27, 28], [25, 26, 27, 28, 29],
    [30, 31, 32, 33, 34], [31, 32, 33, 34, 35],
    [0, 6, 12, 18, 24], [6, 12, 18, 24, 30],
    [1, 7, 13, 19, 25], [7, 13, 19, 25, 31],
    [2, 8, 14, 20, 26], [8, 14, 20, 26, 32],
    [3, 9, 15, 21, 27], [9, 15, 21, 27, 33],
    [4, 10, 16, 22, 28], [10, 16, 22, 28, 34],
    [5, 11, 17, 23, 29], [11, 17, 23, 29, 35],
    [0, 7, 14, 21, 28], [1, 8, 15, 22, 29],
    [5, 10, 15, 20, 25], [6, 13, 20, 27, 34]
  ];

  return winningCombinations.find((combination) => (
    combination.every((index) => board[index] && board[index] === board[combination[0]])
  )) || null;
}

function getWinningCombinations() {
  return [
    [0, 1, 2, 3, 4], [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10], [7, 8, 9, 10, 11],
    [12, 13, 14, 15, 16], [13, 14, 15, 16, 17],
    [18, 19, 20, 21, 22], [19, 20, 21, 22, 23],
    [24, 25, 26, 27, 28], [25, 26, 27, 28, 29],
    [30, 31, 32, 33, 34], [31, 32, 33, 34, 35],
    [0, 6, 12, 18, 24], [6, 12, 18, 24, 30],
    [1, 7, 13, 19, 25], [7, 13, 19, 25, 31],
    [2, 8, 14, 20, 26], [8, 14, 20, 26, 32],
    [3, 9, 15, 21, 27], [9, 15, 21, 27, 33],
    [4, 10, 16, 22, 28], [10, 16, 22, 28, 34],
    [5, 11, 17, 23, 29], [11, 17, 23, 29, 35],
    [0, 7, 14, 21, 28], [1, 8, 15, 22, 29],
    [5, 10, 15, 20, 25], [6, 13, 20, 27, 34]
  ];
}

function findCriticalMove(board, symbol) {
  const combinations = getWinningCombinations();

  for (const combination of combinations) {
    const values = combination.map((index) => board[index]);
    const symbolCount = values.filter((value) => value === symbol).length;
    const emptyIndexes = combination.filter((index) => board[index] === null);

    if (symbolCount === 4 && emptyIndexes.length === 1) {
      return emptyIndexes[0];
    }
  }

  return null;
}

function scoreMove(board, index, symbol) {
  const combinations = getWinningCombinations().filter((combination) => combination.includes(index));
  let score = 0;

  for (const combination of combinations) {
    const values = combination.map((cellIndex) => board[cellIndex]);
    const ownCount = values.filter((value) => value === symbol).length;
    const emptyCount = values.filter((value) => value === null).length;

    if (ownCount > 0) {
      score += ownCount * 12 + emptyCount * 2;
    }
  }

  const row = Math.floor(index / 6);
  const col = index % 6;
  const distanceFromCenter = Math.abs(2.5 - row) + Math.abs(2.5 - col);

  return score - distanceFromCenter;
}

function getHintMove(room, symbol) {
  const board = room.board;
  const opponent = symbol === 'X' ? 'O' : 'X';
  const emptyIndexes = board
    .map((value, index) => (value === null ? index : -1))
    .filter((index) => index !== -1);

  if (emptyIndexes.length === 0) {
    return null;
  }

  const winningMove = findCriticalMove(board, symbol);
  if (winningMove !== null) {
    return winningMove;
  }

  const blockingMove = findCriticalMove(board, opponent);
  if (blockingMove !== null) {
    return blockingMove;
  }

  return emptyIndexes.sort((a, b) => scoreMove(board, b, symbol) - scoreMove(board, a, symbol))[0];
}

function clearExpiredBlock(room) {
  if (room.blockedCell && room.currentPlayer === room.blockedCell.owner) {
    room.blockedCell = null;
  }
}

function finishTurn(room, symbol) {
  room.hintUsedThisTurn[symbol] = false;
  room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
  room.energy[room.currentPlayer] = Math.min(MAX_ENERGY, room.energy[room.currentPlayer] + 1);
  clearExpiredBlock(room);
}

function setEffect(room, effect) {
  room.effect = effect;
  room.effectVersion += 1;
}

function clearTransientAction(room) {
  room.effect = null;
}

function createRoom() {
  const roomCode = createRoomCode();
  const room = {
    roomCode,
    board: Array(36).fill(null),
    currentPlayer: 'X',
    gameEnded: false,
    lastMoveIndex: null,
    winner: null,
    winningCombination: [],
    players: {
      X: null,
      O: null
    },
    playerLastSeen: {
      X: 0,
      O: 0
    },
    scores: {
      X: 0,
      O: 0
    },
    hintsRemaining: {
      X: 3,
      O: 3
    },
    energy: {
      X: 1,
      O: 0
    },
    hintUsedThisTurn: {
      X: false,
      O: false
    },
    abilityUsed: createAbilityUsageState(),
    blockedCell: null,
    shieldedCells: {
      X: null,
      O: null
    },
    lastAction: null,
    effect: null,
    effectVersion: 0,
    statusMessage: '',
    statusVersion: 0,
    updatedAt: Date.now()
  };

  rooms.set(roomCode, room);
  return room;
}

function getRoom(roomCode) {
  return rooms.get(String(roomCode || '').trim().toUpperCase());
}

function setStatusMessage(room, message) {
  room.statusMessage = message;
  room.statusVersion += 1;
}

function hasTwoPlayers(room) {
  return Boolean(room.players.X) && Boolean(room.players.O);
}

function resetRoundState(room) {
  room.board = Array(36).fill(null);
  room.currentPlayer = 'X';
  room.gameEnded = false;
  room.lastMoveIndex = null;
  room.winner = null;
  room.winningCombination = [];
  room.hintsRemaining = { X: 3, O: 3 };
  room.energy = { X: 1, O: 0 };
  room.hintUsedThisTurn = { X: false, O: false };
  room.abilityUsed = createAbilityUsageState();
  room.blockedCell = null;
  room.shieldedCells = { X: null, O: null };
  room.lastAction = null;
  room.effect = null;
}

function cleanupStalePlayers(room) {
  const now = Date.now();
  let removedSymbol = null;

  for (const symbol of ['X', 'O']) {
    if (room.players[symbol] && now - room.playerLastSeen[symbol] > PLAYER_STALE_MS) {
      room.players[symbol] = null;
      room.playerLastSeen[symbol] = 0;
      removedSymbol = symbol;
    }
  }

  if (removedSymbol) {
    resetRoundState(room);
    setStatusMessage(room, `👋 Player ${removedSymbol} left the room. Waiting for another player.`);
  }
}

function serializeRoom(room, playerId) {
  cleanupStalePlayers(room);
  const symbol = room.players.X === playerId ? 'X' : room.players.O === playerId ? 'O' : null;
  const playersJoined = Number(Boolean(room.players.X)) + Number(Boolean(room.players.O));

  return {
    roomCode: room.roomCode,
    board: room.board,
    currentPlayer: room.currentPlayer,
    gameEnded: room.gameEnded,
    lastMoveIndex: room.lastMoveIndex,
    winner: room.winner,
    winningCombination: room.winningCombination,
    scores: room.scores,
    hintsRemaining: room.hintsRemaining,
    energy: room.energy,
    abilityCosts: ABILITY_COSTS,
    hintUsedThisTurn: room.hintUsedThisTurn,
    abilityUsed: room.abilityUsed,
    blockedCell: room.blockedCell,
    shieldedCells: room.shieldedCells,
    effect: room.effect,
    effectVersion: room.effectVersion,
    statusMessage: room.statusMessage,
    statusVersion: room.statusVersion,
    yourSymbol: symbol,
    playersJoined
  };
}

app.post('/api/rooms', (req, res) => {
  const room = createRoom();
  const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  room.players.X = playerId;
  room.playerLastSeen.X = Date.now();
  room.updatedAt = Date.now();
  setStatusMessage(room, `🎯 Room ${room.roomCode} created. Waiting for player O.`);

  res.json({
    roomCode: room.roomCode,
    playerId,
    symbol: 'X'
  });
});

app.post('/api/rooms/join', (req, res) => {
  const room = getRoom(req.body.roomCode);

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  if (room.players.O) {
    res.status(409).json({ error: 'Room is full.' });
    return;
  }

  const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  room.players.O = playerId;
  room.playerLastSeen.O = Date.now();
  room.updatedAt = Date.now();
  setStatusMessage(room, `🤝 Player O joined room ${room.roomCode}. Game on!`);

  res.json({
    roomCode: room.roomCode,
    playerId,
    symbol: 'O'
  });
});

app.get('/api/rooms/:roomCode', (req, res) => {
  const room = getRoom(req.params.roomCode);
  const playerId = String(req.query.playerId || '');

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  if (room.players.X === playerId) {
    room.playerLastSeen.X = Date.now();
  }

  if (room.players.O === playerId) {
    room.playerLastSeen.O = Date.now();
  }

  res.json(serializeRoom(room, playerId));
});

app.post('/api/rooms/:roomCode/move', (req, res) => {
  const room = getRoom(req.params.roomCode);
  const { playerId, index } = req.body;

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const symbol = room.players.X === playerId ? 'X' : room.players.O === playerId ? 'O' : null;

  if (!symbol) {
    res.status(403).json({ error: 'Player is not part of this room.' });
    return;
  }

  if (room.gameEnded) {
    res.status(409).json({ error: 'Game already ended.' });
    return;
  }

  if (symbol !== room.currentPlayer) {
    res.status(409).json({ error: 'It is not your turn.' });
    return;
  }

  if (!hasTwoPlayers(room)) {
    res.status(409).json({ error: 'Wait for both players to join first.' });
    return;
  }

  if (typeof index !== 'number' || index < 0 || index >= room.board.length || room.board[index]) {
    res.status(400).json({ error: 'Invalid move.' });
    return;
  }

  if (room.blockedCell && room.blockedCell.index === index) {
    res.status(409).json({ error: 'That cell is blocked for this turn.' });
    return;
  }

  room.board[index] = symbol;
  room.lastMoveIndex = index;
  room.playerLastSeen[symbol] = Date.now();
  room.updatedAt = Date.now();
  clearTransientAction(room);

  const winningCombination = getWinningCombination(room.board);

  if (winningCombination) {
    room.gameEnded = true;
    room.winner = symbol;
    room.winningCombination = winningCombination;
    room.scores[symbol] += 1;
  } else if (!room.board.includes(null)) {
    room.gameEnded = true;
    room.winner = null;
    room.winningCombination = [];
    setStatusMessage(room, '🤝 It is a tie. Restart to play again.');
  } else {
    room.lastAction = { type: 'move', symbol, index };
    setEffect(room, { type: 'move', symbol, indexes: [index] });
    finishTurn(room, symbol);
  }

  if (winningCombination) {
    setStatusMessage(room, `${symbol === 'X' ? '💙' : '💚'} Player ${symbol} wins this round!`);
  }

  res.json(serializeRoom(room, playerId));
});

app.post('/api/rooms/:roomCode/ability', (req, res) => {
  const room = getRoom(req.params.roomCode);
  const { playerId, ability, index } = req.body;

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const symbol = room.players.X === playerId ? 'X' : room.players.O === playerId ? 'O' : null;
  const opponent = symbol === 'X' ? 'O' : 'X';

  if (!symbol) {
    res.status(403).json({ error: 'Player is not part of this room.' });
    return;
  }

  if (room.gameEnded) {
    res.status(409).json({ error: 'Game already ended.' });
    return;
  }

  if (room.currentPlayer !== symbol) {
    res.status(409).json({ error: 'Abilities only work on your turn.' });
    return;
  }

  if (!hasTwoPlayers(room)) {
    res.status(409).json({ error: 'Wait for both players to join first.' });
    return;
  }

  if (!['erase', 'block', 'shield', 'swap', 'undo', 'double'].includes(ability)) {
    res.status(400).json({ error: 'Unknown ability.' });
    return;
  }

  const energyCost = ABILITY_COSTS[ability];

  if (room.energy[symbol] < energyCost) {
    res.status(409).json({ error: `${ability} needs ${energyCost} energy.` });
    return;
  }

  if (room.abilityUsed[symbol][ability]) {
    res.status(409).json({ error: `${ability} was already used this round.` });
    return;
  }

  const ensureIndex = (value) => typeof value === 'number' && value >= 0 && value < room.board.length;
  clearTransientAction(room);

  if (ability === 'undo') {
    if (!room.lastAction || room.lastAction.type !== 'move' || room.lastAction.symbol !== opponent) {
      res.status(409).json({ error: 'Undo only works right after the opponent places a move.' });
      return;
    }

    const undoIndex = room.lastAction.index;
    room.board[undoIndex] = null;
    if (room.lastMoveIndex === undoIndex) {
      room.lastMoveIndex = null;
    }
    room.energy[symbol] -= energyCost;
    room.abilityUsed[symbol].undo = true;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'undo', symbol, index: undoIndex };
    setEffect(room, { type: 'undo', symbol, index: undoIndex, undoneSymbol: opponent });
    finishTurn(room, symbol);
    setStatusMessage(room, `⏪ Player ${symbol} rewound ${opponent}'s last move.`);
    res.json(serializeRoom(room, playerId));
    return;
  }

  if (ability === 'double') {
    const indexes = Array.isArray(req.body.indexes) ? req.body.indexes : [];

    if (indexes.length !== 2 || !indexes.every(ensureIndex) || indexes[0] === indexes[1]) {
      res.status(400).json({ error: 'Double move needs two different target cells.' });
      return;
    }

    if (indexes.some((cellIndex) => room.board[cellIndex] !== null)) {
      res.status(409).json({ error: 'Double move only works on empty cells.' });
      return;
    }

    if (room.blockedCell && indexes.includes(room.blockedCell.index)) {
      res.status(409).json({ error: 'Blocked cells cannot be used for double move.' });
      return;
    }

    const tempBoard = [...room.board];
    tempBoard[indexes[0]] = symbol;
    if (getWinningCombination(tempBoard)) {
      res.status(409).json({ error: 'Double move cannot create an instant win.' });
      return;
    }
    tempBoard[indexes[1]] = symbol;
    if (getWinningCombination(tempBoard)) {
      res.status(409).json({ error: 'Double move cannot create an instant win.' });
      return;
    }

    room.board[indexes[0]] = symbol;
    room.board[indexes[1]] = symbol;
    room.lastMoveIndex = indexes[1];
    room.energy[symbol] -= energyCost;
    room.abilityUsed[symbol].double = true;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'double', symbol, indexes: [...indexes] };
    setEffect(room, { type: 'double', symbol, indexes: [...indexes] });
    finishTurn(room, symbol);
    setStatusMessage(room, `⚡ Player ${symbol} unleashed a double move.`);
    res.json(serializeRoom(room, playerId));
    return;
  }

  if (!ensureIndex(index)) {
    res.status(400).json({ error: 'Invalid target cell.' });
    return;
  }

  if (ability === 'erase') {
    if (room.board[index] !== opponent) {
      res.status(409).json({ error: 'Erase only works on an opponent mark.' });
      return;
    }

    if (room.shieldedCells[opponent] === index) {
      res.status(409).json({ error: 'That mark is protected by a shield.' });
      return;
    }

    room.board[index] = null;
    if (room.lastMoveIndex === index) {
      room.lastMoveIndex = null;
    }
    room.energy[symbol] -= energyCost;
    room.abilityUsed[symbol].erase = true;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'erase', symbol, index, erasedSymbol: opponent };
    setEffect(room, { type: 'erase', symbol, index, erasedSymbol: opponent });
    finishTurn(room, symbol);
    setStatusMessage(room, `🔄 Player ${symbol} erased one of ${opponent}'s marks.`);
    res.json(serializeRoom(room, playerId));
    return;
  }

  if (ability === 'block') {
    if (room.board[index] !== null) {
      res.status(409).json({ error: 'Block only works on an empty cell.' });
      return;
    }

    if (room.blockedCell && room.blockedCell.index === index) {
      res.status(409).json({ error: 'That cell is already blocked.' });
      return;
    }

    room.blockedCell = { index, owner: symbol };
    room.energy[symbol] -= energyCost;
    room.abilityUsed[symbol].block = true;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'block', symbol, index };
    setEffect(room, { type: 'block', symbol, index });
    finishTurn(room, symbol);
    setStatusMessage(room, `⛔ Player ${symbol} blocked a cell for ${opponent}'s next turn.`);
    res.json(serializeRoom(room, playerId));
    return;
  }

  if (ability === 'swap') {
    const sourceIndex = req.body.sourceIndex;

    if (!ensureIndex(sourceIndex)) {
      res.status(400).json({ error: 'Swap needs a valid source cell.' });
      return;
    }

    if (room.board[sourceIndex] !== symbol || room.board[index] !== opponent) {
      res.status(409).json({ error: 'Swap needs one of your marks and one enemy mark.' });
      return;
    }

    if (room.shieldedCells[symbol] === sourceIndex || room.shieldedCells[opponent] === index) {
      res.status(409).json({ error: 'Shielded cells cannot be swapped.' });
      return;
    }

    room.board[sourceIndex] = opponent;
    room.board[index] = symbol;
    room.lastMoveIndex = index;
    room.energy[symbol] -= energyCost;
    room.abilityUsed[symbol].swap = true;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'swap', symbol, sourceIndex, targetIndex: index };
    setEffect(room, { type: 'swap', symbol, sourceIndex, targetIndex: index });
    finishTurn(room, symbol);
    setStatusMessage(room, `🔁 Player ${symbol} swapped the board positions.`);
    res.json(serializeRoom(room, playerId));
    return;
  }

  if (room.board[index] !== symbol) {
    res.status(409).json({ error: 'Shield only works on one of your own marks.' });
    return;
  }

  room.shieldedCells[symbol] = index;
  room.energy[symbol] -= energyCost;
  room.abilityUsed[symbol].shield = true;
  room.playerLastSeen[symbol] = Date.now();
  room.updatedAt = Date.now();
  room.lastAction = { type: 'shield', symbol, index };
  setEffect(room, { type: 'shield', symbol, index });
  finishTurn(room, symbol);
  setStatusMessage(room, `🛡️ Player ${symbol} shielded one mark from erase.`);
  res.json(serializeRoom(room, playerId));
});

app.post('/api/rooms/:roomCode/restart', (req, res) => {
  const room = getRoom(req.params.roomCode);
  const { playerId } = req.body;

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const symbol = room.players.X === playerId ? 'X' : room.players.O === playerId ? 'O' : null;

  if (!symbol) {
    res.status(403).json({ error: 'Player is not part of this room.' });
    return;
  }

  resetRoundState(room);
  room.updatedAt = Date.now();
  setStatusMessage(room, '🔄 New round started. X goes first.');

  res.json(serializeRoom(room, playerId));
});

app.post('/api/rooms/:roomCode/hint', (req, res) => {
  const room = getRoom(req.params.roomCode);
  const { playerId } = req.body;

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const symbol = room.players.X === playerId ? 'X' : room.players.O === playerId ? 'O' : null;

  if (!symbol) {
    res.status(403).json({ error: 'Player is not part of this room.' });
    return;
  }

  if (room.gameEnded) {
    res.status(409).json({ error: 'Game already ended.' });
    return;
  }

  if (room.currentPlayer !== symbol) {
    res.status(409).json({ error: 'Hints only work on your turn.' });
    return;
  }

  if (!hasTwoPlayers(room)) {
    res.status(409).json({ error: 'Wait for both players to join first.' });
    return;
  }

  if (room.hintsRemaining[symbol] <= 0) {
    res.status(409).json({ error: 'No hints left this match.' });
    return;
  }

  if (room.hintUsedThisTurn[symbol]) {
    res.status(409).json({ error: 'You already used help this turn. Wait for your next turn.' });
    return;
  }

  const hintIndex = getHintMove(room, symbol);

  if (hintIndex === null) {
    res.status(409).json({ error: 'No valid hint available.' });
    return;
  }

  room.hintsRemaining[symbol] -= 1;
  room.hintUsedThisTurn[symbol] = true;
  room.playerLastSeen[symbol] = Date.now();

  res.json({
    hintIndex,
    hintsRemaining: room.hintsRemaining[symbol]
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(clientRoot, 'index.html'));
});

server.listen(PORT, HOST, () => {
  console.log(`server running on ${HOST}:${PORT}`);
});
