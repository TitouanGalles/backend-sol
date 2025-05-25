require('dotenv').config();

const bs58 = require('bs58');
const { Keypair, PublicKey, Connection, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Récupérer la clé privée base58 dans .env
const base58SecretKey = process.env.SOLANA_GAME_WALLET_SECRET;
if (!base58SecretKey) throw new Error('La clé secrète SOLANA_GAME_WALLET_SECRET est manquante dans .env');

const secretKey = bs58.decode(base58SecretKey);
const senderKeypair = Keypair.fromSecretKey(secretKey);

// Clé publique (optionnelle, souvent déduite de la clé privée)
const senderPublicKey = process.env.SOLANA_GAME_WALLET_PUBLIC || senderKeypair.publicKey.toBase58();

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function sendSolToWinner(winnerWalletBase58, amountSol) {
  const recipientPublicKey = new PublicKey(winnerWalletBase58);
  const lamports = amountSol * LAMPORTS_PER_SOL;

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey: recipientPublicKey,
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);
  return signature;
}

module.exports = { sendSolToWinner };
