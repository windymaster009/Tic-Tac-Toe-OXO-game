window.gameConfig = {
    apiBaseUrl: window.location.origin,
    animatedEmojiBaseUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest',
    animatedMoodAssets: {
        smirkCat: { codepoint: '1f63c', fallback: '😼' },
        eyes: { codepoint: '1f440', fallback: '👀' },
        melting: { codepoint: '1fae0', fallback: '🫠' },
        moon: { codepoint: '1f31c', fallback: '🌙' },
        thinking: { codepoint: '1f914', fallback: '🤔' },
        monocle: { codepoint: '1f9d0', fallback: '🧐' },
        cold: { codepoint: '1f976', fallback: '🥶' },
        partying: { codepoint: '1f973', fallback: '🥳' },
        crying: { codepoint: '1f62d', fallback: '😭' },
        woozy: { codepoint: '1f974', fallback: '😵‍💫' },
        nerd: { codepoint: '1f913', fallback: '🤓' },
        heartEyes: { codepoint: '1f60d', fallback: '😍' },
        halo: { codepoint: '1f607', fallback: '😇' },
        mindBlown: { codepoint: '1f92f', fallback: '🤯' },
        anxious: { codepoint: '1f630', fallback: '😰' }
    },
    clientWinningCombinations: [
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
    ]
};
