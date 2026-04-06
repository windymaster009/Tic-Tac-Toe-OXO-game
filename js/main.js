const {
    board,
    roomCodeInput,
    createRoomButton,
    soloRoomButton,
    joinRoomButton,
    copyRoomButton,
    shareRoomButton,
    hintButton,
    musicToggleButton,
    musicVolumeInput,
    connectionStatusElement,
    playerStatusElement,
    resultElement,
    restartButton,
    scoreElement,
    scoreXValueElement,
    scoreOValueElement,
    moodXElement,
    moodOElement,
    toastElement,
    confirmModal,
    confirmMessageElement,
    confirmCancelButton,
    confirmOkButton,
    abilityButtons,
    abilityBars,
    winLineElement,
    fireworksCanvas,
    fireworksCtx,
    cells
} = window.gameDom;
const {
    unlockAudio,
    playMoveSound,
    playEraseSound,
    playInvalidSound,
    playWinSound,
    playSwapSound,
    playUndoSound,
    playDoubleSound,
    setMusicMode,
    setMusicVolume,
    toggleMusicMute,
    setMusicMuted,
    getMusicSettings
} = window.gameAudio;
const {
    apiBaseUrl,
    animatedEmojiBaseUrl,
    animatedMoodAssets,
    clientWinningCombinations
} = window.gameConfig;

fireworksCanvas.width = window.innerWidth;
fireworksCanvas.height = window.innerHeight;

let pollTimer = null;
let fireworks = [];
let effectParticles = [];
let roomCode = '';
let playerId = '';
let playerSymbol = '';
let playersJoined = 0;
let isSoloGame = false;
let aiThinking = false;
let gameBoardState = Array(36).fill(null);
let currentPlayer = 'X';
let gameEnded = false;
let xWins = 0;
let oWins = 0;
let winningCells = [];
let lastWinner = null;
let fireworksTimer = null;
let fireworksAnimationRunning = false;
let lastMoveIndex = null;
let lastMoveSymbol = null;
let recentMoveIndex = null;
let recentMoveSymbol = null;
let recentMoveTimer = null;
let hintTimer = null;
let toastVisible = false;
let toastType = '';
let toastIdCounter = 0;
let toastEntries = [];
let hintIndex = null;
let clutchCells = [];
let clutchSymbol = null;
let hintsRemaining = { X: 3, O: 3 };
let energy = { X: 1, O: 0 };
let abilityCosts = { erase: 2, block: 1, shield: 1, swap: 3, undo: 2, double: 3 };
let abilityUsed = {
    X: { erase: false, block: false, shield: false, swap: false, undo: false, double: false },
    O: { erase: false, block: false, shield: false, swap: false, undo: false, double: false }
};
let hintUsedThisTurn = { X: false, O: false };
let blockedCellIndex = null;
let blockedCellOwner = null;
let shieldedCells = { X: null, O: null };
let activeAbility = null;
let activeAbilitySelection = null;
let expiringBlockedCellIndex = null;
let expiringBlockTimer = null;
let erasedCellIndex = null;
let erasedCellSymbol = null;
let erasedCellTimer = null;
let swapEffectIndexes = [];
let swapEffectTimer = null;
let undoEffectIndex = null;
let undoEffectTimer = null;
let doubleMoveIndexes = [];
let doubleMoveTimer = null;
let effectVersion = 0;
let previousRenderedTurn = '';
let lastStatusVersion = 0;
let confirmResolver = null;
let autoJoinAttempted = false;

cells.forEach((cell) => {
    const cellElement = document.createElement('div');
    cellElement.classList.add('cell');
    cellElement.dataset.index = cell;
    cellElement.style.setProperty('--cell-order', cell - 1);
    board.appendChild(cellElement);
    cellElement.addEventListener('click', () => handleCellClick(cell));
});

function updateBoard() {
    cells.forEach((cellNumber, index) => {
        const cellElement = document.querySelector(`[data-index="${cellNumber}"]`);
        const value = gameBoardState[index];
        const isWinningCell = winningCells.includes(index);
        const isBlockedCell = blockedCellIndex === index && !value;
        const isShieldedX = shieldedCells.X === index && gameBoardState[index] === 'X';
        const isShieldedO = shieldedCells.O === index && gameBoardState[index] === 'O';
        const isAbilityTarget = !gameEnded && activeAbility && (
            (activeAbility === 'erase' && value && value !== playerSymbol && !(shieldedCells[value] === index)) ||
            (activeAbility === 'block' && !value && !isBlockedCell) ||
            (activeAbility === 'shield' && value === playerSymbol) ||
            (activeAbility === 'swap' && !activeAbilitySelection && value === playerSymbol && shieldedCells[playerSymbol] !== index) ||
            (activeAbility === 'swap' && activeAbilitySelection !== null && value && value !== playerSymbol && !(shieldedCells[value] === index)) ||
            (activeAbility === 'double' && !value && !isBlockedCell && !(activeAbilitySelection?.includes(index)))
        );
        const isSelectedAbilityCell = activeAbility === 'swap' && activeAbilitySelection === index
            || activeAbility === 'double' && activeAbilitySelection?.includes(index);

        cellElement.textContent = value || '';
        cellElement.classList.remove(
            'cell-X', 'cell-O', 'win-cell', 'disabled', 'last-move', 'last-move-X', 'last-move-O',
            'move-flip', 'move-flip-X', 'move-flip-O', 'hint-cell', 'blocked-cell',
            'shielded-cell', 'shielded-cell-X', 'shielded-cell-O', 'ability-target',
            'blocked-expire', 'erase-burst', 'clutch-cell', 'clutch-cell-X', 'clutch-cell-O',
            'ability-selected', 'swap-cell', 'swap-cell-source', 'swap-cell-target', 'undo-cell', 'double-move-cell'
        );

        if (value) {
            cellElement.classList.add(`cell-${value}`);
        }

        if (!value && erasedCellIndex === index) {
            cellElement.classList.add('erase-burst');
            cellElement.dataset.erasedMark = erasedCellSymbol || '';
        } else {
            delete cellElement.dataset.erasedMark;
        }

        if (isWinningCell) {
            cellElement.classList.add('win-cell');
        }

        if (!isWinningCell && !gameEnded && lastMoveIndex === index && value) {
            cellElement.classList.add('last-move');
            cellElement.classList.add(`last-move-${lastMoveSymbol || value}`);
        }

        if (recentMoveIndex === index && value) {
            cellElement.classList.add('move-flip');
            cellElement.classList.add(`move-flip-${recentMoveSymbol || value}`);
        }

        if (isBlockedCell) {
            cellElement.classList.add('blocked-cell');
        }

        if (!value && expiringBlockedCellIndex === index) {
            cellElement.classList.add('blocked-expire');
        }

        if (isShieldedX || isShieldedO) {
            cellElement.classList.add('shielded-cell');
            cellElement.classList.add(isShieldedX ? 'shielded-cell-X' : 'shielded-cell-O');
        }

        if (!value && hintIndex === index && currentPlayer === playerSymbol && !gameEnded) {
            cellElement.classList.add('hint-cell');
        }

        if (clutchCells.includes(index)) {
            cellElement.classList.add('clutch-cell');
            if (clutchSymbol) {
                cellElement.classList.add(`clutch-cell-${clutchSymbol}`);
            }
        }

        if (isAbilityTarget) {
            cellElement.classList.add('ability-target');
        }

        if (isSelectedAbilityCell) {
            cellElement.classList.add('ability-selected');
        }

        if (swapEffectIndexes.includes(index)) {
            cellElement.classList.add('swap-cell');
            cellElement.classList.add(index === swapEffectIndexes[0] ? 'swap-cell-source' : 'swap-cell-target');
        }

        if (undoEffectIndex === index) {
            cellElement.classList.add('undo-cell');
        }

        if (doubleMoveIndexes.includes(index)) {
            cellElement.classList.add('double-move-cell');
        }

        if (
            !playerSymbol
            || currentPlayer !== playerSymbol
            || gameEnded
            || (activeAbility ? !isAbilityTarget : (value || isBlockedCell))
        ) {
            cellElement.classList.add('disabled');
        }
    });

    board.classList.toggle('your-turn', Boolean(playerSymbol) && !gameEnded && currentPlayer === playerSymbol);
    board.classList.toggle('turn-x', !gameEnded && currentPlayer === 'X');
    board.classList.toggle('turn-o', !gameEnded && currentPlayer === 'O');
    board.classList.toggle('ability-mode', Boolean(activeAbility));
    board.classList.toggle('danger-turn', Boolean(clutchSymbol) && currentPlayer !== clutchSymbol && !gameEnded);
    board.dataset.ability = activeAbility || '';
    hintButton.disabled = !playerSymbol
        || gameEnded
        || currentPlayer !== playerSymbol
        || hintsRemaining[playerSymbol] <= 0
        || hintUsedThisTurn[playerSymbol];
    hintButton.textContent = playerSymbol ? `💡 Help ${hintsRemaining[playerSymbol]}/3` : '💡 Help';
    updateAbilityButtons();
    updateWinningLine();
}

function updateScore() {
    if (scoreXValueElement && scoreOValueElement) {
        scoreXValueElement.textContent = xWins;
        scoreOValueElement.textContent = oWins;
    } else {
        scoreElement.textContent = `X Wins: ${xWins} | O Wins: ${oWins}`;
    }
}

function getAbilityInstruction(ability) {
    if (ability === 'erase') {
        return '🔄 Erase ready. Click an enemy mark to remove it and end your turn.';
    }

    if (ability === 'block') {
        return '⛔ Block ready. Click an empty cell to block it for the opponent\'s next turn.';
    }

    if (ability === 'shield') {
        return '🛡️ Shield ready. Click one of your marks to protect it from erase.';
    }

    if (ability === 'swap') {
        return activeAbilitySelection === null
            ? '🔁 Swap ready. Pick one of your marks first.'
            : '🔁 Now pick an enemy mark to swap with.';
    }

    if (ability === 'undo') {
        return '⏪ Undo ready. Rewind the opponent last placed move.';
    }

    if (ability === 'double') {
        return !Array.isArray(activeAbilitySelection) || activeAbilitySelection.length === 0
            ? '⚡ Double ready. Pick the first empty cell.'
            : '⚡ Pick the second empty cell for your double move.';
    }

    return '';
}

function clearActiveAbility() {
    activeAbility = null;
    activeAbilitySelection = null;
    updateBoard();
}

function findClutchThreat(boardState) {
    for (const symbol of ['X', 'O']) {
        for (const combination of clientWinningCombinations) {
            const values = combination.map((index) => boardState[index]);
            const ownCount = values.filter((value) => value === symbol).length;
            const emptyCells = combination.filter((index) => boardState[index] === null);

            if (ownCount === 4 && emptyCells.length === 1) {
                return {
                    symbol,
                    cells: combination
                };
            }
        }
    }

    return null;
}

function pulseAbilityCard(symbol) {
    const cardElement = symbol === 'X' ? moodXElement : moodOElement;

    if (!cardElement) {
        return;
    }

    cardElement.classList.remove('ability-pulse');
    void cardElement.offsetWidth;
    cardElement.classList.add('ability-pulse');
    window.setTimeout(() => cardElement.classList.remove('ability-pulse'), 620);
}

function animateInvalidCell(index) {
    const cellElement = document.querySelector(`[data-index="${index}"]`);

    if (!cellElement) {
        return;
    }

    cellElement.classList.remove('invalid-click');
    void cellElement.offsetWidth;
    cellElement.classList.add('invalid-click');
    window.setTimeout(() => cellElement.classList.remove('invalid-click'), 420);
}

function updateWinningLine() {
    if (!winLineElement || winningCells.length === 0 || !gameEnded || !lastWinner) {
        if (winLineElement) {
            winLineElement.classList.add('hidden');
        }
        return;
    }

    const firstCell = board.querySelector(`[data-index="${winningCells[0] + 1}"]`);
    const lastCell = board.querySelector(`[data-index="${winningCells[winningCells.length - 1] + 1}"]`);

    if (!firstCell || !lastCell) {
        winLineElement.classList.add('hidden');
        return;
    }

    const boardRect = board.getBoundingClientRect();
    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();
    const x1 = firstRect.left - boardRect.left + firstRect.width / 2;
    const y1 = firstRect.top - boardRect.top + firstRect.height / 2;
    const x2 = lastRect.left - boardRect.left + lastRect.width / 2;
    const y2 = lastRect.top - boardRect.top + lastRect.height / 2;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    winLineElement.style.setProperty('--win-line-left', `${x1}px`);
    winLineElement.style.setProperty('--win-line-top', `${y1}px`);
    winLineElement.style.setProperty('--win-line-length', `${length}px`);
    winLineElement.style.setProperty('--win-line-angle', `${angle}rad`);
    winLineElement.classList.remove('hidden');
    winLineElement.classList.toggle('winner-x', lastWinner === 'X');
    winLineElement.classList.toggle('winner-o', lastWinner === 'O');
}

function spawnCellParticles(index, palette) {
    const cellElement = document.querySelector(`[data-index="${index + 1}"]`);
    const boardRect = board.getBoundingClientRect();
    const cellRect = cellElement?.getBoundingClientRect();

    if (!cellRect) {
        return;
    }

    const originX = cellRect.left - boardRect.left + cellRect.width / 2;
    const originY = cellRect.top - boardRect.top + cellRect.height / 2;

    for (let i = 0; i < 18; i += 1) {
        effectParticles.push({
            x: boardRect.left + originX,
            y: boardRect.top + originY,
            vx: (Math.random() - 0.5) * 4.8,
            vy: (Math.random() - 0.5) * 4.8,
            life: 26 + Math.random() * 12,
            size: 2 + Math.random() * 3,
            color: palette[Math.floor(Math.random() * palette.length)]
        });
    }

    if (!fireworksAnimationRunning) {
        fireworksAnimationRunning = true;
        animateFireworks();
    }
}

function clearEffectTimers() {
    if (swapEffectTimer) {
        clearTimeout(swapEffectTimer);
        swapEffectTimer = null;
    }

    if (undoEffectTimer) {
        clearTimeout(undoEffectTimer);
        undoEffectTimer = null;
    }

    if (doubleMoveTimer) {
        clearTimeout(doubleMoveTimer);
        doubleMoveTimer = null;
    }
}

function applyBoardEffect(effect) {
    clearEffectTimers();
    swapEffectIndexes = [];
    undoEffectIndex = null;
    doubleMoveIndexes = [];
    board.classList.remove('double-strike');

    if (!effect) {
        return;
    }

    if (effect.type === 'swap') {
        swapEffectIndexes = [effect.sourceIndex, effect.targetIndex];
        playSwapSound();
        swapEffectTimer = setTimeout(() => {
            swapEffectIndexes = [];
            updateBoard();
        }, 720);
    }

    if (effect.type === 'undo') {
        undoEffectIndex = effect.index;
        playUndoSound();
        undoEffectTimer = setTimeout(() => {
            undoEffectIndex = null;
            updateBoard();
        }, 720);
    }

    if (effect.type === 'double') {
        doubleMoveIndexes = [...effect.indexes];
        board.classList.add('double-strike');
        playDoubleSound();
        doubleMoveTimer = setTimeout(() => {
            doubleMoveIndexes = [];
            board.classList.remove('double-strike');
            updateBoard();
        }, 820);
    }
}

function updateAbilityButtons() {
    abilityBars.forEach((barElement) => {
        const symbol = barElement.dataset.playerBar;
        const currentEnergy = energy[symbol] ?? 0;
        barElement.style.width = `${(currentEnergy / 4) * 100}%`;
        barElement.dataset.energy = `${currentEnergy}`;
    });

    abilityButtons.forEach((button) => {
        const owner = button.dataset.player;
        const ability = button.dataset.ability;
        const countElement = button.querySelector('.ability-count');
        const cost = abilityCosts[ability] ?? 0;
        const wasUsed = abilityUsed[owner]?.[ability] ?? false;
        const canUse = owner === playerSymbol
            && playersJoined === 2
            && currentPlayer === playerSymbol
            && !gameEnded
            && !wasUsed
            && (energy[owner] ?? 0) >= cost;

        if (countElement) {
            countElement.textContent = `${cost}`;
            countElement.style.setProperty('--ability-ring', !wasUsed && (energy[owner] ?? 0) >= cost ? '360deg' : '0deg');
        }

        button.disabled = !canUse;
        button.classList.toggle('is-selected', owner === playerSymbol && ability === activeAbility);
        button.classList.toggle('is-ready', !wasUsed && (energy[owner] ?? 0) >= cost);
        button.classList.toggle('is-used', wasUsed);
    });
}

function renderMoodFace(faceElement, mood, label) {
    if (!faceElement || !mood) {
        return;
    }

    const src = mood.codepoint ? `${animatedEmojiBaseUrl}/${mood.codepoint}/emoji.svg` : '';
    faceElement.classList.add('is-fallback');
    faceElement.setAttribute('aria-label', label);
    faceElement.dataset.faceKey = mood.codepoint || mood.fallback;
    faceElement.innerHTML = `
        ${src ? `<img class="mood-face-media" src="${src}" alt="" loading="eager" decoding="async">` : ''}
        <span class="mood-face-fallback" aria-hidden="true">${mood.fallback}</span>
    `;

    const mediaElement = faceElement.querySelector('.mood-face-media');
    if (mediaElement) {
        mediaElement.addEventListener('error', () => {
            faceElement.classList.add('is-fallback');
        }, { once: true });

        mediaElement.addEventListener('load', () => {
            faceElement.classList.remove('is-fallback');
        }, { once: true });
    } else {
        faceElement.classList.add('is-fallback');
    }
}

function setMood(cardElement, mood, label, stateClass) {
    if (!cardElement) {
        return;
    }

    const faceElement = cardElement.querySelector('.mood-face');
    const labelElement = cardElement.querySelector('.mood-label');

    cardElement.classList.remove('is-active', 'is-thinking', 'is-happy', 'is-sad', 'is-panic', 'is-calm', 'is-proud');
    if (stateClass) {
        cardElement.classList.add(stateClass);
    }

    if (faceElement) {
        const nextFaceKey = mood.codepoint || mood.fallback;
        if (faceElement.dataset.faceKey !== nextFaceKey || faceElement.getAttribute('aria-label') !== label) {
            renderMoodFace(faceElement, mood, label);
        }
    }

    if (labelElement) {
        labelElement.textContent = label;
    }
}

function updateMoodPanel(playersJoined) {
    if (!roomCode) {
        setMood(moodXElement, animatedMoodAssets.melting, 'Waiting for room', 'is-calm');
        setMood(moodOElement, animatedMoodAssets.moon, 'Waiting for room', 'is-calm');
        return;
    }

    if (isSoloGame) {
        if (gameEnded) {
            if (lastWinner === 'X') {
                setMood(moodXElement, animatedMoodAssets.partying, 'Beat the AI', 'is-happy');
                setMood(moodOElement, animatedMoodAssets.crying, 'AI got outplayed', 'is-sad');
            } else if (lastWinner === 'O') {
                setMood(moodXElement, animatedMoodAssets.crying, 'You lost this round', 'is-sad');
                setMood(moodOElement, animatedMoodAssets.partying, 'AI won this round', 'is-happy');
            } else {
                setMood(moodXElement, animatedMoodAssets.woozy, 'Even match', 'is-panic');
                setMood(moodOElement, animatedMoodAssets.mindBlown, 'Even match', 'is-panic');
            }
            return;
        }

        if (currentPlayer === 'X') {
            setMood(
                moodXElement,
                hintUsedThisTurn.X ? animatedMoodAssets.nerd : animatedMoodAssets.thinking,
                hintUsedThisTurn.X ? 'Studying the best punish' : 'Your move against the AI',
                'is-active'
            );
            setMood(moodOElement, animatedMoodAssets.eyes, 'AI is watching closely', 'is-thinking');
        } else {
            setMood(moodXElement, animatedMoodAssets.anxious, 'Waiting for the AI move', 'is-panic');
            setMood(moodOElement, animatedMoodAssets.monocle, aiThinking ? 'AI is calculating' : 'AI is ready', 'is-active');
        }
        return;
    }

    if (playersJoined < 2) {
        setMood(moodXElement, animatedMoodAssets.smirkCat, 'Room owner ready', 'is-proud');
        setMood(moodOElement, animatedMoodAssets.eyes, 'Waiting to join', 'is-thinking');
        return;
    }

    if (gameEnded) {
        if (lastWinner === 'X') {
            setMood(moodXElement, animatedMoodAssets.partying, 'Won the round', 'is-happy');
            setMood(moodOElement, animatedMoodAssets.crying, 'Lost this round', 'is-sad');
        } else if (lastWinner === 'O') {
            setMood(moodXElement, animatedMoodAssets.crying, 'Lost this round', 'is-sad');
            setMood(moodOElement, animatedMoodAssets.partying, 'Won the round', 'is-happy');
        } else {
            setMood(moodXElement, animatedMoodAssets.woozy, 'Tie game', 'is-panic');
            setMood(moodOElement, animatedMoodAssets.mindBlown, 'Tie game', 'is-panic');
        }
        return;
    }

    if (currentPlayer === 'X') {
        setMood(
            moodXElement,
            hintUsedThisTurn.X ? animatedMoodAssets.nerd : animatedMoodAssets.thinking,
            hintUsedThisTurn.X ? 'Plotting the next strike' : 'Thinking of the best move',
            'is-active'
        );
        setMood(moodOElement, animatedMoodAssets.cold, 'Waiting and watching', 'is-thinking');
    } else {
        setMood(moodXElement, animatedMoodAssets.eyes, 'Watching O think', 'is-thinking');
        setMood(
            moodOElement,
            hintUsedThisTurn.O ? animatedMoodAssets.monocle : animatedMoodAssets.halo,
            hintUsedThisTurn.O ? 'Lining up the perfect answer' : 'Feeling lucky and focused',
            'is-active'
        );
    }
}

function renderPlayerStatus(stateLabel, accentSymbol = playerSymbol, isActive = false) {
    const roomMarkup = `<span class="status-chip room-chip">Room ${roomCode}</span>`;
    const playerMarkup = `<span class="status-chip player-chip player-${accentSymbol}">You are ${accentSymbol}</span>`;
    let stateClass = 'turn-waiting';

    if (stateLabel === 'Game finished') {
        stateClass = 'turn-finished';
    } else if (isActive) {
        stateClass = 'turn-active';
    } else if (stateLabel.includes('Waiting for X')) {
        stateClass = 'turn-waiting waiting-X';
    } else if (stateLabel.includes('Waiting for O')) {
        stateClass = 'turn-waiting waiting-O';
    }

    const stateMarkup = `<span class="status-chip ${stateClass}">${stateLabel}</span>`;
    const nextMarkup = `${roomMarkup} ${playerMarkup} ${stateMarkup}`;

    if (playerStatusElement.innerHTML !== nextMarkup) {
        playerStatusElement.innerHTML = nextMarkup;
    }
}

function showToast(message, emoji = '⏳', type = 'general') {
    if (!toastElement) {
        return;
    }

    const toastId = `toast-${Date.now()}-${toastIdCounter += 1}`;
    const toastNode = document.createElement('div');
    toastNode.className = `toast-item toast-${type}`;
    toastNode.dataset.toastId = toastId;
    toastNode.innerHTML = `<span class="toast-emoji">${emoji}</span><span class="toast-text">${message}</span>`;
    toastElement.appendChild(toastNode);

    const entry = {
        id: toastId,
        node: toastNode,
        type,
        timer: window.setTimeout(() => removeToastById(toastId), 5000)
    };

    toastEntries.push(entry);
    toastVisible = toastEntries.length > 0;
    toastType = toastEntries[toastEntries.length - 1]?.type || '';

    window.requestAnimationFrame(() => {
        toastNode.classList.add('show');
    });

    if (toastEntries.length > 5) {
        removeToastById(toastEntries[0].id);
    }
}

function removeToastById(toastId) {
    if (!toastElement) {
        return;
    }

    const entryIndex = toastEntries.findIndex((entry) => entry.id === toastId);
    if (entryIndex === -1) {
        return;
    }

    const [entry] = toastEntries.splice(entryIndex, 1);

    if (entry?.timer) {
        clearTimeout(entry.timer);
    }

    if (entry?.node) {
        entry.node.classList.remove('show');
        entry.node.classList.add('leaving');
        window.setTimeout(() => {
            entry.node?.remove();
        }, 360);
    }

    toastVisible = toastEntries.length > 0;
    toastType = toastEntries[toastEntries.length - 1]?.type || '';
}

function hideToast(type = null) {
    if (!toastElement || toastEntries.length === 0) {
        return;
    }

    if (!type) {
        [...toastEntries].forEach((entry) => removeToastById(entry.id));
        return;
    }

    const matchingEntries = toastEntries.filter((entry) => entry.type === type);
    matchingEntries.forEach((entry) => removeToastById(entry.id));
}

function showConfirm(message) {
    if (!confirmModal || !confirmMessageElement) {
        return Promise.resolve(window.confirm(message));
    }

    confirmMessageElement.textContent = message;
    confirmModal.classList.remove('hidden');

    return new Promise((resolve) => {
        confirmResolver = resolve;
    });
}

function closeConfirm(result) {
    if (!confirmModal || !confirmResolver) {
        return;
    }

    confirmModal.classList.add('hidden');
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(result);
}

function showHint(message) {
    if (hintTimer) {
        clearTimeout(hintTimer);
    }

    resultElement.textContent = message;
    resultElement.classList.add('result-hint');

    hintTimer = setTimeout(() => {
        resultElement.classList.remove('result-hint');

        if (!gameEnded && roomCode) {
            resultElement.textContent = gameBoardState.some(Boolean)
                ? `Waiting for ${currentPlayer} to make a move.`
                : `Room ${roomCode} is ready.`;
        }
    }, 1400);
}

function updateStatus() {
    connectionStatusElement.innerHTML = '<span class="live-dot"></span>Connected to server.';

    if (!roomCode || !playerSymbol) {
        playerStatusElement.textContent = 'Create a room or join an existing code.';
        return;
    }

    if (gameEnded) {
        if (xWins || oWins) {
            renderPlayerStatus('Game finished', playerSymbol, false);
        }
        return;
    }

    if (currentPlayer === playerSymbol) {
        hideToast('turn-wait');
        renderPlayerStatus('Your turn', playerSymbol, true);
    } else {
        renderPlayerStatus(isSoloGame ? 'AI is thinking' : `Waiting for ${currentPlayer}`, playerSymbol, false);
    }

    const turnKey = gameEnded ? 'end' : currentPlayer;
    if (turnKey !== previousRenderedTurn) {
        playerStatusElement.classList.remove('turn-swap');
        void playerStatusElement.offsetWidth;
        playerStatusElement.classList.add('turn-swap');
        previousRenderedTurn = turnKey;
    }
}

function updateMusicControls() {
    if (!musicToggleButton || !musicVolumeInput) {
        return;
    }

    const { volume, muted } = getMusicSettings();
    const volumePercent = Math.round(volume * 100);

    musicVolumeInput.value = String(volumePercent);
    musicToggleButton.textContent = muted || volumePercent === 0 ? '🔇 Muted' : `🔊 Music ${volumePercent}%`;
    musicToggleButton.classList.toggle('is-muted', muted || volumePercent === 0);
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed.');
    }

    return data;
}

function getRoomShareUrl(code = roomCode) {
    const nextCode = String(code || '').trim().toUpperCase();
    const shareUrl = new URL(window.location.href);

    if (nextCode) {
        shareUrl.searchParams.set('room', nextCode);
    } else {
        shareUrl.searchParams.delete('room');
    }

    return shareUrl.toString();
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }

    const helperInput = document.createElement('textarea');
    helperInput.value = text;
    helperInput.setAttribute('readonly', '');
    helperInput.style.position = 'fixed';
    helperInput.style.opacity = '0';
    helperInput.style.pointerEvents = 'none';
    document.body.appendChild(helperInput);
    helperInput.focus();
    helperInput.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } finally {
        helperInput.remove();
    }

    if (!copied) {
        throw new Error('Copy failed');
    }

    return true;
}

function applyRoomState(state) {
    const previousWinner = lastWinner;
    const previousBoard = gameBoardState.slice();
    const previousBlockedCellIndex = blockedCellIndex;

    playersJoined = state.playersJoined || 0;
    isSoloGame = Boolean(state.isSolo);
    aiThinking = Boolean(state.aiThinking);
    gameBoardState = state.board;
    currentPlayer = state.currentPlayer;
    gameEnded = state.gameEnded;
    xWins = state.scores.X;
    oWins = state.scores.O;
    winningCells = state.winningCombination || [];
    lastWinner = state.winner || null;
    lastMoveIndex = Number.isInteger(state.lastMoveIndex) ? state.lastMoveIndex : null;
    lastMoveSymbol = lastMoveIndex !== null ? gameBoardState[lastMoveIndex] : null;
    hintsRemaining = state.hintsRemaining || hintsRemaining;
    energy = state.energy || energy;
    abilityCosts = state.abilityCosts || abilityCosts;
    abilityUsed = state.abilityUsed || abilityUsed;
    hintUsedThisTurn = state.hintUsedThisTurn || hintUsedThisTurn;
    blockedCellIndex = Number.isInteger(state.blockedCell?.index) ? state.blockedCell.index : null;
    blockedCellOwner = state.blockedCell?.owner || null;
    shieldedCells = state.shieldedCells || shieldedCells;
    const clutchThreat = !state.gameEnded ? findClutchThreat(state.board) : null;
    clutchCells = clutchThreat?.cells || [];
    clutchSymbol = clutchThreat?.symbol || null;
    recentMoveIndex = gameBoardState.findIndex((value, index) => value && previousBoard[index] !== value);
    recentMoveSymbol = recentMoveIndex !== -1 ? gameBoardState[recentMoveIndex] : null;
    if (state.effect && ['swap', 'undo', 'double'].includes(state.effect.type)) {
        recentMoveIndex = -1;
        recentMoveSymbol = null;
    }
    const removedCellIndex = previousBoard.findIndex((value, index) => value && !gameBoardState[index]);

    if (recentMoveTimer) {
        clearTimeout(recentMoveTimer);
        recentMoveTimer = null;
    }

    if (recentMoveIndex !== -1) {
        recentMoveTimer = setTimeout(() => {
            recentMoveIndex = null;
            recentMoveSymbol = null;
            updateBoard();
        }, 700);
    } else {
        recentMoveIndex = null;
        recentMoveSymbol = null;
    }

    if (erasedCellTimer) {
        clearTimeout(erasedCellTimer);
        erasedCellTimer = null;
    }

    if (removedCellIndex !== -1) {
        erasedCellIndex = removedCellIndex;
        erasedCellSymbol = previousBoard[removedCellIndex];
        spawnCellParticles(removedCellIndex, ['#ff8c42', '#ffd166', '#ffe4a3', '#ffffff']);
        playEraseSound();
        erasedCellTimer = setTimeout(() => {
            erasedCellIndex = null;
            erasedCellSymbol = null;
            updateBoard();
        }, 620);
    } else {
        erasedCellIndex = null;
        erasedCellSymbol = null;
    }

    if (expiringBlockTimer) {
        clearTimeout(expiringBlockTimer);
        expiringBlockTimer = null;
    }

    if (previousBlockedCellIndex !== null && blockedCellIndex === null) {
        expiringBlockedCellIndex = previousBlockedCellIndex;
        expiringBlockTimer = setTimeout(() => {
            expiringBlockedCellIndex = null;
            updateBoard();
        }, 620);
    } else if (blockedCellIndex !== null) {
        expiringBlockedCellIndex = null;
    }

    if (currentPlayer !== playerSymbol || gameEnded) {
        hintIndex = null;
        activeAbility = null;
        activeAbilitySelection = null;
    }

    if (state.effectVersion && state.effectVersion !== effectVersion) {
        effectVersion = state.effectVersion;
        applyBoardEffect(state.effect);
    }

    const nextMusicMode = !roomCode
        ? 'idle'
        : gameEnded
            ? 'victory'
            : clutchSymbol && currentPlayer !== clutchSymbol
                ? 'tense'
                : 'calm';

    setMusicMode(nextMusicMode);

    updateBoard();
    updateScore();
    updateStatus();
    updateMoodPanel(playersJoined);

    if (state.statusVersion && state.statusVersion !== lastStatusVersion) {
        lastStatusVersion = state.statusVersion;

        if (state.statusMessage) {
            const messageEmoji = state.statusMessage.split(' ')[0];
            const emoji = /\p{Extended_Pictographic}/u.test(messageEmoji) ? messageEmoji : '📣';
            showToast(state.statusMessage, emoji, 'status');
        }
    }

    if (playersJoined < 2) {
        resultElement.textContent = `🚀 Room ${roomCode} created. Share this code with player 2.`;
    } else if (!gameEnded) {
        resultElement.textContent = clutchSymbol && currentPlayer !== clutchSymbol
            ? `🚨 Danger! ${clutchSymbol} is one move from winning.`
            : isSoloGame
                ? (currentPlayer === playerSymbol ? '🤖 Solo mode: your move.' : '🤖 Solo mode: AI is thinking...')
                : `🤝 Both players joined room ${roomCode}.`;
    }

    if (gameEnded) {
        restartButton.style.display = 'block';

        if (state.winner) {
            resultElement.textContent = `${state.winner === 'X' ? '💙' : '💚'} ${state.winner} wins!`;
            if (previousWinner !== state.winner) {
                playWinSound(state.winner);
                board.classList.remove('win-celebrate');
                document.body.classList.remove('winner-flash');
                void board.offsetWidth;
                board.classList.add('win-celebrate');
                document.body.classList.add('winner-flash');
                window.setTimeout(() => document.body.classList.remove('winner-flash'), 700);
                triggerFireworks(state.winner);
            }
        } else {
            resultElement.textContent = '🤝 It\'s a tie!';
            clearFireworks();
        }
    } else {
        restartButton.style.display = 'none';
        board.classList.remove('win-celebrate');
        document.body.classList.remove('winner-flash');
        clearFireworks();
    }

    if (recentMoveIndex !== null && recentMoveSymbol) {
        playMoveSound(recentMoveSymbol);
    }
}

async function fetchRoomState() {
    if (!roomCode || !playerId) {
        return;
    }

    try {
        const state = await requestJson(`${apiBaseUrl}/api/rooms/${roomCode}?playerId=${encodeURIComponent(playerId)}`);
        applyRoomState(state);
    } catch (error) {
        resultElement.textContent = error.message;
    }
}

function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }

    fetchRoomState();
    pollTimer = setInterval(fetchRoomState, 1000);
}

async function createRoom() {
    if (roomCode && gameBoardState.some(Boolean)) {
        const shouldCreateNewRoom = await showConfirm('Are you sure you want to create another room? Your current match will be replaced.');

        if (!shouldCreateNewRoom) {
            return;
        }
    }

    try {
        const data = await requestJson(`${apiBaseUrl}/api/rooms`, {
            method: 'POST'
        });

        roomCode = data.roomCode;
        playerId = data.playerId;
        playerSymbol = data.symbol;
        playersJoined = 1;
        isSoloGame = false;
        aiThinking = false;
        gameBoardState = Array(36).fill(null);
        currentPlayer = 'X';
        gameEnded = false;
        winningCells = [];
        lastWinner = null;
        lastMoveIndex = null;
        lastMoveSymbol = null;
        recentMoveIndex = null;
        recentMoveSymbol = null;
        hintIndex = null;
        hintsRemaining = { X: 3, O: 3 };
        energy = { X: 1, O: 0 };
        abilityCosts = { erase: 2, block: 1, shield: 1, swap: 3, undo: 2, double: 3 };
        abilityUsed = {
            X: { erase: false, block: false, shield: false, swap: false, undo: false, double: false },
            O: { erase: false, block: false, shield: false, swap: false, undo: false, double: false }
        };
        hintUsedThisTurn = { X: false, O: false };
        blockedCellIndex = null;
        blockedCellOwner = null;
        shieldedCells = { X: null, O: null };
        activeAbility = null;
        activeAbilitySelection = null;
        effectVersion = 0;
        clearEffectTimers();
        swapEffectIndexes = [];
        undoEffectIndex = null;
        doubleMoveIndexes = [];
        setMusicMode('calm');
        hideToast();
        roomCodeInput.value = roomCode;
        resultElement.textContent = `🎯 Room ${roomCode} created. You are X and go first.`;
        startPolling();
        updateStatus();
    } catch (error) {
        resultElement.textContent = error.message;
        connectionStatusElement.textContent = 'Server connection failed.';
    }
}

async function createSoloRoom() {
    if (roomCode && gameBoardState.some(Boolean)) {
        const shouldCreateNewRoom = await showConfirm('Are you sure you want to start a solo room? Your current match will be replaced.');

        if (!shouldCreateNewRoom) {
            return;
        }
    }

    try {
        const data = await requestJson(`${apiBaseUrl}/api/rooms/solo`, {
            method: 'POST'
        });

        roomCode = data.roomCode;
        playerId = data.playerId;
        playerSymbol = data.symbol;
        playersJoined = 2;
        isSoloGame = true;
        aiThinking = false;
        gameBoardState = Array(36).fill(null);
        currentPlayer = 'X';
        gameEnded = false;
        winningCells = [];
        lastWinner = null;
        lastMoveIndex = null;
        lastMoveSymbol = null;
        recentMoveIndex = null;
        recentMoveSymbol = null;
        hintIndex = null;
        hintsRemaining = { X: 3, O: 3 };
        energy = { X: 1, O: 0 };
        abilityCosts = { erase: 2, block: 1, shield: 1, swap: 3, undo: 2, double: 3 };
        abilityUsed = {
            X: { erase: false, block: false, shield: false, swap: false, undo: false, double: false },
            O: { erase: false, block: false, shield: false, swap: false, undo: false, double: false }
        };
        hintUsedThisTurn = { X: false, O: false };
        blockedCellIndex = null;
        blockedCellOwner = null;
        shieldedCells = { X: null, O: null };
        activeAbility = null;
        activeAbilitySelection = null;
        effectVersion = 0;
        clearEffectTimers();
        swapEffectIndexes = [];
        undoEffectIndex = null;
        doubleMoveIndexes = [];
        setMusicMode('calm');
        hideToast();
        roomCodeInput.value = roomCode;
        resultElement.textContent = `🤖 Solo room ${roomCode} created. You are X versus AI.`;
        startPolling();
        updateStatus();
    } catch (error) {
        resultElement.textContent = error.message;
    }
}

async function joinRoom() {
    const nextRoomCode = roomCodeInput.value.trim().toUpperCase();

    if (!nextRoomCode) {
        resultElement.textContent = 'Enter a room code first.';
        return false;
    }

    try {
        const data = await requestJson(`${apiBaseUrl}/api/rooms/join`, {
            method: 'POST',
            body: JSON.stringify({ roomCode: nextRoomCode })
        });

        roomCode = data.roomCode;
        playerId = data.playerId;
        playerSymbol = data.symbol;
        playersJoined = 2;
        isSoloGame = false;
        aiThinking = false;
        activeAbility = null;
        activeAbilitySelection = null;
        setMusicMode('calm');
        roomCodeInput.value = roomCode;
        resultElement.textContent = `✨ Joined room ${roomCode} as ${playerSymbol}.`;
        startPolling();
        updateStatus();
        return true;
    } catch (error) {
        resultElement.textContent = error.message;
        return false;
    }
}

async function copyRoomCode() {
    const code = roomCodeInput.value.trim().toUpperCase() || roomCode;

    if (!code) {
        showToast('📋 No room code yet. Create or join a room first.', '📋', 'general');
        return;
    }

    try {
        await copyTextToClipboard(code);
        showToast(`📋 Room code ${code} copied.`, '📋', 'general');
    } catch (error) {
        roomCodeInput.focus();
        roomCodeInput.select();
        showToast('📋 Press Ctrl+C to copy the room code.', '📋', 'general');
    }
}

async function shareRoomLink() {
    const code = roomCodeInput.value.trim().toUpperCase() || roomCode;

    if (!code || isSoloGame) {
        showToast(isSoloGame ? '🤖 Share links are for multiplayer rooms only.' : '🔗 Create a multiplayer room first.', '🔗', 'general');
        return;
    }

    const shareUrl = getRoomShareUrl(code);

    try {
        if (navigator.share) {
            await navigator.share({
                title: 'Tic-Tac-Toe OXO',
                text: `Join my room ${code} and let’s play.`,
                url: shareUrl
            });
            showToast('🔗 Game link shared.', '🔗', 'general');
            return;
        }

        await copyTextToClipboard(shareUrl);
        showToast('🔗 Share link copied. Send it to your friend.', '🔗', 'general');
    } catch (error) {
        if (error?.name === 'AbortError') {
            return;
        }

        try {
            await copyTextToClipboard(shareUrl);
            showToast('🔗 Share link copied. Send it to your friend.', '🔗', 'general');
        } catch (copyError) {
            showToast('🔗 Could not share automatically. Copy the room code manually.', '🔗', 'general');
        }
    }
}

async function handleCellClick(index) {
    if (!roomCode || !playerId || !playerSymbol || gameEnded) {
        return;
    }

    hideToast('status');
    hideToast('help');

    if (activeAbility) {
        await useAbility(index - 1);
        return;
    }

    if (currentPlayer !== playerSymbol) {
        playInvalidSound();
        animateInvalidCell(index);
        showHint(isSoloGame ? 'Please wait. The AI is thinking...' : `Please wait. ${currentPlayer} is thinking...`);
        showToast(
            isSoloGame ? '🤖 Hold on, the AI is still planning its move.' : `Hold on, it is ${currentPlayer}'s turn right now.`,
            isSoloGame ? '🤖' : currentPlayer === 'X' ? '❄️' : '🍀',
            'turn-wait'
        );
        return;
    }

    if (gameBoardState[index - 1]) {
        playInvalidSound();
        animateInvalidCell(index);
        showHint('That square is already taken.');
        showToast('That square is already taken. Try another one.', '🚫', 'general');
        return;
    }

    if (blockedCellIndex === index - 1) {
        playInvalidSound();
        animateInvalidCell(index);
        showHint('That cell is blocked for this turn.');
        showToast('⛔ That cell is blocked for this turn. Pick another one.', '⛔', 'general');
        return;
    }

    try {
        const state = await requestJson(`${apiBaseUrl}/api/rooms/${roomCode}/move`, {
            method: 'POST',
            body: JSON.stringify({
                playerId,
                index: index - 1
            })
        });

        hintIndex = null;
        applyRoomState(state);
    } catch (error) {
        resultElement.textContent = error.message;
    }
}

async function useAbility(index) {
    if (!activeAbility || !roomCode || !playerId || !playerSymbol || gameEnded) {
        return;
    }

    if (activeAbility === 'swap') {
        const targetValue = gameBoardState[index];

        if (activeAbilitySelection === null) {
            if (targetValue !== playerSymbol) {
                playInvalidSound();
                animateInvalidCell(index + 1);
                showToast('🔁 Pick one of your own marks first.', '🔁', 'general');
                return;
            }

            if (shieldedCells[playerSymbol] === index) {
                playInvalidSound();
                animateInvalidCell(index + 1);
                showToast('🛡️ Shielded marks cannot be swapped.', '🛡️', 'general');
                return;
            }

            activeAbilitySelection = index;
            updateBoard();
            showToast('🔁 Good. Now pick an enemy mark to swap with.', '🔁', 'ability');
            resultElement.textContent = getAbilityInstruction('swap');
            return;
        }

        if (!targetValue || targetValue === playerSymbol) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('🔁 Pick an enemy mark for the second half of the swap.', '🔁', 'general');
            return;
        }

        if (shieldedCells[targetValue] === index) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('🛡️ Shielded marks cannot be swapped.', '🛡️', 'general');
            return;
        }
    }

    if (activeAbility === 'erase') {
        const targetValue = gameBoardState[index];

        if (!targetValue || targetValue === playerSymbol) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('🔄 Pick an enemy mark to erase.', '🔄', 'general');
            return;
        }

        if (shieldedCells[targetValue] === index) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('🛡️ That mark is shielded right now.', '🛡️', 'general');
            return;
        }
    }

    if (activeAbility === 'block') {
        if (gameBoardState[index]) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('⛔ Block needs an empty cell.', '⛔', 'general');
            return;
        }

        if (blockedCellIndex === index) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('⛔ That cell is already blocked.', '⛔', 'general');
            return;
        }
    }

    if (activeAbility === 'shield' && gameBoardState[index] !== playerSymbol) {
        playInvalidSound();
        animateInvalidCell(index + 1);
        showToast('🛡️ Pick one of your own marks to shield.', '🛡️', 'general');
        return;
    }

    if (activeAbility === 'double') {
        if (gameBoardState[index] || blockedCellIndex === index) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('⚡ Double move needs empty free cells only.', '⚡', 'general');
            return;
        }

        if (!Array.isArray(activeAbilitySelection)) {
            activeAbilitySelection = [index];
            updateBoard();
            showToast('⚡ Nice. Pick the second cell for your combo.', '⚡', 'ability');
            resultElement.textContent = getAbilityInstruction('double');
            return;
        }

        if (activeAbilitySelection.includes(index)) {
            playInvalidSound();
            animateInvalidCell(index + 1);
            showToast('⚡ Pick a different second cell.', '⚡', 'general');
            return;
        }
    }

    try {
        const abilityPayload = {
            playerId,
            ability: activeAbility
        };

        if (activeAbility === 'swap') {
            abilityPayload.sourceIndex = activeAbilitySelection;
            abilityPayload.index = index;
        } else if (activeAbility === 'double') {
            abilityPayload.indexes = [...activeAbilitySelection, index];
        } else {
            abilityPayload.index = index;
        }

        const state = await requestJson(`${apiBaseUrl}/api/rooms/${roomCode}/ability`, {
            method: 'POST',
            body: JSON.stringify(abilityPayload)
        });

        const usedAbility = activeAbility;
        activeAbility = null;
        activeAbilitySelection = null;
        hintIndex = null;
        pulseAbilityCard(playerSymbol);
        applyRoomState(state);
        showToast(
            usedAbility === 'erase'
                ? '🔄 Mark erased. Your turn is spent.'
                : usedAbility === 'block'
                    ? '⛔ Cell blocked for the enemy turn.'
                    : usedAbility === 'shield'
                        ? '🛡️ Shield up. That mark is protected.'
                        : usedAbility === 'swap'
                            ? '🔁 Swap completed. Big brain move.'
                            : usedAbility === 'undo'
                                ? '⏪ Last move cancelled.'
                                : '⚡ Double move landed.',
            usedAbility === 'erase' ? '🔄' : usedAbility === 'block' ? '⛔' : usedAbility === 'shield' ? '🛡️' : usedAbility === 'swap' ? '🔁' : usedAbility === 'undo' ? '⏪' : '⚡',
            'ability'
        );
    } catch (error) {
        showToast(error.message, '⚔️', 'general');
    } finally {
        updateBoard();
    }
}

function handleAbilityButtonClick(event) {
    const owner = event.currentTarget.dataset.player;
    const ability = event.currentTarget.dataset.ability;

    if (owner !== playerSymbol) {
        showToast(`Only player ${playerSymbol || owner} can use this power on this screen.`, '🎮', 'general');
        return;
    }

    if (!playerSymbol || currentPlayer !== playerSymbol || gameEnded) {
        showToast('Wait for your turn before using an ability.', '⏳', 'general');
        return;
    }

    if (playersJoined < 2) {
        showToast('🤝 Wait for player 2 before using abilities.', '🤝', 'general');
        return;
    }

    const cost = abilityCosts[ability] ?? 0;

    if (abilityUsed[playerSymbol]?.[ability]) {
        showToast(`🪫 ${ability} was already used this round.`, '🪫', 'general');
        return;
    }

    if ((energy[playerSymbol] ?? 0) < cost) {
        showToast(`⚡ ${ability} needs ${cost} energy.`, '⚡', 'general');
        return;
    }

    if (ability === 'undo') {
        activeAbility = 'undo';
        activeAbilitySelection = null;
        useAbility(-1);
        return;
    }

    activeAbility = activeAbility === ability ? null : ability;
    activeAbilitySelection = null;
    hintIndex = null;
    updateBoard();

    if (activeAbility) {
        const message = getAbilityInstruction(activeAbility);
        resultElement.textContent = message;
        showToast(
            message,
            activeAbility === 'erase' ? '🔄'
                : activeAbility === 'block' ? '⛔'
                    : activeAbility === 'shield' ? '🛡️'
                        : activeAbility === 'swap' ? '🔁'
                            : activeAbility === 'undo' ? '⏪'
                                : '⚡',
            'ability'
        );
    }
}

async function askForHint() {
    if (!roomCode || !playerId || !playerSymbol || gameEnded) {
        return;
    }

    if (currentPlayer !== playerSymbol) {
        showToast('You can only use help on your own turn.', '💡', 'general');
        return;
    }

    if (playersJoined < 2) {
        showToast('🤝 Wait for player 2 before using help.', '🤝', 'general');
        return;
    }

    if (hintUsedThisTurn[playerSymbol]) {
        showToast('💤 You already used help this turn. Wait for your next turn.', '💤', 'general');
        return;
    }

    if (hintsRemaining[playerSymbol] <= 0) {
        showToast('💡 No hints left this round. Wait for the next match to refill.', '⏭️', 'general');
        return;
    }

    try {
        const data = await requestJson(`${apiBaseUrl}/api/rooms/${roomCode}/hint`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
        });

        hintIndex = data.hintIndex;
        hintsRemaining[playerSymbol] = data.hintsRemaining;
        hintUsedThisTurn[playerSymbol] = true;
        updateBoard();
        showToast(`💡 Best move marked for ${playerSymbol}. ${data.hintsRemaining} hints left.`, '💡', 'help');
        resultElement.textContent = `💡 Suggested move highlighted for ${playerSymbol}.`;
    } catch (error) {
        if (error.message.includes('No hints left')) {
            showToast('💡 No hints left this round. Wait for the next match to refill.', '⏭️', 'general');
        } else if (error.message.includes('already used help')) {
            showToast('💤 You already used help this turn. Wait for your next turn.', '💤', 'general');
        } else {
            showToast(error.message, '💡', 'general');
        }
    }
}

async function restartGame() {
    if (!roomCode || !playerId) {
        return;
    }

    try {
        const state = await requestJson(`${apiBaseUrl}/api/rooms/${roomCode}/restart`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
        });

        winningCells = [];
        lastWinner = null;
        lastMoveIndex = null;
        lastMoveSymbol = null;
        recentMoveIndex = null;
        recentMoveSymbol = null;
        hintIndex = null;
        hintsRemaining = { X: 3, O: 3 };
        energy = { X: 1, O: 0 };
        abilityCosts = { erase: 2, block: 1, shield: 1, swap: 3, undo: 2, double: 3 };
        abilityUsed = {
            X: { erase: false, block: false, shield: false, swap: false, undo: false, double: false },
            O: { erase: false, block: false, shield: false, swap: false, undo: false, double: false }
        };
        hintUsedThisTurn = { X: false, O: false };
        blockedCellIndex = null;
        blockedCellOwner = null;
        shieldedCells = { X: null, O: null };
        activeAbility = null;
        activeAbilitySelection = null;
        effectVersion = 0;
        clearEffectTimers();
        swapEffectIndexes = [];
        undoEffectIndex = null;
        doubleMoveIndexes = [];
        lastStatusVersion = 0;
        setMusicMode('calm');
        hideToast();
        clearFireworks();
        applyRoomState(state);
    } catch (error) {
        resultElement.textContent = error.message;
    }
}

createRoomButton.addEventListener('click', createRoom);
soloRoomButton.addEventListener('click', createSoloRoom);
joinRoomButton.addEventListener('click', joinRoom);
copyRoomButton.addEventListener('click', copyRoomCode);
shareRoomButton.addEventListener('click', shareRoomLink);
hintButton.addEventListener('click', askForHint);
musicToggleButton.addEventListener('click', () => {
    toggleMusicMute();
    updateMusicControls();
});
musicVolumeInput.addEventListener('input', (event) => {
    const volume = Number(event.currentTarget.value) / 100;
    setMusicVolume(volume);
    if (volume > 0) {
        setMusicMuted(false);
    }
    updateMusicControls();
});
abilityButtons.forEach((button) => button.addEventListener('click', handleAbilityButtonClick));
confirmCancelButton.addEventListener('click', () => closeConfirm(false));
confirmOkButton.addEventListener('click', () => closeConfirm(true));
confirmModal.addEventListener('click', (event) => {
    if (event.target === confirmModal) {
        closeConfirm(false);
    }
});
roomCodeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        joinRoom();
    }
});
restartButton.addEventListener('click', restartGame);

updateBoard();
updateScore();
updateStatus();
updateMusicControls();

window.addEventListener('load', async () => {
    const sharedRoomCode = new URLSearchParams(window.location.search).get('room');

    if (!sharedRoomCode || autoJoinAttempted || roomCode || playerId) {
        return;
    }

    autoJoinAttempted = true;
    roomCodeInput.value = sharedRoomCode.trim().toUpperCase();

    try {
        const joined = await joinRoom();

        if (joined) {
            showToast(`🔗 Joined room ${roomCodeInput.value.trim().toUpperCase()} from shared link.`, '🔗', 'status');
        } else {
            showToast('🔗 Shared room could not be joined. It may be full or expired.', '🔗', 'general');
        }
    } catch (error) {
        showToast('🔗 Shared room could not be joined. It may be full or expired.', '🔗', 'general');
    }
});

window.restartGame = restartGame;

function clearWinningState() {
    winningCells = [];
    updateBoard();
}

function triggerFireworks(winnerSymbol) {
    clearFireworks();

    for (let i = 0; i < 200; i++) {
        fireworks.push(new Firework(winnerSymbol));
    }

    if (!fireworksAnimationRunning) {
        fireworksAnimationRunning = true;
        animateFireworks();
    }

    fireworksTimer = setTimeout(clearFireworks, 5000);
}

function Firework(winnerSymbol) {
    this.x = Math.random() * fireworksCanvas.width;
    this.y = fireworksCanvas.height;
    this.radius = 5;
    const palette = winnerSymbol === 'X'
        ? ['#1c5cff', '#58a6ff', '#9ecbff', '#d7e8ff']
        : winnerSymbol === 'O'
            ? ['#1f9b57', '#42d67c', '#8df0b4', '#d8ffe7']
            : ['#ff8c42', '#ffd166', '#58a6ff', '#42d67c'];
    this.color = palette[Math.floor(Math.random() * palette.length)];
    this.velocity = {
        x: Math.random() * 6 - 3,
        y: Math.random() * -15 - 5
    };
    this.gravity = 0.5;
    this.life = 100;
}

function animateFireworks() {
    if (fireworks.length === 0 && effectParticles.length === 0) {
        fireworksAnimationRunning = false;
        fireworksCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
        return;
    }

    fireworksCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);

    for (let i = 0; i < fireworks.length; i++) {
        const firework = fireworks[i];

        fireworksCtx.beginPath();
        fireworksCtx.arc(firework.x, firework.y, firework.radius, 0, Math.PI * 2);
        fireworksCtx.fillStyle = firework.color;
        fireworksCtx.fill();

        firework.x += firework.velocity.x;
        firework.y += firework.velocity.y;
        firework.velocity.y += firework.gravity;
        firework.life--;

        if (firework.life <= 0) {
            fireworks.splice(i, 1);
            i--;
        }
    }

    for (let i = 0; i < effectParticles.length; i++) {
        const particle = effectParticles[i];
        fireworksCtx.globalAlpha = Math.max(particle.life / 36, 0);
        fireworksCtx.fillStyle = particle.color;
        fireworksCtx.fillRect(particle.x, particle.y, particle.size, particle.size);
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.08;
        particle.life -= 1;

        if (particle.life <= 0) {
            effectParticles.splice(i, 1);
            i -= 1;
        }
    }

    fireworksCtx.globalAlpha = 1;

    requestAnimationFrame(animateFireworks);
}

function clearFireworks() {
    if (fireworksTimer) {
        clearTimeout(fireworksTimer);
        fireworksTimer = null;
    }

    fireworks = [];
    effectParticles = [];
    fireworksCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    clearWinningState();
}

window.addEventListener('pointerdown', () => {
    unlockAudio().catch(() => {});
}, { once: true });

window.addEventListener('resize', () => {
    fireworksCanvas.width = window.innerWidth;
    fireworksCanvas.height = window.innerHeight;
    updateWinningLine();
});
