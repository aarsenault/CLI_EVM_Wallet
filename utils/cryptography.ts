import { pbkdf2Sync, createECDH } from "crypto";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { HDKey } from "@scure/bip32";

import * as rlp from "rlp";
import * as secp256k1 from "secp256k1";

// -- BIP-39: Mnemonic to seed
export function mnemonicToSeedSync(
  mnemonic: string,
  passphrase: string = ""
): Uint8Array {
  const salt = "mnemonic" + passphrase;
  return new Uint8Array(
    pbkdf2Sync(
      mnemonic.normalize("NFKD"),
      salt.normalize("NFKD"),
      2048,
      64,
      "sha512"
    )
  );
}

export function derivePath(
  path: string,
  seed: Uint8Array
): { key: Uint8Array; chainCode: Uint8Array } {
  const hdkey = HDKey.fromMasterSeed(seed);
  const child = hdkey.derive(path);
  if (!child.privateKey || !child.chainCode) {
    throw new Error("Could not derive child key for given path");
  }
  return {
    key: child.privateKey,
    chainCode: child.chainCode,
  };
}

export function getPublicKey(privateKey: Uint8Array): Uint8Array {
  const ecdh = createECDH("secp256k1");
  ecdh.setPrivateKey(privateKey);
  return new Uint8Array(ecdh.getPublicKey(null, "uncompressed"));
}

export function publicKeyToAddress(pubKey: Uint8Array): string {
  if (pubKey.length !== 65) throw new Error("Invalid public key length");
  const pubKeyNoPrefix = pubKey.subarray(1);
  const hash = keccak256(pubKeyNoPrefix);
  const addressBytes = hash.subarray(-20);
  return "0x" + Buffer.from(addressBytes).toString("hex");
}

export function keccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data);
}

export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length === 0) return new Uint8Array(0);
  const bytes = new Uint8Array(Math.ceil(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function encodeTx(
  nonce: number,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: Uint8Array,
  chainId: number
) {
  return [
    nonce === 0 ? new Uint8Array(0) : hexToUint8Array(nonce.toString(16)),
    gasPrice === BigInt(0)
      ? new Uint8Array(0)
      : hexToUint8Array(gasPrice.toString(16)),
    gasLimit === BigInt(0)
      ? new Uint8Array(0)
      : hexToUint8Array(gasLimit.toString(16)),
    hexToUint8Array(to),
    value === BigInt(0)
      ? new Uint8Array(0)
      : hexToUint8Array(value.toString(16)),
    data,
    hexToUint8Array(chainId.toString(16)),
    new Uint8Array(0),
    new Uint8Array(0),
  ];
}

export function isHexAddress(addr: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
  try {
    const bytes = Buffer.from(addr.slice(2), "hex");
    return bytes.length === 20;
  } catch {
    return false;
  }
}

export function signTransaction(
  nonce: number,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: Uint8Array,
  chainId: number,
  privateKey: Uint8Array
) {
  // 1. RLP encode tx for signing
  const rawTx = encodeTx(nonce, gasPrice, gasLimit, to, value, data, chainId);
  const rlpEncoded = rlp.encode(rawTx);
  const msgHash = keccak256(rlpEncoded);

  // 2. Sign the hash
  const { signature, recid } = secp256k1.ecdsaSign(msgHash, privateKey);
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  const v = chainId * 2 + 35 + recid; // EIP-155

  // 3. RLP encode the full tx with v, r, s
  const tx = [
    nonce === 0 ? new Uint8Array(0) : hexToUint8Array(nonce.toString(16)),
    gasPrice === BigInt(0)
      ? new Uint8Array(0)
      : hexToUint8Array(gasPrice.toString(16)),
    gasLimit === BigInt(0)
      ? new Uint8Array(0)
      : hexToUint8Array(gasLimit.toString(16)),
    hexToUint8Array(to),
    value === BigInt(0)
      ? new Uint8Array(0)
      : hexToUint8Array(value.toString(16)),
    data,
    hexToUint8Array(v.toString(16)),
    r,
    s,
  ];
  return rlp.encode(tx);
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

export async function broadcastRawTx(rawTxHex: string, rpcUrl: string) {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_sendRawTransaction",
        params: [rawTxHex],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
        `Expected JSON response, got: ${text.substring(0, 200)}...`
      );
    }

    const data = (await response.json()) as JsonRpcResponse;
    if (data.error) {
      throw new Error(
        `RPC Error: ${data.error.message} (code: ${data.error.code})`
      );
    }

    if (!data.result) {
      throw new Error("No result in RPC response");
    }

    return data.result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Broadcast failed: ${error.message}`);
    }
    throw new Error(`Broadcast failed: ${String(error)}`);
  }
}
