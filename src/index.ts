import { CosmWasmClient, SigningCosmWasmClient, GasPrice, coin, calculateFee } from "cosmwasm";

// import stargate client from stargate
import { SigningStargateClient } from "@cosmjs/stargate";

import { getAccountFromMnemonic } from "./helpers"

import express from 'express';
import cors from 'cors';

import fs from 'fs';

import { config } from 'dotenv';
import { get } from "http";
config();
const { API_PORT, FAUCET_MNEMONIC, RPC_URL, PREFIX, DENOM, AMOUNT_TO_SEND, GAS_PRICE, GAS_AMOUNT, COOLDOWN_SECONDS } = process.env;


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


let cooldown_map = new Map();

interface ChainInfo {
    rpc_url: string;
    prefix: string;
    denom: string;
    amount_to_send: number;
    gas_price: number;
    gas_amount: number;
    cooldown_seconds: number;
    error?: string;
}

function get_chain() {
    var rpc_url = RPC_URL || '';
    var prefix = PREFIX || '';
    var denom = DENOM || '';
    var amount_to_send = AMOUNT_TO_SEND || 0;
    var gas_price = GAS_PRICE || 0;
    var gas_amount = GAS_AMOUNT || 0;
    var cooldown_seconds = COOLDOWN_SECONDS || 0;

    let chain: ChainInfo = {
        rpc_url: rpc_url,
        prefix: prefix,
        denom: denom,
        amount_to_send: Number(amount_to_send),
        gas_price: Number(gas_price),
        gas_amount: Number(gas_amount),
        cooldown_seconds: Number(cooldown_seconds)
    }

    return chain;
}


// === endpoints ===

app.get('/', (req, res) => {
    const base_url = req.protocol + '://' + req.get('host') + req.originalUrl;
    const chains = get_chain();
    res.json({
        endpoints: [
            `Get Faucet Info: ${base_url}faucet`,
            `Requests Funds (~6 second wait): ${base_url}faucet/<address>`
        ],
        chains: chains,
    })
})


app.get('/faucet', async (req, res) => {
    let chain = get_chain();

    try {
        const payment_account = await getAccountFromMnemonic(FAUCET_MNEMONIC, chain.prefix);

        const client = await CosmWasmClient.connect(chain.rpc_url);
        const balance = await client.getBalance(payment_account.account.address, chain.denom);


        res.json({
            faucet_addr: payment_account.account.address,
            faucet_balance: balance
        })
    } catch (error: any) {
        res.status(400).json({
            error: error.message
        })
    }

})


app.get('/faucet/:address', async (req, res) => {
    const { address } = req.params;


    let chain = get_chain();

    // ensure address is valid and starts with prefix
    if (!address.startsWith(chain.prefix)) {
        res.status(400).json({
            error: 'Address is not valid'
        })
    }

    const map_key = `ojo-${address}`;
    if (cooldown_map.has(map_key)) {
        let cooldown = cooldown_map.get(map_key);
        let seconds_until_then = (cooldown - Date.now()) / 1000;
        if (cooldown > Date.now()) {
            res.status(400).json({
                error: `Address is in cooldown for ${seconds_until_then} seconds`
            })
            return;
        }
    }

    const payment_account = await getAccountFromMnemonic(FAUCET_MNEMONIC, chain.prefix);
    if (address === payment_account.account.address) {
        res.status(400).json({
            error: 'Address is the same as the faucet address'
        })
        return;
    }

    const config = {
        rpcEndpoint: chain.rpc_url,
        prefix: chain.prefix,
    }
    const fee = calculateFee(chain.gas_amount, GasPrice.fromString(`${chain.gas_price}${chain.denom}`));

    try {
        const client = await SigningStargateClient.connectWithSigner(config.rpcEndpoint, payment_account.wallet);
        const amt = coin(chain.amount_to_send, chain.denom);

        let result = await client.sendTokens(payment_account.account.address, address, [amt], fee);
        if (result.code === 0) {
            cooldown_map.set(map_key, Date.now() + chain.cooldown_seconds * 1000);
        }

        res.json({
            message: `Payment of amount: ${amt.amount} ${amt.denom}`,
            faucet_account: payment_account.account.address,
            result: result
        })

    } catch (error: any) {
        console.log(error.message)
        res.json({
            error: error.message
        })
    }
})


app.listen(API_PORT, () => {
    if(!API_PORT) {
        console.error('API_PORT is not defined. Follow README.md instructions to set up .env file.');
        process.exit(1);
    }

    console.log(`Server is running on port ${API_PORT}`);
})
