window.gameAudio = (() => {
    const bgMusic = document.getElementById('bgMusic');
    const DEFAULT_MUSIC_VOLUME = 0.25;
    const storedVolume = Number.parseFloat(window.localStorage.getItem('oxo-music-volume') || `${DEFAULT_MUSIC_VOLUME}`);
    const storedMuted = window.localStorage.getItem('oxo-music-muted') === 'true';

    let audioContext = null;
    let audioUnlocked = false;
    let musicMode = 'idle';
    let currentMusicSrc = '';
    const trackPositions = {};
    let musicVolume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(1, storedVolume)) : DEFAULT_MUSIC_VOLUME;
    let musicMuted = storedMuted;

    function applyMusicVolume() {
        if (!bgMusic) {
            return;
        }

        bgMusic.volume = musicMuted ? 0 : musicVolume;
        bgMusic.muted = musicMuted;
    }

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

    function playKnockSound() {
        playTone({ frequency: 220, duration: 0.08, type: 'triangle', gain: 0.035, slideTo: 200 });
        window.setTimeout(() => {
            playTone({ frequency: 220, duration: 0.08, type: 'triangle', gain: 0.035, slideTo: 200 });
        }, 150);
    }

    function startMusic() {
        if (!bgMusic || !audioUnlocked) {
            return;
        }

        applyMusicVolume();
        bgMusic.play().catch(() => {});
    }

    function storeCurrentTrackPosition() {
        if (!bgMusic || !currentMusicSrc || Number.isNaN(bgMusic.currentTime)) {
            return;
        }

        trackPositions[currentMusicSrc] = bgMusic.currentTime;
    }

    function restoreTrackPosition(trackSrc) {
        if (!bgMusic || !trackSrc) {
            return;
        }

        const savedPosition = trackPositions[trackSrc];
        if (typeof savedPosition !== 'number' || savedPosition <= 0) {
            return;
        }

        const applyPosition = () => {
            try {
                bgMusic.currentTime = savedPosition;
            } catch (error) {
                // Ignore seek timing issues until metadata is ready.
            }
        };

        if (bgMusic.readyState >= 1) {
            applyPosition();
            return;
        }

        bgMusic.addEventListener('loadedmetadata', applyPosition, { once: true });
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
            storeCurrentTrackPosition();
            bgMusic.pause();
            return;
        }

        const nextSrc = musicMode === 'calm'
            ? './music/calm-theme.mp3'
            : musicMode === 'tense'
                ? './music/tense-theme.mp3'
                : './music/victory-theme.mp3';

        const shouldChangeTrack = currentMusicSrc !== nextSrc;
        bgMusic.loop = musicMode !== 'victory';
        applyMusicVolume();

        if (shouldChangeTrack) {
            storeCurrentTrackPosition();
            currentMusicSrc = nextSrc;
            bgMusic.src = nextSrc;
            bgMusic.load();
            restoreTrackPosition(nextSrc);
        }

        startMusic();
    }

    function setMusicVolume(nextVolume) {
        musicVolume = Math.max(0, Math.min(1, nextVolume));
        window.localStorage.setItem('oxo-music-volume', String(musicVolume));
        applyMusicVolume();
    }

    function toggleMusicMute() {
        musicMuted = !musicMuted;
        window.localStorage.setItem('oxo-music-muted', String(musicMuted));
        applyMusicVolume();
        return musicMuted;
    }

    function setMusicMuted(nextMuted) {
        musicMuted = Boolean(nextMuted);
        window.localStorage.setItem('oxo-music-muted', String(musicMuted));
        applyMusicVolume();
    }

    function getMusicSettings() {
        return {
            volume: musicVolume,
            muted: musicMuted
        };
    }

    applyMusicVolume();

    if (bgMusic) {
        bgMusic.addEventListener('timeupdate', () => {
            storeCurrentTrackPosition();
        });

        bgMusic.addEventListener('ended', () => {
            if (currentMusicSrc) {
                trackPositions[currentMusicSrc] = 0;
            }
        });
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
        playKnockSound,
        setMusicMode,
        setMusicVolume,
        toggleMusicMute,
        setMusicMuted,
        getMusicSettings
    };
})();
