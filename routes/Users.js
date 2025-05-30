const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Créer ou récupérer un utilisateur
router.post('/', async (req, res) => {
  const { wallet, pseudo } = req.body;
  if (!wallet || !pseudo) return res.status(400).json({ error: 'wallet et pseudo requis' });

  try {
    let user = await User.findOne({ wallet });
    if (user) return res.json(user);

    user = new User({ wallet, pseudo });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error('Erreur création utilisateur :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer un utilisateur par wallet
router.get('/:wallet', async (req, res) => {
  try {
    const user = await User.findOne({ wallet: req.params.wallet });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(user);
    console.log(user);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
