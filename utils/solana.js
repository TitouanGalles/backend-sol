const {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');

// 🔐 Clé secrète en base58 ou tableau Uint8Array dans .env ou fichier sécurisé
const secretKey = Uint8Array.from(JSON.parse(process.env.GAME_WALLET_SECRET));
const gameWallet = Keypair.fromSecretKey(secretKey);

// ⚡ Connection RPC
const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=cb2851f0-e2d7-481a-97f1-04403000595e');

async function sendSolToWinner(recipientWallet, amountSol) {
  const recipient = new PublicKey(recipientWallet);
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: gameWallet.publicKey,
      toPubkey: recipient,
      lamports: amountSol * LAMPORTS_PER_SOL,
    })
  );

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [gameWallet]);
    console.log('✅ Transaction envoyée :', signature);
    return signature;
  } catch (err) {
    console.error('❌ Échec de la transaction :', err);
    throw err;
  }
}

module.exports = { sendSolToWinner };
