# BT-Token
solana program show  -u https://api.mainnet-beta.solana.com --buffers --keypair ./wallet.json  

solana program close -u https://api.mainnet-beta.solana.com --bypass-warning 4KVU1pRNR4pmborVpwChnqsJMfhdQhYTwNiF4apJXjJN

solana program deploy ./target/deploy/vesting.so -u https://api.mainnet-beta.solana.com  --with-compute-unit-price 10 

solana program extend <PROGRAM_ID> <MORE_BYTES>
