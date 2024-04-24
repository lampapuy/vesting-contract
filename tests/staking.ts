import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  createMint,
  mintToChecked,
  getAccount,
  transferChecked,
} from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

import { Staking } from "../target/types/staking";
const sleep = async (seconds) => {
  await new Promise((f) => setTimeout(f, 1000 * seconds));
};

describe("staking", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Staking as Program<Staking>;

  // Create test keypairs
  const admin = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();
  const vault = anchor.web3.Keypair.generate();
  const rewardWallet = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();

  // Create constant amount fields
  const DECIMALS = 3;
  const MINT_AMOUNT = 30 * Math.pow(10, DECIMALS);
  const STAKE_AMOUNT = 15 * Math.pow(10, DECIMALS);
  const TRANSFER_AMOUNT = 10 * Math.pow(10, DECIMALS);
  const REMAINING_AMOUNT = MINT_AMOUNT - TRANSFER_AMOUNT;
  const PERCENT_100 = new BN(Math.pow(10, DECIMALS + 2));
  const PERCENT_75 = new BN(75 * Math.pow(10, DECIMALS));
  const PERCENT_50 = new BN(5 * Math.pow(10, DECIMALS + 1));
  const PERCENT_25 = new BN(25 * Math.pow(10, DECIMALS));

  // Declare PDAs
  let pdaGlobalAccount,
    pdaEscrow = null;

  // Declare nft mints
  let mintAccount = null;

  // function calcShare(amount, percentage) {
  //   return (amount * percentage) / PERCENT_100;
  // }

  const confirmTransaction = async (tx) => {
    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    });
  };

  const stake = async (staked_amount) => {
    // Get stake PDA
    const [pdaStakeAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), vault.publicKey.toBytes()],
      program.programId
    );

    // Get vaultATA address
    let vaultAddress = await getAssociatedTokenAddress(
      mintAccount,
      vault.publicKey
    );

    // Test stake instruction
    let stake = await program.methods
      .stake(staked_amount)
      .accounts({
        globalState: pdaGlobalAccount,
        stakeState: pdaStakeAccount,
        escrowAccount: pdaEscrow,
        userVault: vaultAddress,
        vaultAuthority: vault.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([vault])
      .rpc();

    await confirmTransaction(stake);
  };

  const unstake = async (withdrawalAmount) => {
    // Get stake PDA
    const [pdaStakeAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), vault.publicKey.toBytes()],
      program.programId
    );

    // Get vault wallet ATA address
    let vaultAddress = await getAssociatedTokenAddress(
      mintAccount,
      vault.publicKey
    );

    // Get reward wallet ATA address
    let rewardWalletAddress = await getAssociatedTokenAddress(
      mintAccount,
      rewardWallet.publicKey
    );

    // Test unstake instruction
    let unstake = await program.methods
      .unstake(withdrawalAmount)
      .accounts({
        globalState: pdaGlobalAccount,
        stakeState: pdaStakeAccount,
        escrowAccount: pdaEscrow,
        userVault: vaultAddress,
        rewardAccount: rewardWalletAddress,
        vaultAuthority: vault.publicKey,
        rewardAuthority: rewardWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([vault, rewardWallet])
      .rpc();

    await confirmTransaction(unstake);
  };

  const mintAndTransfer = async () => {
    // Get user's token associated account
    let vaultATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount,
      vault.publicKey
    );

    // Mint tokens to user
    await mintToChecked(
      provider.connection,
      payer,
      mintAccount,
      vaultATA.address,
      mintAuthority,
      MINT_AMOUNT,
      DECIMALS
    );

    // Get reward wallet's token associated account
    let rewardWalletATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintAccount,
      rewardWallet.publicKey
    );

    // Transfer tokens from vault to rewards wallet
    await transferChecked(
      provider.connection,
      payer,
      vaultATA.address,
      mintAccount,
      rewardWalletATA.address,
      vault,
      TRANSFER_AMOUNT,
      DECIMALS
    );
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

    let rewadWalletSol = await provider.connection.requestAirdrop(
      rewardWallet.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await confirmTransaction(rewadWalletSol);

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

    // Create mint token with decimals
    mintAccount = await createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      DECIMALS
    );
  });

  it("Initialize global account", async () => {
    [pdaGlobalAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("global")],
      program.programId
    );
    [pdaEscrow] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow")],
      program.programId
    );

    // Test initialize instruction
    let init = await program.methods
      .initialize()
      .accounts({
        globalState: pdaGlobalAccount,
        escrowAccount: pdaEscrow,
        mint: mintAccount,
        authority: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();

    await confirmTransaction(init);
  });

  it("Test stake", async () => {
    const [pdaStakeAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), vault.publicKey.toBytes()],
      program.programId
    );

    // Mint and Transfer tokens
    await mintAndTransfer();

    await stake(new BN(STAKE_AMOUNT));

    // Check remaining mint tokens after transaction
    let vaultAddress = await getAssociatedTokenAddress(
      mintAccount,
      vault.publicKey
    );
    let tokenAccount = await getAccount(provider.connection, vaultAddress);
    assert.equal(Number(tokenAccount.amount), REMAINING_AMOUNT - STAKE_AMOUNT);

    // Check minted token transferred to escrow account after transaction
    let stakedAccount = await program.account.stakeState.fetch(pdaStakeAccount);
    let escrowAmount = await provider.connection.getTokenAccountBalance(
      pdaEscrow
    );
    assert.equal(
      escrowAmount.value.amount,
      stakedAccount.stakedAmount.toString()
    );

    // Check reward wallet tokens after transaction
    let rewardWalletAddress = await getAssociatedTokenAddress(
      mintAccount,
      rewardWallet.publicKey
    );
    tokenAccount = await getAccount(provider.connection, rewardWalletAddress);
    assert.equal(Number(tokenAccount.amount), TRANSFER_AMOUNT);

    // Check total_staked amount
    let globalAccount = await program.account.globalState.fetch(
      pdaGlobalAccount
    );
    assert.equal(Number(globalAccount.totalStakedAmount), STAKE_AMOUNT);
  });

  it("Unstake all tokens", async () => {
    let withdrawalAmount = new BN(STAKE_AMOUNT);

    // Expect claim success
    await unstake(withdrawalAmount);

    // Check user's token balance
    let vaultAddress = await getAssociatedTokenAddress(
      mintAccount,
      vault.publicKey
    );
    let tokenAccount = await getAccount(provider.connection, vaultAddress);
    assert.equal(Number(tokenAccount.amount), REMAINING_AMOUNT);

    // Check total_stake_amount, it must be zero after complete payout
    let globalAccount = await program.account.globalState.fetch(
      pdaGlobalAccount
    );
    assert.equal(Number(globalAccount.totalStakedAmount), 0);

    // Check stake amount and rewards
    const [pdaStakeAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("lock"), vault.publicKey.toBytes()],
      program.programId
    );
    let stakeAccount = await program.account.stakeState.fetch(pdaStakeAccount);
    assert.equal(Number(stakeAccount.stakedAmount), 0);
    assert.equal(Number(stakeAccount.rewards), 0);
  });
});
