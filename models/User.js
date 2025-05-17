const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  pseudo: { type: String, required: true },
});

module.exports = mongoose.model('user', userSchema);
