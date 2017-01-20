/// <reference types="node" />
import { SmartCursor } from './utils/smart-cursor';
import { Channel, Header, Hpai } from './interfaces';
export declare function header(raw: Buffer, pos: SmartCursor): Header;
export declare function channel(raw: Buffer, pos: SmartCursor): Channel;
export declare function hpai(raw: Buffer, pos: SmartCursor): Hpai;
export declare function connectResponse(raw: Buffer, pos: SmartCursor): {
    connectionType: number;
    knxAddress: number;
};
export declare function seqnum(raw: Buffer, pos: SmartCursor): {
    channelId: number;
    seqn: number;
    status: number;
};
export declare function tunnelCemi(raw: Buffer, pos: SmartCursor): {
    data: Uint8Array;
    action: number;
    dest: number;
    source: number;
} | {
    action: number;
    dest: number;
    source: number;
};
