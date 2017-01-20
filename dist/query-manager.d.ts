/// <reference types="node" />
import { RemoteInfo } from 'dgram';
import { AsyncSocket } from './utils/async-socket';
export declare class QueryManager extends AsyncSocket {
    constructor();
    request<T>(host: string, port: number, data: Buffer, select: (res: T, sender?: RemoteInfo) => boolean, timeout?: number): Promise<T>;
    private process(raw, remote);
}
