## Overview 

This sample code illustrates how to compute the effective balance of a Bitcoin wallet. As explained in [a blog post](http://blog.barthe.ph/2014/04/03/bitcoin-balance-differs/), the balance of a public address as returned via online APIs such as [blockchain.info](https://blockchain.info), does not necessarily reflect the effective balance visible in the Bitcoin Core wallet. 

This code parses the `wallet.dat` file to extract all the keys from the key pools and uses the the public [blockchain.info](https://blockchain.info) to compute the balance of a wallet.

## Usage


1. Install [node.js](http://nodejs.org) and [NPM](https://npmjs.org).

2. Checkout code

        git clone https://github.com/aymericb/Sample-BitcoinWalletBalance Sample-BitcoinWalletBalance
        cd Sample-BitcoinWalletBalance

2. Install dependencies.

        npm install

6. Launch tool

        node wallet.js <path-to-wallet.dat>
