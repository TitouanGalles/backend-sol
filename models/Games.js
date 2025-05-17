const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  player: { type: String, required: true },       // wallet
  playerPseudo: { type: String, required: true }, // pseudo copié ici
  choice: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'waiting' },
  opponent: String,
  result: String,
  winner: String,
});

module.exports = mongoose.model('Game', gameSchema);
