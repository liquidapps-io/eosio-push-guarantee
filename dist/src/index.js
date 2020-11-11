"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
function delay(t, v) {
    return new Promise(function (resolve) {
        setTimeout(resolve.bind(null, v), t);
    });
}
var PushGuarantee = /** @class */ (function () {
    function PushGuarantee(api, pushOptions) {
        var _this = this;
        this.handleInBlock = function (trxs, trxRes) { return __awaiter(_this, void 0, void 0, function () {
            var trxs_1, trxs_1_1, el;
            var e_1, _a;
            return __generator(this, function (_b) {
                try {
                    for (trxs_1 = __values(trxs), trxs_1_1 = trxs_1.next(); !trxs_1_1.done; trxs_1_1 = trxs_1.next()) {
                        el = trxs_1_1.value;
                        if (el.trx.id == trxRes.transaction_id) {
                            if (process.env.VERBOSE_LOGS)
                                console.log("found " + trxRes.transaction_id);
                            return [2 /*return*/, true];
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (trxs_1_1 && !trxs_1_1.done && (_a = trxs_1.return)) _a.call(trxs_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                if (process.env.VERBOSE_LOGS)
                    console.log("trx not found in block, checking next block");
                trxRes.processed.block_num++; // handle edge case trx is placed in next block
                return [2 /*return*/, false];
            });
        }); };
        this.handleGuarantee = function (pushOpt, trxRes) { return __awaiter(_this, void 0, void 0, function () {
            var blockDetails, res, getInfo, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        if (process.env.VERBOSE_LOGS)
                            console.log(pushOpt);
                        return [4 /*yield*/, this.rpc.get_block(trxRes.processed.block_num)];
                    case 1:
                        blockDetails = _a.sent();
                        if (process.env.VERBOSE_LOGS)
                            console.log("trx block: " + trxRes.processed.block_num);
                        return [4 /*yield*/, this.handleInBlock(blockDetails.transactions, trxRes)];
                    case 2:
                        res = _a.sent();
                        if (!(res && pushOpt === "in-block")) return [3 /*break*/, 3];
                        return [2 /*return*/, res];
                    case 3:
                        if (!res) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.rpc.get_info()];
                    case 4:
                        getInfo = _a.sent();
                        if (process.env.VERBOSE_LOGS)
                            console.log("LIB block: " + getInfo.last_irreversible_block_num + " | Blocks behind LIB: " + (trxRes.processed.block_num - getInfo.last_irreversible_block_num));
                        return [2 /*return*/, getInfo.last_irreversible_block_num > trxRes.processed.block_num];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        e_2 = _a.sent();
                        if (JSON.stringify(e_2).includes("Could not find block")) {
                            if (process.env.VERBOSE_LOGS)
                                console.log("Could not find block");
                        }
                        else {
                            if (process.env.VERBOSE_LOGS)
                                console.log(e_2);
                        }
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/, false];
                }
            });
        }); };
        this.pushOptions = pushOptions;
        this.api = api;
        this.rpc = api.rpc;
    }
    PushGuarantee.prototype.transact = function (trx, trxOptions) {
        return __awaiter(this, void 0, void 0, function () {
            var varPushRetries, variablePushRetries, pushRetries;
            return __generator(this, function (_a) {
                varPushRetries = trxOptions ? trxOptions.pushRetries : '';
                variablePushRetries = this.pushOptions ? this.pushOptions.pushRetries : '';
                pushRetries = varPushRetries || variablePushRetries || 3;
                return [2 /*return*/, this._transact(trx, trxOptions, pushRetries)];
            });
        });
    };
    PushGuarantee.prototype._transact = function (trx, trxOptions, pushRetries) {
        return __awaiter(this, void 0, void 0, function () {
            var trxRes, readRetries, backoff;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!pushRetries)
                            throw new Error('too many push retries');
                        return [4 /*yield*/, this.api.transact(trx, trxOptions)];
                    case 1:
                        trxRes = _a.sent();
                        readRetries = trxOptions.readRetries || this.pushOptions.readRetries || 10;
                        backoff = trxOptions.readRetries || this.pushOptions.readRetries || 500;
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.checkIfFinal(trxRes, trxOptions)];
                    case 3:
                        if (!!(_a.sent())) return [3 /*break*/, 5];
                        return [4 /*yield*/, delay(backoff, '')];
                    case 4:
                        _a.sent();
                        backoff *= trxOptions.backoffExponent || this.pushOptions.backoffExponent || 1.5;
                        if (!readRetries--)
                            return [2 /*return*/, this._transact(trx, trxOptions, pushRetries - 1)];
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, trxRes];
                }
            });
        });
    };
    PushGuarantee.prototype.checkIfFinal = function (trxRes, trxOptions) {
        return __awaiter(this, void 0, void 0, function () {
            var pushOpt, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        pushOpt = trxOptions.push_guarantee || this.pushOptions.push_guarantee || "in-block";
                        _a = pushOpt;
                        switch (_a) {
                            case "in-block": return [3 /*break*/, 1];
                            case "in-lib-block": return [3 /*break*/, 3];
                            case "none": return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 6];
                    case 1: return [4 /*yield*/, this.handleGuarantee(pushOpt, trxRes)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3: return [4 /*yield*/, this.handleGuarantee(pushOpt, trxRes)];
                    case 4: return [2 /*return*/, _b.sent()];
                    case 5: return [2 /*return*/, true];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return PushGuarantee;
}());
exports.PushGuarantee = PushGuarantee;
