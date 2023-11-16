"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cosmwasm_1 = require("cosmwasm");
// import stargate client from stargate
const stargate_1 = require("@cosmjs/stargate");
const helpers_1 = require("./helpers");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const { API_PORT, FAUCET_MNEMONIC } = process.env;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
let cooldown_map = new Map();
function get_chain(chain_id) {
    if (chain_id === undefined) {
        return {
            error: 'Chain not found'
        };
    }
    let chains = JSON.parse(fs_1.default.readFileSync('chains.json', 'utf8'));
    let chain_keys = Object.keys(chains);
    let chain = chains[chain_id];
    if (chain === undefined) {
        return {
            error: 'Chain not found',
            chains: chain_keys
        };
    }
    return chain;
}
// === endpoints ===
app.get('/', (req, res) => {
    const base_url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.json({
        endpoints: [
            `Get Faucet Info: ${base_url}<chain_id>`,
            `Requests Funds (~6 second wait): ${base_url}<chain_id>/<address>`
        ],
        chains: Object.keys(JSON.parse(fs_1.default.readFileSync('chains.json', 'utf8')))
    });
});
app.get('/:chain_id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { chain_id } = req.params;
    let chain = get_chain(chain_id);
    if (!chain || chain.error) {
        res.status(400).json(chain);
        return;
    }
    chain = chain;
    try {
        const payment_account = yield (0, helpers_1.getAccountFromMnemonic)(FAUCET_MNEMONIC, chain.prefix);
        const client = yield cosmwasm_1.CosmWasmClient.connect(chain.rpc_url);
        const balance = yield client.getBalance(payment_account.account.address, chain.denom);
        res.json({
            faucet_addr: payment_account.account.address,
            faucet_balance: balance
        });
    }
    catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
}));
app.get('/:chain_id/:address', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { chain_id, address } = req.params;
    // ensure address is only alphanumeric
    // if (!address.match(/^[a-zA-Z0-9]+$/)) {
    //     res.status(400).json({
    //         error: 'Address is not valid'
    //     })
    //     return;
    // }
    let chain = get_chain(chain_id);
    if (!chain || chain.error) {
        res.status(400).json(chain);
        return;
    }
    chain = chain;
    // ensure address is valid and starts with prefix
    if (!address.startsWith(chain.prefix)) {
        res.status(400).json({
            error: 'Address is not valid'
        });
    }
    const map_key = `${chain_id}-${address}`;
    if (cooldown_map.has(map_key)) {
        let cooldown = cooldown_map.get(map_key);
        let seconds_until_then = (cooldown - Date.now()) / 1000;
        if (cooldown > Date.now()) {
            res.status(400).json({
                error: `Address is in cooldown for ${seconds_until_then} seconds`
            });
            return;
        }
    }
    const payment_account = yield (0, helpers_1.getAccountFromMnemonic)(FAUCET_MNEMONIC, chain.prefix);
    if (address === payment_account.account.address) {
        res.status(400).json({
            error: 'Address is the same as the faucet address'
        });
        return;
    }
    const config = {
        chainId: chain_id,
        rpcEndpoint: chain.rpc_url,
        prefix: chain.prefix,
    };
    const fee = (0, cosmwasm_1.calculateFee)(chain.gas_amount, cosmwasm_1.GasPrice.fromString(`${chain.gas_price}${chain.denom}`));
    try {
        const client = yield stargate_1.SigningStargateClient.connectWithSigner(config.rpcEndpoint, payment_account.wallet);
        const amt = (0, cosmwasm_1.coin)(chain.amount_to_send, chain.denom);
        let result = yield client.sendTokens(payment_account.account.address, address, [amt], fee);
        if (result.code === 0) {
            cooldown_map.set(map_key, Date.now() + chain.cooldown_seconds * 1000);
        }
        res.json({
            message: `Payment of amount: ${amt.amount} ${amt.denom}`,
            faucet_account: payment_account.account.address,
            result: result
        });
    }
    catch (error) {
        console.log(error.message);
        res.json({
            error: error.message
        });
    }
}));
app.listen(API_PORT, () => {
    if (!API_PORT) {
        console.error('API_PORT is not defined. Follow README.md instructions to set up .env file.');
        process.exit(1);
    }
    console.log(`Server is running on port ${API_PORT}`);
});
