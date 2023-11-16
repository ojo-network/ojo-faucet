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
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const { API_PORT, FAUCET_MNEMONIC, RPC_URL, PREFIX, DENOM, AMOUNT_TO_SEND, GAS_PRICE, GAS_AMOUNT, COOLDOWN_SECONDS } = process.env;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
let cooldown_map = new Map();
function get_chain() {
    var rpc_url = RPC_URL || '';
    var prefix = PREFIX || '';
    var denom = DENOM || '';
    var amount_to_send = AMOUNT_TO_SEND || 0;
    var gas_price = GAS_PRICE || 0;
    var gas_amount = GAS_AMOUNT || 0;
    var cooldown_seconds = COOLDOWN_SECONDS || 0;
    let chain = {
        rpc_url: rpc_url,
        prefix: prefix,
        denom: denom,
        amount_to_send: Number(amount_to_send),
        gas_price: Number(gas_price),
        gas_amount: Number(gas_amount),
        cooldown_seconds: Number(cooldown_seconds)
    };
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
    });
});
app.get('/faucet', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let chain = get_chain();
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
app.get('/faucet/:address', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { address } = req.params;
    let chain = get_chain();
    // ensure address is valid and starts with prefix
    if (!address.startsWith(chain.prefix)) {
        res.status(400).json({
            error: 'Address is not valid'
        });
    }
    const map_key = `ojo-${address}`;
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
