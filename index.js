require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const userRoutes = require('./routes/Users');
const reflexRoutes = require('./routes/reflexRoutes');
const User = require('./models/User');
const Game = require('./models/Games');
const ReflexGame = require('./models/ReflexGameModel');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

// Expose io to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/users', userRoutes);
app.use(reflexRoutes);
app.set('io', io);

// Connexion MongoDB
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error("❌ MONGO_URI non défini !");
  process.exit(1);
}
mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Erreur MongoDB :', err);
    process.exit(1);
  });

// Gestion Socket.io : connexion et gestion rooms par id de partie
io.on('connection', (socket) => {
  console.log('Client connecté, id:', socket.id);

  // Envoi liste parties waiting
  const sendWaitingGames = async () => {
    const waitingGames = await Game.find({ status: 'waiting' });
    socket.emit('waiting-games', waitingGames);
  };

  socket.on('request-waiting-games', sendWaitingGames);

  socket.on('request-waiting-reflexGames', async () => {
    try {
      const waitingReflexGames = await ReflexGame.find({ status: 'waiting' });
      socket.emit('waiting-reflexGames', waitingReflexGames);
    } catch (error) {
      console.error('Erreur récupération reflex games:', error);
    }
  });

  socket.on('join-game-room', (gameId) => {
    console.log(`Socket ${socket.id} rejoint la room ${gameId}`);
    socket.join(gameId);
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });
});

// Routes
app.use('/users', userRoutes);

// ▶ Créer une partie
app.post('/games', async (req, res) => {
  
  const { player, choice, amount } = req.body;
  if (!player || !choice || !amount) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    const user = await User.findOne({ wallet: player });
    if (!user) return res.status(400).json({ error: 'Utilisateur non trouvé' });

    const game = new Game({
      player,
      playerPseudo: user.pseudo,
      choice,
      amount,
      status: 'waiting',
    });

    await game.save();
    io.emit('game-created', game);
    res.status(201).json(game);
  } catch (error) {
    console.error('Erreur création game :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ▶ Lister les parties en attente
app.get('/games', async (req, res) => {
  try {
    const games = await Game.find({ status: 'waiting' });
    res.json(games);
  } catch (error) {
    console.error('Erreur récupération games:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ▶ Rejoindre une partie
app.post('/games/:id/join', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });
    if (game.status !== 'waiting') return res.status(400).json({ error: 'Déjà rejointe' });

    const { player: opponentWallet, pseudo: opponentPseudo } = req.body;
    if (!opponentWallet || !opponentPseudo) {
      return res.status(400).json({ error: 'Wallet et pseudo de l\'adversaire requis' });
    }

    game.opponent = opponentWallet;
    game.opponentPseudo = opponentPseudo;
    game.status = 'playing';  

    await game.save();

    // Émission de l'événement uniquement aux clients dans la room de la partie
    io.to(req.params.id).emit('player-joined', game);
    io.emit('game-updated', game);

    res.json(game);
  } catch (error) {
    console.error('Erreur rejoindre partie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ▶ Partie par ID
app.get('/games/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ▶ Lancer le décompte et envoyer le résultat pour animation
app.post('/games/:id/start', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });
    if (game.status !== 'playing') return res.status(400).json({ error: 'Partie pas prête à démarrer' });

    const result = Math.random() < 0.5 ? 'pile' : 'face';

    // Stocker temporairement le résultat dans la base
    game.result = result;
    await game.save();

    // Émettre l'événement aux joueurs dans la room
    io.to(req.params.id).emit('game-started', { result });

    res.json({ message: 'Décompte lancé', result });
  } catch (error) {
    console.error('Erreur démarrage partie :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

const { sendSolToWinner } = require('./solanaWallet');

app.post('/games/:id/finish', async (req, res) => {
  console.log("finish");
  try {
    const game = await Game.findById(req.params.id);
    console.log("game = ", game);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });
    if (game.status !== 'playing') return res.status(400).json({ error: 'Partie pas en cours' });
    if (!game.result) return res.status(400).json({ error: 'Résultat non généré' });

    // Déterminer le gagnant (player ou opponent selon ton logique)
    console.log("game : ", game);
    const winner = game.choice === game.result ? game.player : game.opponent;
    game.winner = winner;
    game.status = 'finished';

    // Transfert depuis wallet du jeu vers gagnant
    const totalAmount = game.amount * 1.9; // mise totale

    try {
      console.log("Gagnant déterminé :", winner);
      console.log("Adresse du wallet :", winner?.wallet);
      const txSignature = await sendSolToWinner(winner, totalAmount);
      game.transaction = txSignature;
    } catch (err) {
      console.error('Erreur transaction SOL :', err);
      return res.status(500).json({ error: 'Transaction échouée', detail: err.message });
    }

    await game.save();

    // Notifier joueurs
    io.to(req.params.id).emit('game-finished', game);

    res.json(game);
  } catch (err) {
    console.error('Erreur fin de partie:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/games/lock/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game || game.lock || game.opponentPseudo) {
      return res.status(403).json({ message: 'Déjà verrouillée ou rejointe' });
    }
    game.lock = true;
    await game.save();
    io.emit('game-updated', game);
    res.status(200).json({ message: 'Verrouillée' });
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur lors du lock' });
  }
});

app.post('/api/games/unlock/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (game) {
      game.lock = false;
      await game.save();
      io.emit('game-updated', game);
      res.status(200).json({ message: 'Déverrouillée' });
    } else {
      res.status(404).json({ message: 'Partie introuvable' });
    }
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur lors du unlock' });
  }
});

app.delete('/api/games/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // Récupérer la partie avant suppression
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ message: 'Partie non trouvée' });
    }

    // Vérifier si un adversaire a rejoint (exemple: game.player2)
    if (game.opponent) {
      return res.status(400).json({ message: 'Impossible d\'annuler, la partie a déjà un adversaire' });
    }

    // Calcul du montant à rembourser (95% de la mise)
    const totalAmount = game.amount * 0.95;

    try {
      // Appel de ta fonction d'envoi SOL
      const txSignature = await sendSolToWinner(game.player, totalAmount);
      game.transaction = txSignature; // Optionnel, si tu veux garder la trace dans DB (avant suppression ?)
    } catch (err) {
      console.error('Erreur transaction SOL :', err);
      return res.status(500).json({ error: 'Transaction échouée', detail: err.message });
    }

    // Suppression de la partie
    await Game.findByIdAndDelete(id);
    io.emit('gameSupp');

    res.status(200).send({ message: 'Partie supprimée et remboursement effectué' });

  } catch (error) {
    console.error('Erreur suppression partie :', error);
    res.status(500).send({ message: 'Erreur suppression partie' });
  }
});


// ▶ Lancer le serveur HTTP + WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Backend en écoute sur port ${PORT}`);
});




  