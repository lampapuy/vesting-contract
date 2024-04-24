import { AnchorProvider, BN, Program, Wallet, web3 } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  mintToChecked,
  transfer,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { Vesting } from "../target/types/vesting"; // this is the type file can be used along the IDL.

import fs from "fs";
import path from "path";
import { connection, vestingInterface, vestingProgramId } from "./constants";
// Create constant amount fields
const DECIMALS = 9;
const MINT_AMOUNT = new BN("1000000000").mul(new BN(Math.pow(10, DECIMALS)));
const STAKE_AMOUNT = new BN("850000000").mul(new BN(Math.pow(10, DECIMALS)));
const BASE_STAKE_AMOUNT = new BN("1000000000").mul(
  new BN(Math.pow(10, DECIMALS))
);
const PERCENT_100 = new BN(Math.pow(10, DECIMALS + 2));
const PERCENT_75 = new BN(75 * Math.pow(10, DECIMALS));
// const PERCENT_50 = new BN(5 * Math.pow(10, DECIMALS + 1));
const PERCENT_5 = new BN(5 * Math.pow(10, DECIMALS)); // new BN("5882352941.176471")
const PERCENT_25 = new BN(25 * Math.pow(10, DECIMALS));

const sleep = async (seconds) => {
  return new Promise((r) => setTimeout(r, seconds * 1000));
  // await new Promise((f) => setTimeout(f, 1000 * seconds));
};
async function main() {
  const walletKeyFile = Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        `${path.join(__dirname, "../../wallet-secure.json")}`
      ) as unknown as string
    )
  );
  const walletKey = Keypair.fromSecretKey(walletKeyFile);

  const feePayer = Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        `${path.join(__dirname, "../../wallet.json")}`
      ) as unknown as string
    )
  );
  const feePayerKey = Keypair.fromSecretKey(walletKeyFile);

  const mintKeyFile = Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        `${path.join(__dirname, "../../mint-secure.json")}`
      ) as unknown as string
    )
  );
  const mintKey = Keypair.fromSecretKey(mintKeyFile);

  const payer = walletKey;

  const wallet = new Wallet(walletKey);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const confirmTransaction = async (tx) => {
    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    });
  };

  const program = new Program(
    vestingInterface,
    vestingProgramId,
    provider
  ) as Program<Vesting>;
  const MONTHLY_TIMESTAMP = program.idl.constants[0].value;

  let [pdaGlobalAccount] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );
  let [pdaEscrow] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow")],
    program.programId
  );
  // let [recipientPda] = web3.PublicKey.findProgramAddressSync(
  //   [Buffer.from("recipient")],
  //   program.programId
  // );

  const multiSigWalletPub = new PublicKey(
    "Hs7pJMDGhhEXnbK9bAwTkfUJuHkBZgtL2J5AbdgPgyET"
  );
  // const multiSigWalletPub = new PublicKey(
  //   "3zuhYiyXpHon5PAcjYxHEESnYmgv6opKd9MZ2manTsGc"
  // );

  // try {
  //   await createMint(
  //     connection,
  //     payer,
  //     mintKey.publicKey,
  //     null,
  //     DECIMALS,
  //     mintKey,
  //     { commitment: "confirmed" },
  //     TOKEN_PROGRAM_ID
  //   );
  // } catch (error) {
  //   console.log("error create mint", error);
  // }
  // const theMint = await getMint(
  //   connection,
  //   mintKey.publicKey,
  //   "confirmed",
  //   TOKEN_PROGRAM_ID
  // );

  const multiSigAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mintKey.publicKey,
    multiSigWalletPub,
    true,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );

  // await mintTo(
  //   connection,
  //   payer,
  //   mintKey.publicKey,
  //   multiSigAta.address,
  //   mintKey,
  //   BigInt("10000000000000000"),
  //   [],
  //   { commitment: "confirmed" }
  // );
  console.log("initialzie program");
  console.log("globalsate pda ", pdaGlobalAccount.toBase58());
  console.log("escrow pda ", pdaEscrow.toBase58());
  console.log("recipient  ", multiSigAta.address.toBase58());
  const claim = async (vault, recipient: PublicKey) => {
    // Get stake PDA
    const [pdaStakeAccount] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), vault.publicKey.toBytes()],
      program.programId
    );
    // Test claim instruction
    let claim = await program.methods
      .claim()
      .accounts({
        globalState: pdaGlobalAccount,
        stream: pdaStakeAccount,
        escrowAccount: pdaEscrow,
        recipientAccount: recipient,
        authority: vault.publicKey,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        mint: mintKey.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([vault])
      .rpc({ commitment: "confirmed" });

    await confirmTransaction(claim);
  };

  const changeStream = async (streamParams) => {
    // Get stake PDA
    const [pdaStakeAccount] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );

    [pdaEscrow] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      program.programId
    );
    // Get user's token associated account
    console.log("get vaultATA");
    let vaultATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintKey.publicKey,
      payer.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    console.log("vaultATA", vaultATA.address.toBase58());
    console.log("about to stake");
    try {
      // Test stake instruction
      let stake = await program.methods
        .change(streamParams)
        .accounts({
          globalState: pdaGlobalAccount,
          stream: pdaStakeAccount,
          authority: payer.publicKey,
          systemProgram: web3.SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([payer])
        .transaction();
      // .rpc({ commitment: "confirmed" });

      const latestBlockHash = await provider.connection.getLatestBlockhash();
      stake.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
      stake.recentBlockhash = latestBlockHash.blockhash;

      const tx = new Transaction();
      const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 300000,
      });
      tx.add(priorityFeeInstruction);
      tx.add(stake);
      tx.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
      tx.recentBlockhash = latestBlockHash.blockhash;
      await sendAndConfirmTransaction(provider.connection, tx, [walletKey], {
        commitment: "confirmed",
        maxRetries: 15,
      });
    } catch (error) {
      console.log(error);
    }
  };
  const stake = async (streamParams) => {
    // Get stake PDA
    const [pdaStakeAccount] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );

    [pdaEscrow] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      program.programId
    );
    // Get user's token associated account
    console.log("get vaultATA");
    let vaultATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintKey.publicKey,
      payer.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    console.log("vaultATA", vaultATA.address.toBase58());
    // Mint tokens to user
    // await mintToChecked(
    //   provider.connection,
    //   payer,
    //   mintKey.publicKey,
    //   vaultATA.address,
    //   mintKey,
    //   MINT_AMOUNT,
    //   DECIMALS,
    //   [],
    //   { commitment: "confirmed" },
    //   TOKEN_PROGRAM_ID
    // );

    console.log("about to stake");
    try {
      // Test stake instruction
      let stake = await program.methods
        .stake(streamParams)
        .accounts({
          globalState: pdaGlobalAccount,
          stream: pdaStakeAccount,
          escrowAccount: pdaEscrow,
          userVault: vaultATA.address,
          authority: payer.publicKey,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          mint: mintKey.publicKey,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([payer])
        .transaction();
      // .rpc({ commitment: "confirmed" });

      const latestBlockHash = await provider.connection.getLatestBlockhash();
      stake.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
      stake.recentBlockhash = latestBlockHash.blockhash;

      const tx = new Transaction();
      const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 300000,
      });
      tx.add(priorityFeeInstruction);
      tx.add(stake);
      tx.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
      tx.recentBlockhash = latestBlockHash.blockhash;
      await sendAndConfirmTransaction(provider.connection, tx, [walletKey], {
        commitment: "confirmed",
        maxRetries: 15,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const init = async () => {
    try {
      // Test initialize instruction
      const latestBlockHash = await provider.connection.getLatestBlockhash();
      console.log(pdaGlobalAccount.toBase58());
      console.log(pdaEscrow.toBase58());
      let init = await program.methods
        .initialize()
        .accounts({
          globalState: pdaGlobalAccount,
          escrowAccount: pdaEscrow,
          mint: mintKey.publicKey,
          authority: walletKey.publicKey,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([walletKey])
        .transaction();
      // .rpc({ commitment: "confirmed", maxRetries: 10 });
      init.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
      init.recentBlockhash = latestBlockHash.blockhash;

      const tx = new Transaction();
      const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 300000,
      });
      tx.add(priorityFeeInstruction);
      tx.add(init);
      tx.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
      tx.recentBlockhash = latestBlockHash.blockhash;
      await sendAndConfirmTransaction(provider.connection, tx, [walletKey], {
        commitment: "confirmed",
        maxRetries: 15,
      });
      // await confirmTransaction(init);
    } catch (error) {
      console.log(error);
    }
  };

  const cancel = async (vault) => {
    // Get stake PDA
    const [pdaStakeAccount] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), vault.publicKey.toBytes()],
      program.programId
    );
    [pdaEscrow] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      program.programId
    );
    let vaultATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintKey.publicKey,
      vault.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );

    // Test cancel instruction
    let cancel = await program.methods
      .cancel()
      .accounts({
        globalState: pdaGlobalAccount,
        stream: pdaStakeAccount,
        escrowAccount: pdaEscrow,
        userVault: vaultATA.address,
        mint: mintKey.publicKey,
        authority: vault.publicKey,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([payer])
      .transaction();
    // .rpc({ commitment: "confirmed" });

    const latestBlockHash = await provider.connection.getLatestBlockhash();
    cancel.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
    cancel.recentBlockhash = latestBlockHash.blockhash;

    const tx = new Transaction();
    const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 300000,
    });
    tx.add(priorityFeeInstruction);
    tx.add(cancel);
    tx.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;
    tx.recentBlockhash = latestBlockHash.blockhash;
    await sendAndConfirmTransaction(provider.connection, tx, [walletKey], {
      commitment: "confirmed",
      maxRetries: 15,
    });
  };
  const createVesting = async () => {
    const [pdaStakeAccount] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );

    // const startVesting = new Date(2024, 4, 29).getTime() / 1000;
    const endVesting = new Date(2025, 9, 1).getTime() / 1000;
    const startVesting = new Date(1711756800000).getTime() / 1000; // 2024-03-30 30th of MARCH
    let streamParams = {
      startTime: new BN(startVesting),
      endTime: new BN(endVesting),
      stakedAmount: new BN(STAKE_AMOUNT),
      basedStake: new BN(BASE_STAKE_AMOUNT),
      cliff: new BN(1),
      cliffRate: PERCENT_5, // 5% tokens transfered during cliff
      releaseFrequency: 1,
      releaseRate: PERCENT_5, // 5% tokens transfered after cliff
      streamName: "LPP Vesting Stream",
      authority: payer.publicKey,
      decimals: new BN(DECIMALS),
    };
    await stake(streamParams);
    // Check remaining mint tokens after transaction
    let vaultAddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintKey.publicKey,
      payer.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    let tokenAccount = await getAccount(
      provider.connection,
      vaultAddress.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    console.log(
      Number(tokenAccount.amount),
      new BN(MINT_AMOUNT).sub(STAKE_AMOUNT)
    );

    // Check minted token transferred to escrow account after transaction
    let stakedAccount = await program.account.streamInstruction.fetch(
      pdaStakeAccount
    );
    let escrowAmount = await provider.connection.getTokenAccountBalance(
      pdaEscrow
    );
    console.log(
      escrowAmount.value.amount,
      stakedAccount.initialStakedAmount.toString()
    );
  };
  const changeStreamDetail = async () => {
    const [pdaStakeAccount] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );

    // const startVesting = new Date(2024, 4, 29).getTime() / 1000;
    const endVesting = new Date(2025, 9, 1).getTime() / 1000;
    const startVesting = new Date(1711756800000).getTime() / 1000; // 2024-03-30 30th of MARCH
    let streamParams = {
      startTime: new BN(startVesting),
      endTime: new BN(endVesting),
      stakedAmount: new BN(STAKE_AMOUNT),
      basedStake: new BN(BASE_STAKE_AMOUNT),
      cliff: new BN(1),
      cliffRate: PERCENT_5, // 5% tokens transfered during cliff
      releaseFrequency: 1,
      releaseRate: PERCENT_5, // 5% tokens transfered after cliff
      streamName: "LPP Vesting Stream",
      authority: payer.publicKey,
      decimals: new BN(DECIMALS),
    };
    await changeStream(streamParams);
  };
  const createClaim = async () => {
    await sleep(2 * Number(MONTHLY_TIMESTAMP));

    const [pdaStakeAccount] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );
    try {
      // Expect claim success
      await claim(payer, multiSigAta.address);
    } catch (error) {
      console.log(error);
    }

    // Check user's token balance
    let vaultAddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintKey.publicKey,
      payer.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    let tokenAccount = await getAccount(
      provider.connection,
      vaultAddress.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    console.log("mint stake amount stake check");

    tokenAccount = await getAccount(
      provider.connection,
      multiSigAta.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    // Claim second time, after 1 month
    await sleep(1 * Number(MONTHLY_TIMESTAMP));

    try {
      // Expect claim success
      await claim(payer, multiSigAta.address);
    } catch (error) {
      console.log(error);
    }

    tokenAccount = await getAccount(
      provider.connection,
      multiSigAta.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    // Now the user must have 75% of the token share (50% + 25%)
    console.log("share check 2", tokenAccount.amount.toString());

    // Claim second time, after 1 month
    await sleep(1 * Number(MONTHLY_TIMESTAMP));

    try {
      // Expect claim success
      await claim(payer, multiSigAta.address);
    } catch (error) {
      console.log(error);
    }

    tokenAccount = await getAccount(
      provider.connection,
      multiSigAta.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    // Now the user must have 100% of the token share (50% + 25% + 25%)
    console.log("share check 3", tokenAccount.amount.toString());
  };
  // await init();
  // await createVesting();
  // await changeStreamDetail();
  // await createClaim();
  // await cancel(payer);

  const [pdaStakeAccount] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("lock"), payer.publicKey.toBytes()],
    program.programId
  );

  const streamInstruction = await program.account.streamInstruction.fetch(
    pdaStakeAccount,
    "confirmed"
  );

  console.log("startTime", streamInstruction.startTime.toString());
  console.log("endTime", streamInstruction.endTime.toString());
  console.log("remainingAmount", streamInstruction.remainingAmount.toString());
  console.log(
    "initialStakedAmount",
    streamInstruction.initialStakedAmount.toString()
  );
  console.log("cliff", streamInstruction.cliff.toString());
  console.log("cliffRate", streamInstruction.cliffRate.toString());
  console.log(
    "releaseFrequency",
    streamInstruction.releaseFrequency.toString()
  );
  console.log("releaseRate", streamInstruction.releaseRate.toString());
  console.log("streamName", streamInstruction.streamName);
  console.log("nextPayAmount", streamInstruction.nextPayAmount.toString());
  console.log("nextPayAt", streamInstruction.nextPayAt.toString());
}
main().then(() => {
  console.log("done");
});
