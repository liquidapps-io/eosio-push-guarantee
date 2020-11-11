/*

import { PushGuarantee } from "../src/index.js";
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
const fetch = require('node-fetch');                                    // node only; not needed in browsers
const { TextEncoder, TextDecoder } = require('util');                   // node only; native TextEncoder/Decoder
const defaultPrivateKey = "5JMUyaQ4qw6Zt816B1kWJjgRA5cdEE6PhCb2BW45rU8GBEDa1RC"; // bob
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);
const rpc = new JsonRpc('https://kylin-dsp-2.liquidapps.io', { fetch });
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

(async () => {
    const push_guarantee_api = new PushGuarantee(api, { 
        // push_guarantee: 'in-block', 
        push_guarantee: 'irreversible', 
        // push_guarantee: 'none', 
        readRetries: 300 
    });
    const account = 'dappservices';
    const actor = 'vacctstst123';
    const action = 'transfer';
    const result = await push_guarantee_api.transact({
        actions: [{
            account,
            name: action,
            authorization: [{
                actor,
                permission: 'active',
            }],
            data: {
                from: 'vacctstst123',
                to: 'natdeveloper',
                quantity: '1.0000 DAPP',
                memo: ''
            },
        }]
    }, {
        blocksBehind: 3,
        // expireSeconds: 30, // in-block
        expireSeconds: 300, // irreversible
        useLastIrreversible: true // irreversible
    });
    console.dir(result);
})().catch((e) => { console.log(e); });

*/