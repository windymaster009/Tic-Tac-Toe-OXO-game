
const board = document.getElementById('game-board');
const resultElement = document.getElementById('result');
const restartButton = document.getElementById('restart-btn');
const scoreElement = document.getElementById('score');
const cells = Array.from({ length: 36 }, (_, index) => index + 1);
const fireworksCanvas = document.getElementById('fireworkCanvas');
const fireworksCtx = fireworksCanvas.getContext('2d');

fireworksCanvas.width = window.innerWidth;
fireworksCanvas.height = window.innerHeight;

let fireworks = [];

// Initialize the game board
cells.forEach(cell => {
    const cellElement = document.createElement('div');
    cellElement.classList.add('cell');
    cellElement.dataset.index = cell;
    board.appendChild(cellElement);

    // Add click event listener to each cell
    cellElement.addEventListener('click', () => handleCellClick(cell));
});

let currentPlayer = 'X';
let gameBoardState = Array(36).fill(null);
let gameEnded = false;
let xWins = 0;
let oWins = 0;

function handleCellClick(index) {
    if (!gameBoardState[index - 1] && !gameEnded) {
        // Check if the cell is not already marked
        gameBoardState[index - 1] = currentPlayer;
        updateCellText(index, currentPlayer);
        checkWinner();
        switchPlayer();
    }
}

function updateCellText(index, value) {
    const cell = document.querySelector(`[data-index="${index}"]`);
    cell.textContent = value;
    cell.classList.add(`cell-${value}`);
}

function switchPlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
}

function checkWinner() {
    // Define winning combinations for 5 in a row
    const winningCombinations = [
        // Rows
        [0, 1, 2, 3, 4], [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10], [7, 8, 9, 10, 11],
        [12, 13, 14, 15, 16], [13, 14, 15, 16, 17],
        [18, 19, 20, 21, 22], [19, 20, 21, 22, 23],
        [24, 25, 26, 27, 28], [25, 26, 27, 28, 29],
        [30, 31, 32, 33, 34], [31, 32, 33, 34, 35],
        // Columns
        [0, 6, 12, 18, 24], [6, 12, 18, 24, 30],
        [1, 7, 13, 19, 25], [7, 13, 19, 25, 31],
        [2, 8, 14, 20, 26], [8, 14, 20, 26, 32],
        [3, 9, 15, 21, 27], [9, 15, 21, 27, 33],
        [4, 10, 16, 22, 28], [10, 16, 22, 28, 34],
        [5, 11, 17, 23, 29], [11, 17, 23, 29, 35],
        // Diagonals
        [0, 7, 14, 21, 28], [1, 8, 15, 22, 29],
        [5, 10, 15, 20, 25], [6, 13, 20, 27, 34]
    ];

    // Check for a winner
    for (const combination of winningCombinations) {
        if (combination.every(index => gameBoardState[index] && gameBoardState[index] === gameBoardState[combination[0]])) {
            highlightWinningCells(combination);
            if (gameBoardState[combination[0]] === 'X') {
                xWins++;
            } else {
                oWins++;
            }
            updateScore();
            resultElement.textContent = `${gameBoardState[combination[0]]} wins!`;
            gameEnded = true;
            disableCellClicks();
            showRestartButton();
            triggerFireworks();
            return;
        }
    }

    // Check for a tie
    if (!gameBoardState.includes(null)) {
        resultElement.textContent = 'It\'s a tie!';
        gameEnded = true;
        disableCellClicks();
        showRestartButton();
    }
}

function highlightWinningCells(combination) {
    combination.forEach(index => {
        const cell = document.querySelector(`[data-index="${index + 1}"]`);
        cell.classList.add('win-cell');
    });
}

function disableCellClicks() {
    // Disable further clicks on cells after the game ends
    cells.forEach(cell => {
        const cellElement = document.querySelector(`[data-index="${cell}"]`);
        cellElement.removeEventListener('click', () => handleCellClick(cell));
    });
}

function showRestartButton() {
    restartButton.style.display = 'block';
}

function updateScore() {
    scoreElement.textContent = `X Wins: ${xWins} | O Wins: ${oWins}`;
}

function restartGame() {
    // Reset game state
    gameBoardState = Array(36).fill(null);
    cells.forEach(cell => {
        const cellElement = document.querySelector(`[data-index="${cell}"]`);
        cellElement.textContent = '';
        cellElement.classList.remove('win-cell', 'cell-X', 'cell-O');
    });
    currentPlayer = 'X';
    resultElement.textContent = '';
    gameEnded = false;

    // Enable cell clicks
    cells.forEach(cell => {
        const cellElement = document.querySelector(`[data-index="${cell}"]`);
        cellElement.addEventListener('click', () => handleCellClick(cell));
    });

    // Hide restart button
    restartButton.style.display = 'none';
}

function triggerFireworks() {
    // Add 200 fireworks
    for (let i = 0; i < 200; i++) {
        fireworks.push(new Firework());
    }

    animateFireworks();
    setTimeout(clearFireworks, 5000); // Clear fireworks after 5 seconds
}

function Firework() {
    this.x = Math.random() * fireworksCanvas.width;
    this.y = fireworksCanvas.height;
    this.radius = 5;
    this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    this.velocity = {
        x: Math.random() * 6 - 3,
        y: Math.random() * -15 - 5
    };
    this.gravity = 0.5;
    this.life = 100;
}

function animateFireworks() {
    if (fireworks.length === 0) return;

    fireworksCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);

    for (let i = 0; i < fireworks.length; i++) {
        let firework = fireworks[i];

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

    requestAnimationFrame(animateFireworks);
}

function clearFireworks() {
    fireworks = [];
}
