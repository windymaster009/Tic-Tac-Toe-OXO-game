window.gameAudio = (() => {
    const bgMusic = document.getElementById('bgMusic');

    let audioContext = null;
    let audioUnlocked = false;
    let musicMode = 'idle';
    let currentMusicSrc = '';

    function ensureAudio() {
        if (audioContext) {
            return audioContext;
        }

        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) {
            return null;
        }

        audioContext = new Context();
        return audioContext;
    }

    async function unlockAudio() {
        const context = ensureAudio();

        if (!context || audioUnlocked) {
            return;
        }

        if (context.state === 'suspended') {
            await context.resume();
        }

        audioUnlocked = true;
        updateAdaptiveMusic();
    }

    function playTone({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.03, slideTo = null }) {
        const context = ensureAudio();

        if (!context || !audioUnlocked) {
            return;
        }

        const oscillator = context.createOscillator();
        const volume = context.createGain();
        const now = context.currentTime;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        if (slideTo) {
            oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
        }

        volume.gain.setValueAtTime(0.0001, now);
        volume.gain.exponentialRampToValueAtTime(gain, now + 0.01);
        volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        oscillator.connect(volume);
        volume.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    }

    function playMoveSound(symbol) {
        playTone({
            frequency: symbol === 'X' ? 420 : 520,
            slideTo: symbol === 'X' ? 640 : 760,
            duration: 0.09,
            type: 'triangle',
            gain: 0.04
        });
    }

    function playEraseSound() {
        playTone({ frequency: 260, slideTo: 120, duration: 0.22, type: 'sawtooth', gain: 0.03 });
    }

    function playInvalidSound() {
        playTone({ frequency: 180, slideTo: 120, duration: 0.12, type: 'square', gain: 0.025 });
    }

    function playWinSound(winnerSymbol) {
        playTone({ frequency: winnerSymbol === 'X' ? 520 : 620, slideTo: 840, duration: 0.18, type: 'triangle', gain: 0.05 });
        window.setTimeout(() => playTone({ frequency: 700, slideTo: 980, duration: 0.22, type: 'triangle', gain: 0.04 }), 120);
    }

    function playSwapSound() {
        playTone({ frequency: 320, slideTo: 740, duration: 0.22, type: 'triangle', gain: 0.04 });
    }

    function playUndoSound() {
        playTone({ frequency: 560, slideTo: 180, duration: 0.24, type: 'sawtooth', gain: 0.035 });
    }

    function playDoubleSound() {
        playTone({ frequency: 380, slideTo: 920, duration: 0.18, type: 'square', gain: 0.04 });
        window.setTimeout(() => playTone({ frequency: 520, slideTo: 1200, duration: 0.16, type: 'square', gain: 0.03 }), 80);
    }

    function startMusic() {
        if (!bgMusic || !audioUnlocked) {
            return;
        }

        bgMusic.volume = 0.25;
        bgMusic.play().catch(() => {});
    }

    function setMusicMode(nextMode) {
        if (musicMode === nextMode) {
            return;
        }

        musicMode = nextMode;
        updateAdaptiveMusic();
    }

    function updateAdaptiveMusic() {
        if (!bgMusic || !audioUnlocked) {
            return;
        }

        if (musicMode === 'idle') {
            bgMusic.pause();
            bgMusic.currentTime = 0;
            currentMusicSrc = '';
            return;
        }

        const nextSrc = musicMode === 'calm'
            ? './music/calm-theme.mp3'
            : musicMode === 'tense'
                ? './music/tense-theme.mp3'
                : './music/victory-theme.mp3';

        const shouldChangeTrack = currentMusicSrc !== nextSrc;
        bgMusic.loop = musicMode !== 'victory';
        bgMusic.volume = musicMode === 'victory' ? 0.3 : 0.25;

        if (shouldChangeTrack) {
            currentMusicSrc = nextSrc;
            bgMusic.src = nextSrc;
            bgMusic.load();
        }

        startMusic();
    }

    return {
        unlockAudio,
        playMoveSound,
        playEraseSound,
        playInvalidSound,
        playWinSound,
        playSwapSound,
        playUndoSound,
        playDoubleSound,
        setMusicMode
    };
})();
