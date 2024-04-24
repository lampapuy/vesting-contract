use super::{GlobalState, ESCROW_TAG, GLOBAL_STATE_TAG, RECIPIENT_TAG};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
/// Function to initialize the Vesting Contract.
pub fn process_initialize(ctx: Context<Initialize>) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state.load_init()?;
    global_state.save(ctx.accounts.mint.key());
    Ok(())
}

#[derive(Accounts)]
#[instruction()]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [GLOBAL_STATE_TAG],
        bump,
        payer = authority,
        space = std::mem::size_of::<GlobalState>() + 8
    )]
    pub global_state: AccountLoader<'info, GlobalState>,
    #[account(
        init,
        token::mint = mint,
        token::authority = escrow_account,
        seeds = [ESCROW_TAG],
        bump,
        payer = authority,
    )]
    pub escrow_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
