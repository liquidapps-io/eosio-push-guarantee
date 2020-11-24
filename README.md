EOSIO Push Guarantee Library | https://www.npmjs.com/package/eosio-push-guarantee
=====================

https://liquidapps.io

Thank you to the dfuse team for the inspiration on this standard.

To use the library:

```bash
npm install eosio-push-guarantee
```

To build/test the library, first install dependencies:

```bash
npm install --save-dev eosio-push-guarantee node-fetch eosjs
```

Verbose logs

```bash
export VERBOSE_LOGS=true
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
const { arrayToHex } = require("eosjs/dist/eosjs-serialize");

(async () => {
    const config = {
        // pushGuarantee: 'none', // push guarantee level for trx
        // readRetries: 0, // amount of times to try and verify trx before retrying trx
        // pushRetries: 3, // amount of times to retry trx before failing
        // backoff: 500, // time in ms between readRetries
        // backoffExponent: 1.5 // multiplier backoff time for backoff (if 500ms and 1.1 multiplier then 550ms backoff next time, etc)

        pushGuarantee: 'in-block', 
        readRetries: 3,

        // pushGuarantee: 'handoffs:1', 
        // readRetries: 10,

        // pushGuarantee: 'handoffs:2', 
        // readRetries: 20,

        // pushGuarantee: 'handoffs:3', 
        // readRetries: 30,
        
        // pushGuarantee: 'irreversible', 
        // readRetries: 100,
    }
    // api.rpc = rpc;
    const push_guarantee_rpc = new PushGuarantee(rpc, RpcError, config, fetch);
    const account = 'dappservices';
    const actor = 'vacctstst123';
    const action = 'transfer';
    let serializedTrx = await api.transact({
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
    let packedTrx = {
        signatures: serializedTrx.signatures,
        compression: serializedTrx.compression || 0,
        packed_trx: arrayToHex(serializedTrx.serializedTransaction),
        packed_context_free_data: serializedTrx.serializedContextFreeData ? arrayToHex(serializedTrx.serializedContextFreeData) : null
    }
    const result = await push_guarantee_rpc.push_transaction(packedTrx, config);
    console.log(await result.json());
})().catch((e) => { console.log(e); });
```