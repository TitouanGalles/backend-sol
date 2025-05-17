const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const userRoutes = require('./routes/Users');
const User = require('./models/User');
const Game = require('./models/Games');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/pile-ou-face');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erreur de connexion MongoDB :'));
db.once('open', () => {
  console.log('✅ Connecté à MongoDB');
});

app.use('/users', userRoutes);

// Création d’une partie avec pseudo du joueur
app.post('/games', async (req, res) => {
  const { player, choice, amount } = req.body;

  if (!player || !choice || !amount) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    const user = await User.findOne({ wallet: player });
    if (!user) {
      return res.status(400).json({ error: 'Utilisateur non trouvé' });
    }

    const game = new Game({
      player,
      playerPseudo: user.pseudo,
      choice,
      amount,
      status: 'waiting',
    });

    await game.save();
    res.status(201).json(game);
  } catch (error) {
    console.error('Erreur création game :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupération des parties en attente
app.get('/games', async (req, res) => {
  try {
    const games = await Game.find({ status: 'waiting' });
    res.json(games);
  } catch (error) {
    console.error('Erreur récupération games:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejoindre une partie et sauvegarder l’opposant avec pseudo
app.post('/games/:id/join', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });
    if (game.status !== 'waiting') return res.status(400).json({ error: 'Partie déjà rejointe' });

    const { player: opponentWallet } = req.body;
    if (!opponentWallet) return res.status(400).json({ error: 'Nom de l\'adversaire requis' });

    const opponentUser = await User.findOne({ wallet: opponentWallet });
    if (!opponentUser) return res.status(400).json({ error: 'Utilisateur opposant non trouvé' });

    const result = Math.random() < 0.5 ? 'pile' : 'face';

    game.status = 'finished';
    game.opponent = opponentWallet;
    game.opponentPseudo = opponentUser.pseudo;
    game.result = result;
    game.winner = game.choice === result ? game.player : opponentWallet;

    await game.save();

    res.json(game);
  } catch (error) {
    console.error('Erreur rejoindre partie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend en écoute sur http://localhost:${PORT}`);
});

// GET /games/:id pour récupérer une partie précise
app.get('/games/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
