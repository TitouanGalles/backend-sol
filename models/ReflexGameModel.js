const mongoose = require('mongoose');

const ReflexGameSchema = new mongoose.Schema({
  host: {
    pseudo: String,
    wallet: String,
  },
  opponent: {
    pseudo: String,
    wallet: String,
  },
  amount: Number,
  status: {
    type: String,
    enum: ['waiting', 'en cours', 'terminée'],
    default: 'waiting',
  },
  winner: String, // adresse du gagnant
  hostTime: String, // en millisecondes
  opponentTime: String, // en millisecondes
  lock: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('ReflexGame', ReflexGameSchema);
