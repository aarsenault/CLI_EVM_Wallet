import {
  mnemonicToSeedSync,
  derivePath,
  getPublicKey,
  publicKeyToAddress,
  keccak256,
  signTransaction,
  isHexAddress,
  broadcastRawTx,
} from "./utils/cryptography";
import { parseArgs } from "./utils/parseArgs";

// --- Default mnemonic/path
const MNEMONIC =
  "test test test test test test test test test test test test test junk";
const PATH = "m/44'/60'/0'/0/0";

// --- Parse CLI args
const argv = parseArgs(process.argv.slice(2));

// --- CLI help message
const HELP_MESSAGE = `\nMinimal Wallet CLI: Sign and serialize Ethereum transactions\n\nUsage: node wallet.js --to <address> --value <eth> --nonce <n> [--gasPrice <gwei>] [--gasLimit <units>] [--chainId <id>] [--rpc <endpoint>] [--mnemonic <phrase>] [--path <derivation>]\nExample: node wallet.js --to 0xabc... --value 0.01 --nonce 0\n\nRequired flags:\n  --to        0x-prefixed, 20-byte hex Ethereum address\n  --value     Amount in ETH (e.g. 0.01)\n  --nonce     Nonce for the transaction\n\nOptional flags:\n  --gasPrice  Gas price in wei (default: 1_000_000_000)\n  --gasLimit  Gas limit (default: 21000)\n  --chainId   Chain ID (default: 1)\n  --rpc       Ethereum JSON-RPC endpoint (e.g. https://mainnet.infura.io/v3/YOUR_KEY)\n  --mnemonic  BIP-39 mnemonic phrase (default: test test test test test test test test test test test test test junk)\n  --path      BIP-32 derivation path (default: m/44'/60'/0'/0/0)\n\nFor production, validate input (e.g., that --to is a valid hex address)\nPrints the wallet address, transaction parameters, raw transaction hex, and transaction hash.\nIf --rpc is provided, broadcasts the transaction to the network.\n`;

if (argv.help || argv["--help"]) {
  console.log(HELP_MESSAGE);
  process.exit(0);
}


// --- Derive private key and address
const mnemonic = argv.mnemonic || MNEMONIC;
const path = argv.path || PATH;

const seed = mnemonicToSeedSync(mnemonic);
const { key: privateKey } = derivePath(path, seed);
const publicKey = getPublicKey(privateKey);
const address = publicKeyToAddress(publicKey);

console.log("Wallet address:", address);
console.log("Derivation path:", path);

if (!argv.to || !argv.value || typeof argv.nonce !== "number") {
  console.error("\nMissing required flags.\n");
  console.error(
    "Usage: node wallet.js --to <address> --value <eth> --nonce <n> [--gasPrice <gwei>] [--gasLimit <units>] [--chainId <id>]"
  );
  console.error("Example: node wallet.js --to 0xabc... --value 0.01 --nonce 0");
  process.exit(1);
}

if (!isHexAddress(argv.to)) {
  console.error(
    `\nInvalid --to address: '${argv.to}'. Must be a 0x-prefixed, 40-hex-character Ethereum address.`
  );
  process.exit(1);
}

if (isNaN(parseFloat(argv.value)) || parseFloat(argv.value) < 0) {
  console.error(
    `\nInvalid --value: '${argv.value}'. Must be a non-negative number.`
  );
  process.exit(1);
}

if (!Number.isInteger(argv.nonce) || argv.nonce < 0) {
  console.error(
    `\nInvalid --nonce: '${argv.nonce}'. Must be a non-negative integer.`
  );
  process.exit(1);
}

// --- Validate RPC URL if provided
if (argv.rpc) {
  const rpcUrl = String(argv.rpc);
  try {
    new URL(rpcUrl);
  } catch {
    console.error(`\nInvalid --rpc URL: '${rpcUrl}'. Must be a valid URL.`);
    process.exit(1);
  }
}

const to = argv.to;
const value = BigInt(Math.floor(parseFloat(argv.value) * 1e18)); // eth to wei
const nonce = Number(argv.nonce);
const gasPrice = argv.gasPrice ? BigInt(argv.gasPrice) : BigInt(1_000_000_000); // default 1 gwei
const gasLimit = argv.gasLimit ? BigInt(argv.gasLimit) : BigInt(21000);
const chainId = argv.chainId ? Number(argv.chainId) : 1;

console.log({
  to,
  value: value.toString(),
  nonce,
  gasPrice: gasPrice.toString(),
  gasLimit: gasLimit.toString(),
  chainId,
});

// --- Output warnings for suspicious gas price or nonce
if (nonce !== 0) {
  console.warn(
    "[Warning] Nonce is not 0. If this is a new wallet, the nonce should be 0."
  );
}
const gwei = 1_000_000_000n;
if (gasPrice < gwei) {
  console.warn(
    "[Warning] Gas price is very low (<1 gwei). Your transaction may never be mined."
  );
} else if (gasPrice > 1_000_000_000_000n) {
  console.warn(
    "[Warning] Gas price is very high (>1000 gwei). You may overpay for this transaction."
  );
}

//  --- Sign and output
const raw = signTransaction(
  nonce,
  gasPrice,
  gasLimit,
  to,
  value,
  new Uint8Array(0),
  chainId,
  privateKey
);

// For submitting to the network
const rawTxHex = "0x" + Buffer.from(raw).toString("hex");
console.log("Raw TX hex to submit:", rawTxHex);
const txHash = keccak256(raw);

// for tracking on Etherscan
console.log("TX hash:", Buffer.from(txHash).toString("hex"));

// --- Broadcast if requested
if (argv.rpc) {
  (async () => {
    try {
      const result = await broadcastRawTx(rawTxHex, String(argv.rpc));
      console.log("Broadcast success! Network tx hash:", result);
    } catch (err: any) {
      console.error("Broadcast failed:", err.message || err);
    }
  })();
}
