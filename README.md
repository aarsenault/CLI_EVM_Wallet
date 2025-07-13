# Minimal Command-line EVM wallet

This project implements a minimally viable EVM wallet written with TypeScript and Node.js

## Usage

Requirements:

* Node v20.11.0

Install dependencies:

```sh
npm install
```

Run the wallet CLI:

**Use defaults (test wallet)**

```sh
npx ts-node wallet.ts --to 0xabc... --value 0.01 --nonce 0
```

**Use custom mnemonic and path**

```sh
npx ts-node wallet.ts \
  --to 0xabc... \
  --value 0.01 \
  --nonce 0 \
  --mnemonic "twelve word mnemonic phrase here" \
  --path "m/44'/60'/0'/0/1"
```

**Broadcast transaction**

```sh
npx ts-node wallet.ts \
  --to 0x8ba1f109551bD432803012645Ac136ddd64DBA72 \
  --value 0.05 \
  --nonce 1 \
  --rpc https://mainnet.infura.io/v3/YOUR_KEY
```

### Required flags

* `--to` (hex Ethereum address)

* `--value` (ETH, as float)

* `--nonce` (integer)

### Optional flags

* `--mnemonic` (BIP-39 mnemonic phrase, default: "test test test test test test test test test test test junk")

* `--path` (BIP-32 derivation path, default: `m/44'/60'/0'/0/0`)

* `--gasPrice` (in wei, default: 1000000000)

* `--gasLimit` (default: 21000)

* `--chainId` (default: 1)

* `--rpc` (i.e. `--rpc https://mainnet.infura.io/v3/YOUR_INFURA_KEY`)

### The wallet will print

* Your derived address (from the provided mnemonic/path)

* Transaction parameters

* Raw signed transaction hex (ready to broadcast)

* Transaction hash (for tracking on a block explorer)

* The network transaction hash after broadcasting if `--rpc` flag is set

## Design Decision

Per the spec, most third party dependencies were avoided. However rather than re-implementing complex and security-critical primitives I chose to use a minimal set industry-standard, audited libraries. All versions are pinned in package.json to ensure auditability and to prevent the possibility of supply chain attacks. This approach balances minimalism, real-world safety, and also the 3 hour time constraint.

**Runtime dependencies:**
- [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) (`1.8.0`): Modern, audited cryptographic hash functions (Keccak256 for Ethereum).
- [`@scure/bip32`](https://github.com/paulmillr/scure-bip32) (`1.7.0`): Secure, minimal BIP-32 HD key derivation (for Ethereum/Bitcoin-compatible wallets).
- [`rlp`](https://github.com/ethereumjs/rlp) (`3.0.0`): Recursive Length Prefix serialization for Ethereum transactions.
- [`secp256k1`](https://github.com/cryptocoinjs/secp256k1-node) (`5.0.1`): Fast, secure secp256k1 elliptic curve operations (for signing).
