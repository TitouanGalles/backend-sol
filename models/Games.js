const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  player: { type: String, required: true },       // wallet
  playerPseudo: { type: String, required: true }, // pseudo du créateur
  choice: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'waiting' },
  opponent: String,                               // wallet de l’adversaire
  opponentPseudo: String,                         // pseudo de l’adversaire ✅ AJOUT ICI
  result: String,
  winner: String,
});

module.exports = mongoose.model('Game', gameSchema);