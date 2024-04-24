import idl from "../target/idl/vesting.json";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

/* Constants for RPC Connection the Solana Blockchain */
export const commitmentLevel = "confirmed";
export const endpoint =
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
  "https://wider-alien-shadow.solana-mainnet.quiknode.pro/2791b2f04f16035d8a6d260466afe20d4cefde2a/";
export const connection = new Connection(endpoint, commitmentLevel);

/* Constants for the Deployed "Hello World" Program */
export const vestingProgramId = new PublicKey(idl.metadata.address);
export const vestingInterface = JSON.parse(JSON.stringify(idl));
