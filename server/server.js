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
const AI_PLAYER_ID = 'ai-player';
const AI_THINK_MS = 900;
const ABILITY_COSTS = {
  erase: 2,
  block: 1,
  shield: 1,
  swap: 3,
  undo: 2,
  double: 3
};
const ABILITY_COOLDOWNS = {
  erase: 0,
  block: 0,
  shield: 10000,
  swap: 20000,
  undo: 20000,
  double: 30000
};

function createAbilityUsageState() {
  return {
    X: { erase: false, block: false, shield: false, swap: false, undo: false, double: false },
    O: { erase: false, block: false, shield: false, swap: false, undo: false, double: false }
  };
}

function createAbilityCooldownState() {
  return {
    X: { erase: 0, block: 0, shield: 0, swap: 0, undo: 0, double: 0 },
    O: { erase: 0, block: 0, shield: 0, swap: 0, undo: 0, double: 0 }
  };
}

function getAbilityCooldownRemaining(room, symbol, ability, now = Date.now()) {
  const cooldownMs = ABILITY_COOLDOWNS[ability] || 0;
  if (!cooldownMs) {
    return 0;
  }

  const lastUsedAt = room.abilityCooldowns?.[symbol]?.[ability] || 0;
  return Math.max(0, lastUsedAt + cooldownMs - now);
}

function startAbilityCooldown(room, symbol, ability, now = Date.now()) {
  const cooldownMs = ABILITY_COOLDOWNS[ability] || 0;
  if (!cooldownMs) {
    return;
  }

  room.abilityCooldowns[symbol][ability] = now;
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

function getWinningCombinationForSymbol(board, symbol) {
  return getWinningCombinations().find((combination) => (
    combination.every((index) => board[index] === symbol)
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

function countJoinedPlayers(room) {
  if (room.mode === 'solo') {
    return room.players.X ? 2 : 0;
  }

  return Number(Boolean(room.players.X)) + Number(Boolean(room.players.O));
}

function getEmptyIndexes(board) {
  return board
    .map((value, index) => (value === null ? index : -1))
    .filter((index) => index !== -1);
}

function getCriticalThreat(board, symbol) {
  for (const combination of getWinningCombinations()) {
    const values = combination.map((index) => board[index]);
    const ownCount = values.filter((value) => value === symbol).length;
    const emptyIndexes = combination.filter((index) => board[index] === null);

    if (ownCount === 4 && emptyIndexes.length === 1) {
      return {
        emptyIndex: emptyIndexes[0],
        combination
      };
    }
  }

  return null;
}

function evaluateSwap(board, sourceIndex, targetIndex, symbol, opponent) {
  const clone = [...board];
  clone[sourceIndex] = opponent;
  clone[targetIndex] = symbol;

  return {
    board: clone,
    wins: Boolean(getWinningCombination(clone)),
    score: scoreMove(clone, targetIndex, symbol) + scoreMove(clone, sourceIndex, opponent)
  };
}

function getBestDoubleMove(room, symbol) {
  const emptyIndexes = getEmptyIndexes(room.board)
    .filter((index) => !room.blockedCell || room.blockedCell.index !== index)
    .sort((a, b) => scoreMove(room.board, b, symbol) - scoreMove(room.board, a, symbol))
    .slice(0, 8);

  let bestPair = null;
  let bestScore = -Infinity;

  for (let i = 0; i < emptyIndexes.length; i += 1) {
    for (let j = i + 1; j < emptyIndexes.length; j += 1) {
      const first = emptyIndexes[i];
      const second = emptyIndexes[j];
      const tempBoard = [...room.board];
      tempBoard[first] = symbol;

      if (getWinningCombination(tempBoard)) {
        continue;
      }

      tempBoard[second] = symbol;
      if (getWinningCombination(tempBoard)) {
        continue;
      }

      const pairScore = scoreMove(tempBoard, first, symbol) + scoreMove(tempBoard, second, symbol);
      if (pairScore > bestScore) {
        bestScore = pairScore;
        bestPair = [first, second];
      }
    }
  }

  return bestPair;
}

function scheduleAiTurn(room) {
  if (room.mode === 'solo' && !room.gameEnded && room.currentPlayer === room.aiSymbol) {
    room.aiPendingAt = Date.now() + AI_THINK_MS;
  } else {
    room.aiPendingAt = null;
  }
}

function finishTurn(room, symbol) {
  room.hintUsedThisTurn[symbol] = false;
  room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
  room.energy[room.currentPlayer] = Math.min(MAX_ENERGY, room.energy[room.currentPlayer] + 1);
  clearExpiredBlock(room);
  scheduleAiTurn(room);
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
    mode: 'multi',
    aiSymbol: null,
    aiPendingAt: null,
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
    abilityCooldowns: createAbilityCooldownState(),
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
  return room.mode === 'solo'
    ? Boolean(room.players.X)
    : Boolean(room.players.X) && Boolean(room.players.O);
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
  room.abilityCooldowns = createAbilityCooldownState();
  room.blockedCell = null;
  room.shieldedCells = { X: null, O: null };
  room.lastAction = null;
  room.effect = null;
  room.aiPendingAt = null;
}

function cleanupStalePlayers(room) {
  const now = Date.now();
  let removedSymbol = null;

  for (const symbol of ['X', 'O']) {
    if (room.mode === 'solo' && symbol === room.aiSymbol) {
      continue;
    }

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

function maybeFinishGame(room, symbol) {
  const opponent = symbol === 'X' ? 'O' : 'X';
  const ownWinningCombination = getWinningCombinationForSymbol(room.board, symbol);
  const opponentWinningCombination = getWinningCombinationForSymbol(room.board, opponent);
  const winningCombination = ownWinningCombination || opponentWinningCombination;
  const winnerSymbol = ownWinningCombination ? symbol : opponentWinningCombination ? opponent : null;

  if (winningCombination && winnerSymbol) {
    room.gameEnded = true;
    room.winner = winnerSymbol;
    room.winningCombination = winningCombination;
    room.scores[winnerSymbol] += 1;
    setStatusMessage(room, `${winnerSymbol === 'X' ? '💙' : '💚'} Player ${winnerSymbol} wins this round!`);
    room.aiPendingAt = null;
    return true;
  }

  if (!room.board.includes(null)) {
    room.gameEnded = true;
    room.winner = null;
    room.winningCombination = [];
    setStatusMessage(room, '🤝 It is a tie. Restart to play again.');
    room.aiPendingAt = null;
    return true;
  }

  return false;
}

function performAiTurn(room) {
  const symbol = room.aiSymbol;
  const opponent = symbol === 'X' ? 'O' : 'X';

  if (!symbol || room.gameEnded || room.currentPlayer !== symbol) {
    return;
  }

  clearTransientAction(room);

  const ownWinningMove = findCriticalMove(room.board, symbol);
  if (ownWinningMove !== null && (!room.blockedCell || room.blockedCell.index !== ownWinningMove)) {
    room.board[ownWinningMove] = symbol;
    room.lastMoveIndex = ownWinningMove;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'move', symbol, index: ownWinningMove };
    setEffect(room, { type: 'move', symbol, indexes: [ownWinningMove] });
    maybeFinishGame(room, symbol);
    return;
  }

  if (
    room.energy[symbol] >= ABILITY_COSTS.undo
    && getAbilityCooldownRemaining(room, symbol, 'undo') === 0
    && room.lastAction
    && room.lastAction.type === 'move'
    && room.lastAction.symbol === opponent
  ) {
    const threatAfterLastMove = getCriticalThreat(room.board, opponent);
    if (threatAfterLastMove && threatAfterLastMove.combination.includes(room.lastAction.index)) {
      const undoIndex = room.lastAction.index;
      room.board[undoIndex] = null;
      if (room.lastMoveIndex === undoIndex) {
        room.lastMoveIndex = null;
      }
      room.energy[symbol] -= ABILITY_COSTS.undo;
      startAbilityCooldown(room, symbol, 'undo');
      room.playerLastSeen[symbol] = Date.now();
      room.updatedAt = Date.now();
      room.lastAction = { type: 'undo', symbol, index: undoIndex };
      setEffect(room, { type: 'undo', symbol, index: undoIndex, undoneSymbol: opponent });
      finishTurn(room, symbol);
      setStatusMessage(room, `⏪ AI ${symbol} rewound your last move.`);
      return;
    }
  }

  const enemyThreat = getCriticalThreat(room.board, opponent);

  if (
    enemyThreat
    && room.energy[symbol] >= ABILITY_COSTS.erase
    && !room.abilityUsed[symbol].erase
  ) {
    const eraseTarget = enemyThreat.combination.find((index) => room.board[index] === opponent && room.shieldedCells[opponent] !== index);
    if (eraseTarget !== undefined) {
      room.board[eraseTarget] = null;
      if (room.lastMoveIndex === eraseTarget) {
        room.lastMoveIndex = null;
      }
      room.energy[symbol] -= ABILITY_COSTS.erase;
      room.abilityUsed[symbol].erase = true;
      room.playerLastSeen[symbol] = Date.now();
      room.updatedAt = Date.now();
      room.lastAction = { type: 'erase', symbol, index: eraseTarget, erasedSymbol: opponent };
      setEffect(room, { type: 'erase', symbol, index: eraseTarget, erasedSymbol: opponent });
      finishTurn(room, symbol);
      setStatusMessage(room, `🔄 AI ${symbol} erased one of your marks.`);
      return;
    }
  }

  if (
    enemyThreat
    && room.energy[symbol] >= ABILITY_COSTS.block
    && !room.abilityUsed[symbol].block
    && room.board[enemyThreat.emptyIndex] === null
  ) {
    room.blockedCell = { index: enemyThreat.emptyIndex, owner: symbol };
    room.energy[symbol] -= ABILITY_COSTS.block;
    room.abilityUsed[symbol].block = true;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'block', symbol, index: enemyThreat.emptyIndex };
    setEffect(room, { type: 'block', symbol, index: enemyThreat.emptyIndex });
    finishTurn(room, symbol);
    setStatusMessage(room, `⛔ AI ${symbol} froze a dangerous cell.`);
    return;
  }

  if (
    room.energy[symbol] >= ABILITY_COSTS.swap
    && getAbilityCooldownRemaining(room, symbol, 'swap') === 0
  ) {
    const ownMarks = room.board
      .map((value, index) => (value === symbol && room.shieldedCells[symbol] !== index ? index : -1))
      .filter((index) => index !== -1);
    const enemyMarks = room.board
      .map((value, index) => (value === opponent && room.shieldedCells[opponent] !== index ? index : -1))
      .filter((index) => index !== -1);

    let bestSwap = null;

    for (const sourceIndex of ownMarks) {
      for (const targetIndex of enemyMarks) {
        const swapResult = evaluateSwap(room.board, sourceIndex, targetIndex, symbol, opponent);
        if (swapResult.wins) {
          bestSwap = { sourceIndex, targetIndex };
          break;
        }

        if (!bestSwap || swapResult.score > bestSwap.score) {
          bestSwap = { sourceIndex, targetIndex, score: swapResult.score };
        }
      }

      if (bestSwap?.score === undefined) {
        break;
      }
    }

    if (bestSwap && (bestSwap.score === undefined || bestSwap.score > 40)) {
      room.board[bestSwap.sourceIndex] = opponent;
      room.board[bestSwap.targetIndex] = symbol;
      room.lastMoveIndex = bestSwap.targetIndex;
      room.energy[symbol] -= ABILITY_COSTS.swap;
      startAbilityCooldown(room, symbol, 'swap');
      room.playerLastSeen[symbol] = Date.now();
      room.updatedAt = Date.now();
      room.lastAction = { type: 'swap', symbol, sourceIndex: bestSwap.sourceIndex, targetIndex: bestSwap.targetIndex };
      setEffect(room, { type: 'swap', symbol, sourceIndex: bestSwap.sourceIndex, targetIndex: bestSwap.targetIndex });

      if (!maybeFinishGame(room, symbol)) {
        finishTurn(room, symbol);
        setStatusMessage(room, `🔁 AI ${symbol} reshuffled the board.`);
      }
      return;
    }
  }

  if (
    room.energy[symbol] >= ABILITY_COSTS.double
    && getAbilityCooldownRemaining(room, symbol, 'double') === 0
  ) {
    const doublePair = getBestDoubleMove(room, symbol);
    if (doublePair) {
      room.board[doublePair[0]] = symbol;
      room.board[doublePair[1]] = symbol;
      room.lastMoveIndex = doublePair[1];
      room.energy[symbol] -= ABILITY_COSTS.double;
      startAbilityCooldown(room, symbol, 'double');
      room.playerLastSeen[symbol] = Date.now();
      room.updatedAt = Date.now();
      room.lastAction = { type: 'double', symbol, indexes: [...doublePair] };
      setEffect(room, { type: 'double', symbol, indexes: [...doublePair] });

      if (!maybeFinishGame(room, symbol)) {
        finishTurn(room, symbol);
        setStatusMessage(room, `⚡ AI ${symbol} played a double move.`);
      }
      return;
    }
  }

  if (
    room.energy[symbol] >= ABILITY_COSTS.shield
    && getAbilityCooldownRemaining(room, symbol, 'shield') === 0
  ) {
    const ownMarks = room.board
      .map((value, index) => (value === symbol ? index : -1))
      .filter((index) => index !== -1)
      .sort((a, b) => scoreMove(room.board, b, symbol) - scoreMove(room.board, a, symbol));

    if (ownMarks.length > 0) {
      const shieldIndex = ownMarks[0];
      room.shieldedCells[symbol] = shieldIndex;
      room.energy[symbol] -= ABILITY_COSTS.shield;
      startAbilityCooldown(room, symbol, 'shield');
      room.playerLastSeen[symbol] = Date.now();
      room.updatedAt = Date.now();
      room.lastAction = { type: 'shield', symbol, index: shieldIndex };
      setEffect(room, { type: 'shield', symbol, index: shieldIndex });
      finishTurn(room, symbol);
      setStatusMessage(room, `🛡️ AI ${symbol} shielded a key mark.`);
      return;
    }
  }

  const playableMoves = getEmptyIndexes(room.board)
    .filter((index) => !room.blockedCell || room.blockedCell.index !== index)
    .sort((a, b) => scoreMove(room.board, b, symbol) - scoreMove(room.board, a, symbol));
  const hintedMove = getHintMove(room, symbol);
  const normalMove = hintedMove !== null && playableMoves.includes(hintedMove) ? hintedMove : playableMoves[0];

  if (normalMove !== undefined) {
    room.board[normalMove] = symbol;
    room.lastMoveIndex = normalMove;
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'move', symbol, index: normalMove };
    setEffect(room, { type: 'move', symbol, indexes: [normalMove] });

    if (!maybeFinishGame(room, symbol)) {
      finishTurn(room, symbol);
      setStatusMessage(room, `🤖 AI ${symbol} made its move.`);
    }
  }
}

function processAiTurn(room) {
  if (
    room.mode === 'solo'
    && room.aiSymbol
    && room.currentPlayer === room.aiSymbol
    && !room.gameEnded
    && room.aiPendingAt
    && Date.now() >= room.aiPendingAt
  ) {
    room.aiPendingAt = null;
    performAiTurn(room);
  }
}

function serializeRoom(room, playerId) {
  cleanupStalePlayers(room);
  processAiTurn(room);
  const symbol = room.players.X === playerId ? 'X' : room.players.O === playerId ? 'O' : null;
  const playersJoined = countJoinedPlayers(room);

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
    abilityCooldownDurations: ABILITY_COOLDOWNS,
    abilityCooldowns: room.abilityCooldowns,
    hintUsedThisTurn: room.hintUsedThisTurn,
    abilityUsed: room.abilityUsed,
    blockedCell: room.blockedCell,
    shieldedCells: room.shieldedCells,
    effect: room.effect,
    effectVersion: room.effectVersion,
    statusMessage: room.statusMessage,
    statusVersion: room.statusVersion,
    yourSymbol: symbol,
    playersJoined,
    isSolo: room.mode === 'solo',
    aiThinking: room.mode === 'solo' && room.currentPlayer === room.aiSymbol && !room.gameEnded
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

app.post('/api/rooms/solo', (req, res) => {
  const room = createRoom();
  const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  room.mode = 'solo';
  room.aiSymbol = 'O';
  room.players.X = playerId;
  room.players.O = AI_PLAYER_ID;
  room.playerLastSeen.X = Date.now();
  room.playerLastSeen.O = Date.now();
  room.updatedAt = Date.now();
  setStatusMessage(room, `🤖 Solo room ${room.roomCode} created. You are X versus AI.`);

  res.json({
    roomCode: room.roomCode,
    playerId,
    symbol: 'X',
    isSolo: true
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
  const cooldownRemaining = getAbilityCooldownRemaining(room, symbol, ability);
  const isLimitedRoundAbility = ability === 'erase' || ability === 'block';

  if (room.energy[symbol] < energyCost) {
    res.status(409).json({ error: `${ability} needs ${energyCost} energy.` });
    return;
  }

  if (isLimitedRoundAbility && room.abilityUsed[symbol][ability]) {
    res.status(409).json({ error: `${ability} was already used this round.` });
    return;
  }

  if (!isLimitedRoundAbility && cooldownRemaining > 0) {
    res.status(409).json({ error: `${ability} is cooling down for ${Math.ceil(cooldownRemaining / 1000)}s.` });
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
    startAbilityCooldown(room, symbol, 'undo');
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
    startAbilityCooldown(room, symbol, 'double');
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
    startAbilityCooldown(room, symbol, 'swap');
    room.playerLastSeen[symbol] = Date.now();
    room.updatedAt = Date.now();
    room.lastAction = { type: 'swap', symbol, sourceIndex, targetIndex: index };
    setEffect(room, { type: 'swap', symbol, sourceIndex, targetIndex: index });

    if (!maybeFinishGame(room, symbol)) {
      finishTurn(room, symbol);
      setStatusMessage(room, `🔁 Player ${symbol} swapped the board positions.`);
    }

    res.json(serializeRoom(room, playerId));
    return;
  }

  if (room.board[index] !== symbol) {
    res.status(409).json({ error: 'Shield only works on one of your own marks.' });
    return;
  }

  room.shieldedCells[symbol] = index;
  room.energy[symbol] -= energyCost;
  startAbilityCooldown(room, symbol, 'shield');
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
