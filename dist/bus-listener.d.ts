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
    /**
     * Initializes tunneling. It is `never-resolving` promise
     */
    bind(remoteHost: string, remotePort: number, {timeout, onFailure}?: {
        timeout?: number;
        onFailure?: (err: Error) => void;
    }): any;
    /**
     * returns promise, which indicates socket close
     */
    complete<T>(cb?: () => T): Promise<T>;
    isConnected(): boolean;
    /**
     * ready return promises, which only resolves when tunnel is connected
     */
    ready<T>(cb?: () => T): Promise<T>;
    /**
     * Generates next sequence number to number each knx telegram
     */
    protected nextSeqn(): number;
    /**
     * Verifies if the sender the one this tunneling was initially bound to
     */
    protected isSameOrigin(res: Channel, sender: AddressInfo): boolean;
    /**
     * Sends data to the bus
     */
    write(data: Buffer | Uint8Array | number[], groupAddress: number): Promise<TunnelingAck>;
    /**
     * Sends read request, which will only be resolved when response event received
     */
    read(groupAddress: number): Promise<GroupResponse>;
    /**
     * Terminates tunneling
     */
    disconnect<T>(cb?: () => T): Promise<T>;
    /**
     * Pings remote to verify if the channel is still active
     */
    protected startHeartbeat(): Promise<void>;
    /**
     * Stop heartbeat
     */
    protected stopHeartbeat(): void;
    /**
     * Send ping
     */
    protected ping(req: Buffer): Promise<Channel>;
    /**
     * Request tunneling
     */
    protected openTunnel(host: string, port: number): Promise<ConnectResponseTunnel>;
    /**
     * Supported events
     */
    on(event: 'unprocessed', cb: (err: Error, raw?: Buffer, remote?: AddressInfo) => void): Subscriber;
    on<T>(event: 'query', cb: (query: T, sender?: AddressInfo) => void): Subscriber;
}
