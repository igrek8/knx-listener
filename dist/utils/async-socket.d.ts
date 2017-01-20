/// <reference types="node" />
import { AddressInfo } from 'dgram';
import { EventEmitter } from 'events';
import { Subscriber } from '../interfaces';
export declare class AsyncSocket {
    private socket;
    protected events: EventEmitter;
    isConnected(): boolean;
    connect(port?: number): Promise<AddressInfo>;
    complete<T>(cb?: () => T): Promise<T>;
    disconnect<T>(cb?: () => T): Promise<T>;
    send(host: string, port: number, data: any): Promise<void>;
    on(event: 'raw', cb: (raw: Buffer, sender: AddressInfo) => void): Subscriber;
    on<T>(event: string, cb: (query: T, sender: AddressInfo) => void): Subscriber;
}
