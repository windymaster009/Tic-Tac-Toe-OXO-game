# Tic-Tac-Toe OXO

A multiplayer OXO game with rooms, abilities, effects, and dark neon UI.

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000/`

## Deploy online

The easiest option is a Node host like Render or Railway because this app serves both:
- the frontend files
- the multiplayer API

### Render

1. Push this repo to GitHub
2. Create a new `Web Service` on Render
3. Connect the GitHub repo
4. Use:

```text
Build Command: npm install
Start Command: npm start
```

Render will provide a public URL like:

```text
https://your-game-name.onrender.com
```

### Railway

1. Push this repo to GitHub
2. Create a new project on Railway from the repo
3. Railway should detect Node automatically
4. Use:

```text
Start Command: npm start
```

After deploy, share the public app URL with your friends.

## Music files

If you want real background music, add these files into [`music/`](./music):

- `calm-theme.mp3`
- `tense-theme.mp3`
- `victory-theme.mp3`

## Screenshots

![Screenshot 1](https://i.imgur.com/nfAObUM.jpg)
![Screenshot 2](https://i.imgur.com/J6M3PES.jpg)
