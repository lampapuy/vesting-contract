# Vesting Contract

The contract that allows to lock the SPL Tokens for specific period of time and send the locked tokens to the receipients wallet.

## Contract Addresses

- mainnet: `5SPRcNxqZUFE7KmpwgGNPugyHZ91B1F5GatNyR3Cdqas`
- devnet: `5SPRcNxqZUFE7KmpwgGNPugyHZ91B1F5GatNyR3Cdqas`

## Function paramters

### Function `initialize()`

This function is use to initialize the Vesting Contract

#### Steps:

1. Initialise vesting contract
2. Stake tokens
3. Claim tokens when the token lock period is over. After claim the token will be transferred to the recipient address mentioned in Claim Parameters.


#### Note: 

Vesting contract can be cancelled anytime by the admin account which has initialised it at the beginning and all the remaining tokens will be transferred from Smart Contract to the actual holder of the Tokens.

In this contract the duration in a month is considered as 30 days irrespective of the actual number of days in month. For instance if lock duration is 3 months then it will be 90 days from the date of TGE.

#### Accounts

```
    global_state: <PDA for store global state>
    escrow_account: <PDA for storing tokens>
    authority: <Admin's account>
    mint: <Mint Address of the spl-token>
    system_program: <Solana System program account>
    token_program: <Solana Token program account>
    rent: <Solana Rent key account>
```


### Function `stake()`

This function is use to lock the given spl-token and store other useful vesting information to the state of the contract.

#### Parameters as JSON

```
{
    "start_time": "<timestamp in 64 bit signed integer>",
    "end_time": "<timestamp in 64 bit signed integer>",
    "staked_amount": "<amount to be staked in 64 bit unsigned integer>",
    "cliff": "<initial token release months after TGE in 32 bit unsigned integer>",
    "cliff_rate": "<percentage of token release at the beginning in 64 bit unsigned integer>",
    "release_rate": "<months after which tokens are release in 32 bit unsigned integer>",
    "stream_name": "<stream name in string>",
    "decimals": "<decimals allowed for token transactions in 32 bit unsigned integer>",
}
```

#### Accounts

```
    global_state: <PDA for storing global state>
    stream: <PDA for storing stream>
    escrow_account: <PDA for storing tokens>
    user_vault: <User's account>
    authority: <User's account as Signer>
    system_program: <Solana System program account>
    token_program: <Solana Token program account>
    rent: <Solana Rent key account>
```


### Function `claim()`

This function is use to unlock the staked spl-tokens and transfer to the recipient's wallet.

#### Accounts

```
    global_state: <PDA for storing global state>
    stream: <PDA for storing stream>
    escrow_account: <PDA for storing tokens>
    recipient: <Recipient's account>
    authority: <User's account as Signer>
    system_program: <Solana System program account>
    token_program: <Solana Token program account>
    rent: <Solana Rent key account>
```


### Function `cancel()`

This function is use to cancel the ongoing vesting schedule by the user's account who locked the tokens. All the remaining tokens will be transferred from Smart Contract to the actual holder of the Tokens.

#### Accounts

```
    global_state: <PDA for storing global state>
    stream: <PDA for storing stream>
    escrow_account: <PDA for storing tokens>
    user_vault: <User's account>
    authority: <User's account as Signer>
    system_program: <Solana System program account>
    token_program: <Solana Token program account>
    rent: <Solana Rent key account>
```
