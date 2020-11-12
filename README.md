EOSIO Push Guarantee Library
=====================

Thank you to the dfuse team for the inspiration on this standard.

To setup the library, first install dependencies:

```bash
npm install --save-dev eosio-push-guarantee node-fetch eosjs
```

Setup guarantee

```javascript
const { PushGuarantee } = require("eosio-push-guarantee");
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
const fetch = require('node-fetch');                                    // node only; not needed in browsers
const { TextEncoder, TextDecoder } = require('util');                   // node only; native TextEncoder/Decoder
const defaultPrivateKey = "5JMUyaQ4qw6Zt816B1kWJjgRA5cdEE6PhCb2BW45rU8GBEDa1RC"; // bob
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);
const rpc = new JsonRpc('https://kylin-dsp-2.liquidapps.io', { fetch });
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

(async () => {
    const config = {
        // pushGuarantee: 'none', // push guarantee level for trx
        // readRetries: 0, // amount of times to try and verify trx before retrying trx
        // pushRetries: 3, // amount of times to retry trx before failing
        // backoff: 500, // time in ms between readRetries
        // backoffExponent: 1.1 // multiplier backoff time for backoff (if 500ms and 1.1 multiplier then 550ms backoff next time, etc)

        pushGuarantee: 'in-block', 
        readRetries: 3,

        // pushGuarantee: 'handoffs:1', 
        // readRetries: 10,

        // pushGuarantee: 'handoffs:2', 
        // readRetries: 20,

        // pushGuarantee: 'handoffs:3', 
        // readRetries: 30,
        
        pushGuarantee: 'irreversible', 
        readRetries: 100,
    }
    const push_guarantee_rpc = new PushGuarantee(rpc, config);
    const account = 'dappservices';
    const actor = 'vacctstst123';
    const action = 'transfer';
    const serializedTrx = await api.transact({
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
    },  {
        blocksBehind: 3, // in-block
        expireSeconds: 30, // in-block

        // blocksBehind: 3, // handoffs
        // expireSeconds: 90, // handoffs
        
        // expireSeconds: 300, // irreversible
        // useLastIrreversible: true, // irreversible,
        
        broadcast: false 
    });
    const result = await push_guarantee_rpc.push_transaction(serializedTrx, config);
    console.dir(result);
})().catch((e) => { console.log(e); });
```