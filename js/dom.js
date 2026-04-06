window.gameDom = (() => {
    const board = document.getElementById('game-board');
    const roomCodeInput = document.getElementById('room-code');
    const createRoomButton = document.getElementById('create-room-btn');
    const joinRoomButton = document.getElementById('join-room-btn');
    const copyRoomButton = document.getElementById('copy-room-btn');
    const hintButton = document.getElementById('hint-btn');
    const connectionStatusElement = document.getElementById('connection-status');
    const playerStatusElement = document.getElementById('player-status');
    const resultElement = document.getElementById('result');
    const restartButton = document.getElementById('restart-btn');
    const scoreElement = document.getElementById('score');
    const scoreXValueElement = document.getElementById('score-x-value');
    const scoreOValueElement = document.getElementById('score-o-value');
    const moodXElement = document.getElementById('mood-x');
    const moodOElement = document.getElementById('mood-o');
    const toastElement = document.getElementById('toast');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessageElement = document.getElementById('confirm-message');
    const confirmCancelButton = document.getElementById('confirm-cancel-btn');
    const confirmOkButton = document.getElementById('confirm-ok-btn');
    const abilityButtons = Array.from(document.querySelectorAll('.ability-btn'));
    const abilityBars = Array.from(document.querySelectorAll('.ability-fill'));
    const winLineElement = document.getElementById('win-line');
    const fireworksCanvas = document.getElementById('fireworkCanvas');
    const fireworksCtx = fireworksCanvas.getContext('2d');
    const cells = Array.from({ length: 36 }, (_, index) => index + 1);

    return {
        board,
        roomCodeInput,
        createRoomButton,
        joinRoomButton,
        copyRoomButton,
        hintButton,
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
    };
})();
