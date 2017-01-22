/// <reference types="node" />
import { RemoteInfo } from 'dgram';
import { AsyncSocket } from './utils/async-socket';
/**
 * Manages io server queries and tracks resolution of mappable requests
 */
export declare class QueryManager extends AsyncSocket {
    connect(port?: number): Promise<RemoteInfo>;
    /**
     * Creates a mapable request to track responses with timeout
     */
    request<T>(host: string, port: number, data: Buffer, select: (res: T, sender?: RemoteInfo) => boolean, timeout?: number): Promise<T>;
    /**
     * Processes raw messages from socket stream
     */
    private process(raw, remote);
}
