import {
  RemoteInfo,
} from 'dgram';
import {
  AsyncSocket,
} from './utils/async-socket';
import {
  SmartCursor,
} from './utils/smart-cursor';
import {
  channel as readChannel,
  connectResponse,
  header as readHeader,
  hpai,
  seqnum,
  tunnelCemi,
} from './deserializer';
import {
  ack,
} from './serializer';
import {
  Service,
  Status,
} from './constants';

/**
 * Manages io server queries and tracks resolution of mappable requests
 */
export class QueryManager extends AsyncSocket {
  constructor() {
    super();
    // forward raw data for processing
    super.on('raw', this.process.bind(this));
  }
  /**
   * Creates a mapable request to track responses with timeout
   */
  request<T>(
    host: string, port: number, data: Buffer,
    select: (res: T, sender?: RemoteInfo) => boolean, timeout?: number,
  ) {
    return new Promise<T>((resolve, reject) => {
      // keep ref to unsub to avoid a memory leak
      const ref = this.on<T & { status: number }>('query', (query, remote) => {
        // map response to the request
        if (select(query, remote)) {
          if (query.status === Status.NoError) {
            resolve(query);
          } else {
            reject(new Error(`Request error ${query.status}`));
          }
        }
      });
      // set timeout if no response within given time
      setTimeout(() => {
        ref.unsubscribe(); // avoid memory leak
        reject({ ...new Error(`Request timeout`), code: 'ETIMEOUT' });
      }, timeout > 200 ? timeout : 200).unref(); // unref timeout to let node exit
      // make request and propagate errors
      return super.send(host, port, data).catch((err) => {
        ref.unsubscribe(); // avoid memory leak
        reject(err);
      });
    });
  }
  /**
   * Processes raw messages from socket stream
   */
  private process(raw: Buffer, remote: RemoteInfo) {
    try {
      const pos = new SmartCursor();
      const header = readHeader(raw, pos);
      switch (header.serviceId) {
        case Service.ConnectResponse: {
          const channel = readChannel(raw, pos);
          const sender = hpai(raw, pos);
          const response = connectResponse(raw, pos);
          return this.events.emit('query', {
            ...header, ...channel, ...sender, ...response,
          }, remote);
        }
        case Service.ConnectStateResponse: {
          const channel = readChannel(raw, pos);
          return this.events.emit('query', { ...channel }, remote);
        }
        case Service.TunnelingAck: {
          const seqn = seqnum(raw, pos);
          return this.events.emit('query', { ...seqn }, remote);
        }
        case Service.TunnelingRequest: {
          const seqn = seqnum(raw, pos);
          const cemi = tunnelCemi(raw, pos);
          // reply ack to indicate successful reception of the message
          this.send(remote.address, remote.port, ack(
            seqn.seqn, seqn.channelId, Status.NoError,
          ));
          return this.events.emit('query', { ...cemi, ...seqn }, remote);
        }
        case Service.DisconnectResponse: {
          const channel = readChannel(raw, pos);
          return this.events.emit('query', { ...channel }, remote);
        }
        default: throw new Error(`Failed to process ${header.serviceId}`);
      }
    } catch (err) {
      return this.events.emit('unprocessed', err, raw, remote);
    }
  }
}
