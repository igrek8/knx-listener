/// <reference types="node" />
import { Protocol } from './constants';
export interface Subscriber {
    unsubscribe: () => void;
}
export interface Hpai {
    protocol: Protocol.Tcp4 | Protocol.Udp4;
    ip: number;
    port: number;
}
export interface Channel {
    channelId: number;
    status: number;
}
export interface ConnectResponseTunnel {
    connectionType: number;
    knxAddress: number;
    protocol: number;
    ip: number;
    port: number;
    channelId: number;
    status: number;
    serviceId: number;
}
export interface Header {
    serviceId: number;
}
export interface DisconnectReponse {
    channelId: number;
    status: number;
}
export interface TunnelingAck {
    channelId: number;
    status: number;
    seqn: number;
}
export interface GroupResponse {
    source: number;
    data: Uint8Array | Buffer | number[];
    channelId: number;
    status: number;
    seqn: number;
    action: number;
    dest: number;
}
