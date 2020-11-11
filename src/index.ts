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

    public async transact(trx, trxOptions){
        const varPushRetries = trxOptions ? trxOptions.pushRetries : '';
        const variablePushRetries = this.pushOptions ? this.pushOptions.pushRetries : '';
        const pushRetries = varPushRetries || variablePushRetries || 3;
        return this._transact(trx, trxOptions, pushRetries);
    }

    protected async _transact(trx, trxOptions, pushRetries){
        if(!pushRetries) throw new Error('too many push retries')
        const trxRes = await this.api.transact(trx, trxOptions);
        let readRetries = trxOptions.readRetries || this.pushOptions.readRetries || 10;
        let backoff = trxOptions.readRetries || this.pushOptions.readRetries || 500;
        while(!(await this.checkIfFinal(trxRes, trxOptions))){
            await delay(backoff, ''); 
            backoff *= trxOptions.backoffExponent || this.pushOptions.backoffExponent || 1.5;      
            if(!readRetries--) 
                return this._transact(trx, trxOptions, pushRetries-1); 
        }
        return trxRes;
    }

    private handleInBlock = async (trxs, trxRes) => {
        for(const el of trxs) {
            if(el.trx.id == trxRes.transaction_id) {
                // if (process.env.VERBOSE_LOGS) console.log(`found ${trxRes.transaction_id}`)
                return true
            }
        }
        // if (process.env.VERBOSE_LOGS) console.log(`trx not found in block, checking next block`)
        trxRes.processed.block_num++; // handle edge case trx is placed in next block
        return false;
    }

    private handleGuarantee = async (pushOpt, trxRes) => {
        try { 
            // if (process.env.VERBOSE_LOGS) console.log(pushOpt)
            const blockDetails = await this.rpc.get_block(trxRes.processed.block_num);
            // if (process.env.VERBOSE_LOGS) console.log(`trx block: ${trxRes.processed.block_num}`)
            const res = await this.handleInBlock(blockDetails.transactions, trxRes);
            if(res && pushOpt === "in-block")  {
                return res;
            } else if(res) {
                const getInfo = await this.rpc.get_info();
                // if (process.env.VERBOSE_LOGS) console.log(`LIB block: ${getInfo.last_irreversible_block_num} | Blocks behind LIB: ${trxRes.processed.block_num -getInfo.last_irreversible_block_num}`)
                return getInfo.last_irreversible_block_num > trxRes.processed.block_num;
            }
        } catch (e) { 
            if(JSON.stringify(e).includes(`Could not find block`)) {
                // if (process.env.VERBOSE_LOGS) console.log(`Could not find block`)
            } else {
                // if (process.env.VERBOSE_LOGS) console.log(e)
            }
        }
        return false;
    }

    private async checkIfFinal(trxRes, trxOptions){
        const pushOpt = trxOptions.push_guarantee || this.pushOptions.push_guarantee || "in-block";
        switch(pushOpt){
            case "in-block":
                return await this.handleGuarantee(pushOpt, trxRes)
            case "irreversible":
                return await this.handleGuarantee(pushOpt, trxRes)
            case "none":
                return true;
        }
    }
}