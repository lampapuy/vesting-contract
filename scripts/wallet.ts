import { Keypair } from "@solana/web3.js";
import base58 from "bs58";
import bs58 from "bs58";
import fs from "fs";
import path from "path";
const walletKeyFile = Uint8Array.from(
  JSON.parse(
    fs.readFileSync(
      `${path.join(__dirname, "../../program.json")}`
    ) as unknown as string
  )
);
const walletKey = Keypair.fromSecretKey(walletKeyFile);

const key = base58.encode(walletKey.secretKey);
console.log(key);

const web3 = require("@solana/web3.js");
(async () => {
  const solana = new web3.Connection(
    "https://docs-demo.solana-mainnet.quiknode.pro/"
  );
  console.log(await solana.getRecentPrioritizationFees());
})();
