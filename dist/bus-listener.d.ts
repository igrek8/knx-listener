/// <reference types="node" />
import { Channel, ConnectResponseTunnel, TunnelingAck, GroupResponse, Hpai, Subscriber } from './interfaces';
import { QueryManager } from './query-manager';
import { AddressInfo } from 'dgram';
export declare class BusListener {
    protected sequenceIds: Set<number>;
    protected qmanager: QueryManager;
    protected controlPoint: Hpai;
    protected heartbeatInterval: NodeJS.Timer;
    protected source: number;
    protected remoteHost: string;
    protected remotePort: number;
    protected channelId: number;
    constructor();
    bind(remoteHost: string, remotePort: number, {timeout, onFailure}?: {
        timeout?: number;
        onFailure?: (err: Error) => void;
    }): any;
    complete<T>(cb?: () => T): Promise<T>;
    isConnected(): boolean;
    ready<T>(cb?: () => T): Promise<T>;
    protected nextSeqn(): number;
    protected isSameOrigin(res: Channel, sender: AddressInfo): boolean;
    write(data: Buffer | Uint8Array | number[], groupAddress: number): Promise<TunnelingAck>;
    read(groupAddress: number): Promise<GroupResponse>;
    disconnect<T>(cb?: () => T): Promise<T>;
    protected startHeartbeat(): Promise<void>;
    protected stopHeartbeat(): void;
    protected ping(req: Buffer): Promise<Channel>;
    protected openTunnel(host: string, port: number): Promise<ConnectResponseTunnel>;
    on(event: 'unprocessed', cb: (err: Error, raw?: Buffer, remote?: AddressInfo) => void): Subscriber;
    on<T>(event: 'query', cb: (query: T, sender?: AddressInfo) => void): Subscriber;
}
