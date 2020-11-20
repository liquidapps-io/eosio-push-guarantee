function delay(t, v) {
    return new Promise(function(resolve) { 
        setTimeout(resolve.bind(null, v), t)
    });
}

export class PushGuarantee{

    pushOptions: any;
    rpc: any;
    fetch: any;
    status: number = 0;
    producerHandoffs: string[] = [];
    returnMessage:any
    RpcError:any
        
    constructor(rpc, RpcError, pushOptions, fetch){
        this.pushOptions = pushOptions;
        this.rpc = rpc;
        this.RpcError = RpcError
        this.fetch = fetch
    }

    public async push_transaction(serializedTrx, trxOptions){
        if(!serializedTrx) throw new Error('Transaction field is empty, must pass serialized transaction')
        const varPushRetries = trxOptions ? trxOptions.pushRetries : '';
        const variablePushRetries = this.pushOptions ? this.pushOptions.pushRetries : '';
        const pushRetries = varPushRetries || variablePushRetries || 3;
        return await this._push_transaction(serializedTrx, trxOptions, pushRetries);
    }

    protected async _push_transaction(serializedTrx, trxOptions, pushRetries){
        let trxRes
        let readRetries = trxOptions.readRetries || this.pushOptions.readRetries || 10;
        let backoff = trxOptions.backoff || this.pushOptions.backoff || 500;
        let prevStatus = 0;
        // try {
            if(!pushRetries) throw new Error('too many push retries');
            this.returnMessage = await this.fetch(this.rpc.endpoint + '/v1/chain/send_transaction', {
                body: JSON.stringify(serializedTrx),
                method: 'POST'
            });
            trxRes = await this.returnMessage.json();
            if (trxRes.code === 500) {
                throw this.returnMessage
            }
            // if (trxRes && trxRes.code == 500 && trxRes.error.name == 'set_exact_code') {
            //     if (process.env.VERBOSE_LOGS) console.log(`contract already running this version of code`)
            //     // return this.returnMessage;
            //     // return trxRes;
            //     throw trxRes
            // } else if (trxRes && trxRes.code == 500 && trxRes.error.name == 'account_name_exists_exception') {
            //     if (process.env.VERBOSE_LOGS) console.log(`account name already exists`)
            //     throw trxRes
            // }
            while(await this.checkIfFinal(trxRes, trxOptions) !== 2){
                if (process.env.VERBOSE_LOGS) console.log(`backoff: ${backoff} | readRetries ${readRetries} | pushRetries: ${pushRetries} | status: ${this.status} | producerHandoffs: ${this.producerHandoffs}`)
                await delay(backoff, undefined); 
                backoff *= trxOptions.backoffExponent || this.pushOptions.backoffExponent || 1.5;    
                const microForkDetection = (prevStatus === 1 && this.status === 0); // if trx was found and is now lost, retry
                if(!readRetries-- || microForkDetection) {
                    if (process.env.VERBOSE_LOGS && microForkDetection) {
                        console.log(`microfork detected, retrying trx`);
                    } else if(process.env.VERBOSE_LOGS) {
                        console.log(`readRetries exceeded, retrying trx`);
                    } else {
                        console.log(`retrying trx`);
                    }
                    return await this._push_transaction(serializedTrx, trxOptions, pushRetries-1); 
                }
                prevStatus = this.status;
            }
            return this.returnMessage
        // } catch(e) {
        //     // if(JSON.stringify(e).includes(`duplicate transaction`)) {
        //     //     if (process.env.VERBOSE_LOGS) console.log(`duplicate transaction`)
        //     // } else if(JSON.stringify(e).includes(`Could not find block`)) { 
        //     //     if (process.env.VERBOSE_LOGS) console.log(`Could not find block`)
        //     // } else {
        //     //     console.log(`throwing e`)
        //     //     console.log(e);
        //         throw new this.RpcError(e)
        //     // }
        // }
    }

    private handleInBlock = async (trxs, trxRes, pushOpt) => {
        for(const el of trxs) {
            if(el.trx.id == trxRes.transaction_id) {
                if (process.env.VERBOSE_LOGS) console.log(`found ${trxRes.transaction_id}`)
                this.status = (pushOpt === 'in-block' ? 2 : 1)
                return this.status
            }
        }
        if (process.env.VERBOSE_LOGS) console.log(`trx not found in block, checking next block`)
        trxRes.processed.block_num++; // handle edge case trx is placed in next block
        this.status = 0;
        return 0;
    }

    private handleHandoffs = async (handoffs) => {
        const getInfo = await this.rpc.get_info();
        const headBlockProducer = getInfo.head_block_producer;
        if(this.producerHandoffs.indexOf(headBlockProducer) === -1) {
            this.producerHandoffs.push(headBlockProducer)
        } else {
            if(process.env.VERBOSE_LOGS) console.log(`producer ${headBlockProducer} already in array`)
        }
        this.status = this.producerHandoffs.length - 1 >= handoffs ? 2 : 1;
        return this.status
    }

    private handleGuarantee = async (pushOpt, trxRes, handoffs = 0) => {
        if (process.env.VERBOSE_LOGS) console.log(pushOpt)
        // if(!trxRes.processed.block_num) if (process.env.VERBOSE_LOGS) return new Error(trxRes)
        let blockDetails;
        while(true) {
            try {
                await delay(100, undefined); 
                blockDetails = await this.rpc.get_block(trxRes.processed.block_num);
                if(blockDetails.transactions) break;
            } catch(e) {
                if(process.env.VERBOSE_LOGS) console.log(`block ${trxRes.processed.block_num} not found, retrying`)
            }
        }
        const res = await this.handleInBlock(blockDetails.transactions, trxRes, pushOpt);
        if(res && pushOpt === "in-block") {
            return res;
        } else if(res && pushOpt === "irreversible") {
            const getInfo = await this.rpc.get_info();
            if (process.env.VERBOSE_LOGS) console.log(`LIB block: ${getInfo.last_irreversible_block_num} | Blocks behind LIB: ${trxRes.processed.block_num -getInfo.last_irreversible_block_num}`)
            this.status = getInfo.last_irreversible_block_num > trxRes.processed.block_num ? 2 : 1;
            return this.status
        } else if(res && pushOpt.includes('handoffs')) {
            return await this.handleHandoffs(handoffs);
        }
        this.status = 0;
        return 0;
    }

    private async checkIfFinal(trxRes, trxOptions){
        const pushOpt = trxOptions.pushGuarantee || this.pushOptions.pushGuarantee || "in-block";
        switch(pushOpt){
            case "in-block":
                return await this.handleGuarantee(pushOpt, trxRes)
            case "handoffs:1":
                return await this.handleGuarantee(pushOpt, trxRes, 1)
            case "handoffs:2":
                return await this.handleGuarantee(pushOpt, trxRes, 2)
            case "handoffs:3":
                return await this.handleGuarantee(pushOpt, trxRes, 3)
            case "irreversible":
                return await this.handleGuarantee(pushOpt, trxRes)
            case "none":
                this.status = 2
                return 2;
        }
    }
}