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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomAccount = exports.getAccountFromMnemonic = void 0;
const cosmwasm_1 = require("cosmwasm");
const getAccountFromMnemonic = (mnemonic, prefix = "cosmos") => __awaiter(void 0, void 0, void 0, function* () {
    let wallet = yield cosmwasm_1.Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix: prefix });
    const [account] = yield wallet.getAccounts();
    return {
        wallet: wallet,
        account: account,
    };
});
exports.getAccountFromMnemonic = getAccountFromMnemonic;
const getRandomAccount = (prefix = "cosmos") => __awaiter(void 0, void 0, void 0, function* () {
    let wallet = yield cosmwasm_1.Secp256k1HdWallet.generate(12, { prefix: prefix });
    const [account] = yield wallet.getAccounts();
    return {
        wallet: wallet,
        account: account
    };
});
exports.getRandomAccount = getRandomAccount;
