const express = require('express');
const router = express.Router();
const ReflexGame = require('../models/ReflexGameModel');
const { sendSolToWinner } = require('../solanaWallet'); // ta fonction solana

// ▶ Créer une partie réflexe
router.post('/api/reflex/create', async (req, res) => {
  console.log("BODY REÇU :", req.body);
  const { amount, host } = req.body;

  try {
    const game = new ReflexGame({
      host: {
        pseudo: host.pseudo,
        wallet: host.wallet
      },
      amount,
      status: 'waiting',
      lock: false,
    });
    await game.save();

    // Récupérer io depuis app
    const io = req.app.get('io');
    if (io) {
      io.emit('game-created-reflex', game);  // Émet à tous les clients
    }

    res.status(201).json(game);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur création partie' });
  }
});

// ▶ Rejoindre une partie réflexe
router.post('/api/reflex/join/:id', async (req, res) => {
  const { pseudo, wallet } = req.body;
  const gameId = req.params.id;

  try {
    const game = await ReflexGame.findById(gameId);
    if (!game || game.lock || (game.opponent && game.opponent.wallet)) {
      return res.status(400).json({ error: 'Partie non disponible' });
    }

    game.opponent = { pseudo, wallet };
    game.status = 'waiting';
    game.lock = true;
    await game.save();
    
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('player-joined-reflex', game);
      //io.emit('reflexGame-updated', game);  // Émet à tous les clients
    }
    console.log("rejoint : ", game);
    res.status(200).json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la jointure' });
  }
});

// ▶ Fin de partie réflexe
router.post('/api/reflex/end/:id', async (req, res) => {
  const io = req.app.get('io');
  const gameId = req.params.id;
  const { winner } = req.body;

  try {
    const game = await ReflexGame.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });

    game.status = 'terminée';
    game.winner = winner || null;

    // Si un gagnant est défini, effectue la transaction
    /*if (game.winner) {
      try {
        const totalAmount = game.amount * 1.9;
        const txSignature = await sendSolToWinner(game.winner, totalAmount);
        game.transaction = txSignature;
      } catch (error) {
        return res.status(500).json({ error: 'Transaction échouée', detail: error.message });
      }
    }*/

    await game.save();

    // Notifie les clients via Socket.IO
    if (io) {
      io.to(gameId).emit('game-finished-reflex', game);
    }

    res.status(200).json(game);
  } catch (err) {
    console.error('Erreur serveur lors de la fin de partie :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ▶ Liste parties réflexe en attente
router.get('/api/reflex/games', async (req, res) => {
  try {
    const games = await ReflexGame.find({ status: 'waiting' });
    res.status(200).json(games);
  } catch (err) {
    res.status(500).json({ error: 'Erreur récupération parties' });
  }
});

// ▶ Verrouiller une partie réflexe
router.post('/api/reflex/lock/:id', async (req, res) => {
  const io = req.app.get('io');
  const gameId = req.params.id;

  try {
    const game = await ReflexGame.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });

    game.lock = true;
    await game.save();

    if (io) {
      io.emit('game-updated-reflex', game);
    }

    res.status(200).json({ message: 'Partie verrouillée', game });
  } catch (err) {
    res.status(500).json({ error: 'Erreur verrouillage partie' });
  }
});

// ▶ Déverrouiller une partie réflexe
router.post('/api/reflex/unlock/:id', async (req, res) => {
  const io = req.app.get('io');
  const gameId = req.params.id;

  try {
    const game = await ReflexGame.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });

    game.lock = false;
    await game.save();

    if (io) {
      io.emit('game-updated-reflex', game);
    }

    res.status(200).json({ message: 'Partie déverrouillée', game });
  } catch (err) {
    res.status(500).json({ error: 'Erreur déverrouillage partie' });
  }
});

router.post('/api/reflex/time/:id', async (req, res) => {
  
  const io = req.app.get('io');
  const gameId = req.params.id;
  const { wallet, time } = req.body;

  try {
    const game = await ReflexGame.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });

    let updated = false;
    if (game.host.wallet === wallet) {
      game.hostTime = Math.round(time).toString();
      updated = true;
    } else if (game.opponent?.wallet === wallet) {
      game.opponentTime = Math.round(time).toString();
      updated = true;
    }

    if (!updated) {
      return res.status(403).json({ error: "Ce joueur n'appartient pas à cette partie." });
    }

    await game.save();

    if (io) {
      io.to(gameId).emit('timeUpdate', {
        gameId,
        wallet,
        hostTime: game.hostTime,
        opponentTime: game.opponentTime
      });
      console.log("time : ", game);
      // Ajout ici : si les deux temps sont présents, émettre reflexResult
      if (game.hostTime && game.opponentTime) {
        io.to(gameId).emit('reflexResult', {
          gameId,
          hostTime: game.hostTime,
          opponentTime: game.opponentTime
        });
      }
    }

    res.status(200).json({ message: 'Temps enregistré', game });
  } catch (err) {
    console.error('Erreur sendTime:', err);
    res.status(500).json({ error: 'Erreur enregistrement temps' });
  }
});


module.exports = router;
