import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  mintToChecked,
  getAccount,
  getMint,
  Mint,
  getMintLen,
  createInitializeMintInstruction,
  Account,
  getDefaultAccountState,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  SYSVAR_RENT_PUBKEY,
  PublicKey,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

import { Vesting } from "../target/types/vesting";
import { connection } from "../scripts/constants";
import fs from "fs";
import path from "path";
const sleep = async (seconds) => {
  return new Promise((r) => setTimeout(r, seconds * 1000));
  // await new Promise((f) => setTimeout(f, 1000 * seconds));
};
describe("vesting", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vesting as Program<Vesting>;
  console.log("program id", program.programId.toBase58());
  // Create test keypairs
  const admin = anchor.web3.Keypair.generate();
  const payAccFile = Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        `${path.join(__dirname, "../wallet.json")}`
      ) as unknown as string
    )
  );
  const payer = Keypair.fromSecretKey(payAccFile);

  const user1AccFile = Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        `${path.join(__dirname, "../user1.json")}`
      ) as unknown as string
    )
  );
  const user1 = Keypair.fromSecretKey(user1AccFile);

  const vault = payer; // anchor.web3.Keypair.generate();
  // const user1 = payer; // anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();
  const multiSigWallet = new PublicKey(
    "Hs7pJMDGhhEXnbK9bAwTkfUJuHkBZgtL2J5AbdgPgyET"
  );
  // Create constant amount fields
  const DECIMALS = 9;
  const MINT_AMOUNT = 20 * Math.pow(10, DECIMALS);
  const STAKE_AMOUNT = 15 * Math.pow(10, DECIMALS);
  const PERCENT_100 = new BN(Math.pow(10, DECIMALS + 2));
  const PERCENT_75 = new BN(75 * Math.pow(10, DECIMALS));
  const PERCENT_50 = new BN(5 * Math.pow(10, DECIMALS + 1));
  const PERCENT_25 = new BN(25 * Math.pow(10, DECIMALS));
  const MONTHLY_TIMESTAMP = 1; // 1 second! program.idl.constants[0].value;

  // Declare PDAs
  let pdaGlobalAccount,
    pdaEscrow: PublicKey = new PublicKey(0);

  // [recipientPda] = anchor.web3.PublicKey.findProgramAddressSync(
  //   [Buffer.from("recipient")],
  //   program.programId
  // );

  // Declare nft mints
  // let mintAccount = Keypair.generate();

  const mintAccountFile = Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        `${path.join(__dirname, "../mint.json")}`
      ) as unknown as string
    )
  );
  const mintAccount = Keypair.fromSecretKey(mintAccountFile);

  function calcShare(amount: number, percentage: anchor.BN) {
    return new anchor.BN(amount).mul(percentage).div(PERCENT_100);
  }

  const confirmTransaction = async (tx) => {
    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    });
  };

  const stake = async (streamParams) => {
    // Get stake PDA
    const [pdaStakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );

    [pdaEscrow] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      program.programId
    );
    // Get user's token associated account
    let vaultATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount.publicKey,
      payer.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    console.log("vaultATA", vaultATA.address.toBase58());
    // Mint tokens to user
    await mintToChecked(
      provider.connection,
      payer,
      mintAccount.publicKey,
      vaultATA.address,
      mintAuthority,
      MINT_AMOUNT,
      DECIMALS,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );

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
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          mint: mintAccount.publicKey,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([payer])
        .rpc({ commitment: "confirmed" });

      await confirmTransaction(stake);
    } catch (error) {
      console.log(error);
      throw error;
    }
  };

  const claim = async (vault, recipient: Keypair) => {
    // Get stake PDA
    const [pdaStakeAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), vault.publicKey.toBytes()],
      program.programId
    );
    // Test claim instruction
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount.publicKey,
      recipient.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    let claim = await program.methods
      .claim()
      .accounts({
        globalState: pdaGlobalAccount,
        stream: pdaStakeAccount,
        escrowAccount: pdaEscrow,
        recipientAccount: recipientAta.address,
        authority: vault.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        mint: mintAccount.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([vault])
      .rpc({ commitment: "confirmed" });

    await confirmTransaction(claim);
  };

  const cancel = async (vault) => {
    // Get stake PDA
    const [pdaStakeAccount] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lock"), vault.publicKey.toBytes()],
        program.programId
      );
    [pdaEscrow] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      program.programId
    );
    let vaultATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount.publicKey,
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
        mint: mintAccount.publicKey,
        authority: vault.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([vault])
      .rpc();

    await confirmTransaction(cancel);
  };

  const createTheMint = async () => {
    const extensions = [];
    const mintLen = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(
      mintLen
    );
    try {
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mintAccount.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintAccount.publicKey,
          DECIMALS,
          mintAuthority.publicKey,
          payer.publicKey,
          TOKEN_PROGRAM_ID
        )
      );
      await sendAndConfirmTransaction(
        provider.connection,
        transaction,
        [payer, mintAccount],
        { commitment: "confirmed" }
      );
      return mintAccount;
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  };

  it("Initialize test accounts", async () => {
    // Airdrop sol to the test users
    let adminSol = await provider.connection.requestAirdrop(
      admin.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await confirmTransaction(adminSol);

    let payerSol = await provider.connection.requestAirdrop(
      payer.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await confirmTransaction(payerSol);

    let vaultSol = await provider.connection.requestAirdrop(
      vault.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await confirmTransaction(vaultSol);

    let user1Sol = await provider.connection.requestAirdrop(
      user1.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await confirmTransaction(user1Sol);

    let user2Sol = await provider.connection.requestAirdrop(
      user2.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await confirmTransaction(user2Sol);

    let mintAuthoritySol = await provider.connection.requestAirdrop(
      mintAuthority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await confirmTransaction(mintAuthoritySol);

    // let mintAccountSol = await provider.connection.requestAirdrop(
    //   mintAccount.publicKey,
    //   anchor.web3.LAMPORTS_PER_SOL
    // );
    // await confirmTransaction(mintAccountSol);

    console.log("create mint");
    // Create mint token with decimals
    await createTheMint();
  });

  it("Initialize global account", async () => {
    [pdaGlobalAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global")],
      program.programId
    );
    [pdaEscrow] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      program.programId
    );
    // try {
    //   [recipientPda] = anchor.web3.PublicKey.findProgramAddressSync(
    //     [Buffer.from("recipient")],
    //     program.programId
    //   );
    // } catch (error) {
    //   console.log(error);
    // }

    console.log("initialzie program");
    const theMint = await getMint(
      provider.connection,
      mintAccount.publicKey,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    try {
      // Test initialize instruction
      let init = await program.methods
        .initialize()
        .accounts({
          globalState: pdaGlobalAccount,
          escrowAccount: pdaEscrow,
          mint: mintAccount.publicKey,
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([admin])
        .rpc();

      await confirmTransaction(init);
      console.log("set recipient");
      // Test claim instruction
      const recipientAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mintAccount.publicKey,
        user1.publicKey,
        false,
        "confirmed",
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID
      );
    } catch (error) {
      console.log(error);
      throw error;
    }
  });

  it("Test stake", async () => {
    const [pdaStakeAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );

    const now = Date.now() / 1000;
    let streamParams = {
      startTime: new BN(now - 5),
      endTime: new BN(now + 6),
      stakedAmount: new BN(STAKE_AMOUNT),
      cliff: new BN(1),
      cliffRate: PERCENT_50, // 50% tokens transfered during cliff
      releaseFrequency: 1,
      releaseRate: PERCENT_25, // 25% tokens transfered after cliff
      streamName: "Testing",
      authority: payer.publicKey,
      decimals: new BN(DECIMALS),
    };
    await stake(streamParams);
    // Check remaining mint tokens after transaction
    let vaultAddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount.publicKey,
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
    assert.equal(Number(tokenAccount.amount), MINT_AMOUNT - STAKE_AMOUNT);

    // Check minted token transferred to escrow account after transaction
    let stakedAccount = await program.account.streamInstruction.fetch(
      pdaStakeAccount
    );
    let escrowAmount = await provider.connection.getTokenAccountBalance(
      pdaEscrow
    );
    console.log("escrow balance", escrowAmount.value.amount.toString());
    assert.equal(
      escrowAmount.value.amount,
      stakedAccount.initialStakedAmount.toString()
    );
  });

  it("Claim during lockup period", async () => {
    // Test claim user with lockup period
    try {
      await claim(vault, user1);
    } catch (e) {
      let errorMsg = e.error.errorMessage;
      assert.equal(errorMsg, "Error: You need to wait at least lockup period.");
    }
  });

  it("Claim after lockup Period", async () => {
    // Sleep for 2 months so that the lockup period will over TODO for test its 2 second
    // await sleep(2 * Number(MONTHLY_TIMESTAMP));

    const [pdaStakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), payer.publicKey.toBytes()],
      program.programId
    );
    try {
      // Expect claim success
      await claim(vault, user1);
    } catch (error) {
      console.log(error);
    }

    // Check user's token balance
    let vaultAddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount.publicKey,
      vault.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );

    let user1Ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount.publicKey,
      user1.publicKey,
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
    assert.equal(MINT_AMOUNT - STAKE_AMOUNT, Number(tokenAccount.amount));
    console.log("mint stake amount stake check");

    console.log("tokenAccount 50%", tokenAccount.amount.toString());
    tokenAccount = await getAccount(
      provider.connection,
      user1Ata.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    console.log("user1Ata 50%", tokenAccount.amount.toString());
    assert.equal(
      calcShare(STAKE_AMOUNT, PERCENT_50).toString(),
      new anchor.BN(tokenAccount.amount.toString()).toString()
    );

    // Claim second time, after 1 month
    await sleep(1 * Number(MONTHLY_TIMESTAMP));

    try {
      // Expect claim success
      await claim(vault, user1);
    } catch (error) {
      console.log(error);
    }

    tokenAccount = await getAccount(
      provider.connection,
      user1Ata.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    // Now the user must have 75% of the token share (50% + 25%)
    console.log("share check 2", tokenAccount.amount.toString());
    assert.equal(
      calcShare(STAKE_AMOUNT, PERCENT_75).toString(),
      new anchor.BN(tokenAccount.amount.toString()).toString()
    );

    // Claim second time, after 1 month
    await sleep(1 * Number(MONTHLY_TIMESTAMP));

    try {
      // Expect claim success
      await claim(vault, user1);
    } catch (error) {
      console.log(error);
    }

    tokenAccount = await getAccount(
      provider.connection,
      user1Ata.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    // Now the user must have 100% of the token share (50% + 25% + 25%)
    console.log("share check 3", tokenAccount.amount.toString());
    assert.equal(
      calcShare(STAKE_AMOUNT, PERCENT_100).toString(),
      new anchor.BN(tokenAccount.amount.toString()).toString()
    );
  });

  it("Cancel Vesting Schedule by acounts other than vault account", async () => {
    // Cancel Vesting Schedule by admin account
    try {
      await cancel(admin);
    } catch (e) {
      let errorCode = e.error.errorCode.code;
      assert.equal(errorCode, "AccountNotInitialized");
    }
    // Cancel Vesting Schedule by payer account
    try {
      await cancel(payer);
    } catch (e) {
      let errorCode = e.error.errorCode.code;
      assert.equal(errorCode, "AccountNotInitialized");
    }
  });

  it("Cancel Vesting Schedule", async () => {
    // Cancel Vesting Schedule
    await cancel(vault);

    // Check vault's token balance
    let vaultATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount.publicKey,
      vault.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    let tokenAccount = await getAccount(
      provider.connection,
      vaultATA.address,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    assert.equal(MINT_AMOUNT - STAKE_AMOUNT, Number(tokenAccount.amount));
  });

  it("Claim after cancellation of Vesting Contract", async () => {
    try {
      await claim(vault, user1);
      assert.equal(true, false,"shoud have failed to claim after cancellation");
    } catch (e) {
      let errorMsg = e.error.errorMessage;
      assert.equal(errorMsg, "Error: Your balance is not enough.");
    }
  });
});
