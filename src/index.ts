function delay(t, v) {
    return new Promise(function(resolve) { 
        setTimeout(resolve.bind(null, v), t)
    });
}

export class PushGuarantee{

    pushOptions: any;
    api: any;
    rpc: any;
        
    constructor(api, pushOptions){
        this.pushOptions = pushOptions;
        this.api = api;
        this.rpc = api.rpc;
    }

    public push_transaction(serializedTrx, trxOptions){
        const varPushRetries = trxOptions ? trxOptions.pushRetries : '';
        const variablePushRetries = this.pushOptions ? this.pushOptions.pushRetries : '';
        const pushRetries = varPushRetries || variablePushRetries || 3;
        return this._push_transaction(serializedTrx, trxOptions, pushRetries);
    }

    protected async _push_transaction(serializedTrx, trxOptions, pushRetries){
        try {
            if(!pushRetries) throw new Error('too many push retries')
            const trxRes = await this.rpc.push_transaction(serializedTrx, trxOptions);
            let readRetries = trxOptions.readRetries || this.pushOptions.readRetries || 10;
            let backoff = trxOptions.backoff || this.pushOptions.backoff || 500;
            while(await this.checkIfFinal(trxRes, trxOptions) !== 2){
                if (process.env.VERBOSE_LOGS) console.log(`backoff: ${backoff} | readRetries ${readRetries} | pushRetries: ${pushRetries}`)
                await delay(backoff, undefined); 
                backoff *= trxOptions.backoffExponent || this.pushOptions.backoffExponent || 1.1;      
                if(!readRetries--) {
                    return this._push_transaction(serializedTrx, trxOptions, pushRetries-1); 
                }
            }
            return trxRes;
        } catch(e) {
            throw new Error(e)
        }
    }

    private handleInBlock = async (trxs, trxRes, pushOpt) => {
        for(const el of trxs) {
            if(el.trx.id == trxRes.transaction_id) {
                if (process.env.VERBOSE_LOGS) console.log(`found ${trxRes.transaction_id}`)
                return pushOpt === 'in-block' ? 2 : 1
            }
        }
        if (process.env.VERBOSE_LOGS) console.log(`trx not found in block, checking next block`)
        trxRes.processed.block_num++; // handle edge case trx is placed in next block
        return 0;
    }

    private handleGuarantee = async (pushOpt, trxRes) => {
        try { 
            if (process.env.VERBOSE_LOGS) console.log(pushOpt)
            const blockDetails = await this.rpc.get_block(trxRes.processed.block_num);
            if (process.env.VERBOSE_LOGS) console.log(`trx block: ${trxRes.processed.block_num}`)
            const res = await this.handleInBlock(blockDetails.transactions, trxRes, pushOpt);
            if(res && pushOpt === "in-block")  {
                return res;
            } else if(res) {
                const getInfo = await this.rpc.get_info();
                if (process.env.VERBOSE_LOGS) console.log(`LIB block: ${getInfo.last_irreversible_block_num} | Blocks behind LIB: ${trxRes.processed.block_num -getInfo.last_irreversible_block_num}`)
                return getInfo.last_irreversible_block_num > trxRes.processed.block_num ? 2 : 1;
            }
        } catch (e) { 
            if(JSON.stringify(e).includes(`Could not find block`)) {
                if (process.env.VERBOSE_LOGS) console.log(`Could not find block`)
            } else {
                if (process.env.VERBOSE_LOGS) console.log(e)
            }
        }
        return 0;
    }

    private async checkIfFinal(trxRes, trxOptions){
        const pushOpt = trxOptions.pushGuarantee || this.pushOptions.pushGuarantee || "in-block";
        switch(pushOpt){
            case "in-block":
                return await this.handleGuarantee(pushOpt, trxRes)
            case "irreversible":
                return await this.handleGuarantee(pushOpt, trxRes)
            case "none":
                return 2;
        }
    }
}