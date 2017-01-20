/// <reference types="node" />
import { Hpai } from './interfaces';
export declare const enum DataType {
    Uint8 = 1,
    Uint16 = 2,
    Uint32 = 4,
    Uint64 = 8,
    Uint128 = 16,
}
export declare function ack(seqn: number, channelId: number, status: number): Buffer;
export declare function disconnect(channelId: number, respondTo: Hpai): Buffer;
export declare function ping(channelId: number, respondTo: Hpai): Buffer;
export declare function openTunnel({receiveAt, respondTo}: {
    respondTo: Hpai;
    receiveAt: Hpai;
}): Buffer;
export declare function write({data, seqn, channelId, source, dest}: {
    data: Buffer | Uint8Array | number[];
    seqn: number;
    channelId: number;
    source: number;
    dest: number;
}): Buffer;
export declare function read(params: {
    seqn: number;
    channelId: number;
    source: number;
    dest: number;
}): Buffer;
