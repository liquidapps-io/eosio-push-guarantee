var crypto = require('crypto');

function delay(t, v) {
    return new Promise(function(resolve) { 
        setTimeout(resolve.bind(null, v), t)
    });
}

export class PushGuarantee{

    rpc: any;
    fetch: any;
    pushOptions: any;
    status: number = 0;
    producerHandoffs: string[] = [];
        
    constructor(rpc, fetch, pushOptions){
        this.rpc = rpc;
        this.fetch = fetch
        this.pushOptions = pushOptions;
    }

    public async push_transaction(packedTrx, trxOptions){
        if(!packedTrx) throw new Error('Transaction field is empty, must pass packed transaction')
        const varPushRetries = trxOptions ? trxOptions.pushRetries : '';
        const variablePushRetries = this.pushOptions ? this.pushOptions.pushRetries : '';
        const pushRetries = varPushRetries || variablePushRetries || 3;
        return await this._push_transaction(packedTrx, trxOptions, pushRetries);
    }

    public async fetchTransaction (endpoint, body) {
        return await this.fetch(endpoint, {
            body,
            method: 'POST'
        });
    }

    protected async _push_transaction(packedTrx, trxOptions, pushRetries){
        let readRetries = trxOptions.readRetries || this.pushOptions.readRetries || 10;
        let backoff = trxOptions.backoff || this.pushOptions.backoff || 500;
        let prevStatus = 0;
        if(!pushRetries) throw new Error('too many push retries');
        let execBlock = await this.rpc.get_info();
        const serializedTransaction = new Buffer(packedTrx.packed_trx, "hex");
        execBlock = {
            head_block_num: execBlock.head_block_num,
            transaction_id: crypto.createHash('sha256').update(serializedTransaction).digest('hex')
        }
        const fetchResponse = await this.fetchTransaction(this.rpc.endpoint + '/v1/chain/send_transaction', JSON.stringify(packedTrx));
        if(fetchResponse.status !== 202) return fetchResponse; // check if 202 meaning trx success, if error or duplicate or other, return
        while(await this.checkIfFinal(execBlock, trxOptions) !== 2){
            if (process.env.VERBOSE_LOGS) console.log(`backoff: ${backoff} | readRetries ${readRetries} | pushRetries: ${pushRetries} | status: ${this.status} | producerHandoffs: ${this.producerHandoffs}`)
            await delay(backoff, undefined); 
            backoff *= trxOptions.backoffExponent || this.pushOptions.backoffExponent || 1.5;    
            const microForkDetection = (prevStatus === 1 && this.status === 0); // if trx was found and is now lost, retry
            if (microForkDetection && !readRetries--) {
                if (process.env.VERBOSE_LOGS && microForkDetection) {
                    if (process.env.VERBOSE_LOGS) console.log(`microfork detected, retrying trx`);
                } else if(process.env.VERBOSE_LOGS) {
                    if (process.env.VERBOSE_LOGS) console.log(`readRetries exceeded, retrying trx`);
                } else {
                    if (process.env.VERBOSE_LOGS) console.log(`retrying trx`);
                }
                await this.fetchTransaction(this.rpc.endpoint + '/v1/chain/send_transaction', JSON.stringify(packedTrx));
            }
            prevStatus = this.status;
        }
        return fetchResponse;
    }

    private handleInBlock = async (trxs, execBlock, pushOpt) => {
        for(const el of trxs) {
            if(el.trx.id == execBlock.transaction_id) {
                if (process.env.VERBOSE_LOGS) console.log(`found ${execBlock.transaction_id}`)
                this.status = (pushOpt === 'in-block' ? 2 : 1)
                return this.status
            }
        }
        if (process.env.VERBOSE_LOGS) console.log(`trx not found in block, checking next block`)
        execBlock.head_block_num++; // handle edge case trx is placed in next block
        this.status = 0;
        return 0;
    }

    private handleHandoffs = async (handoffs) => {
        const getInfo = await this.rpc.get_info();
        const headBlockProducer = getInfo.head_block_producer;
        if(this.producerHandoffs.indexOf(headBlockProducer) === -1) {
            this.producerHandoffs.push(headBlockProducer)
        } else {
            if (process.env.VERBOSE_LOGS) console.log(`producer ${headBlockProducer} already in array`)
        }
        this.status = this.producerHandoffs.length - 1 >= handoffs ? 2 : 1;
        return this.status
    }

    private handleGuarantee = async (pushOpt, execBlock, handoffs = 0) => {
        if (process.env.VERBOSE_LOGS) console.log(pushOpt)
        let blockDetails;
        while(true) {
            try {
                await delay(100, undefined); 
                blockDetails = await this.rpc.get_block(execBlock.head_block_num);
                if(blockDetails.transactions) break;
            } catch(e) {
                if (process.env.VERBOSE_LOGS) console.log(`block ${execBlock.head_block_num} not found, retrying`)
            }
        }
        const res = await this.handleInBlock(blockDetails.transactions, execBlock, pushOpt);
        if(res && pushOpt === "in-block") {
            return res;
        } else if(res && pushOpt === "irreversible") {
            const getInfo = await this.rpc.get_info();
            if (process.env.VERBOSE_LOGS) console.log(`LIB block: ${getInfo.last_irreversible_block_num} | Blocks behind LIB: ${execBlock.head_block_num -getInfo.last_irreversible_block_num}`)
            this.status = getInfo.last_irreversible_block_num > execBlock.head_block_num ? 2 : 1;
            return this.status
        } else if(res && pushOpt.includes('handoffs')) {
            return await this.handleHandoffs(handoffs);
        }
        this.status = 0;
        return 0;
    }

    private async checkIfFinal(execBlock, trxOptions){
        const pushOpt = trxOptions.pushGuarantee || this.pushOptions.pushGuarantee || "in-block";
        switch(pushOpt){
            case "in-block":
                return await this.handleGuarantee(pushOpt, execBlock)
            case "handoffs:1":
                return await this.handleGuarantee(pushOpt, execBlock, 1)
            case "handoffs:2":
                return await this.handleGuarantee(pushOpt, execBlock, 2)
            case "handoffs:3":
                return await this.handleGuarantee(pushOpt, execBlock, 3)
            case "irreversible":
                return await this.handleGuarantee(pushOpt, execBlock)
            case "none":
                this.status = 2
                return 2;
        }
    }
}