import idl from "../target/idl/vesting.json";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

/* Constants for RPC Connection the Solana Blockchain */
export const commitmentLevel = "confirmed";
export const endpoint =
  process.env.RPC_URL ||
  "https://api.mainnet-beta.solana.com";
export const connection = new Connection(endpoint, commitmentLevel);

/* Constants for the Deployed "Hello World" Program */
export const vestingProgramId = new PublicKey(idl.metadata.address);
export const vestingInterface = JSON.parse(JSON.stringify(idl));
