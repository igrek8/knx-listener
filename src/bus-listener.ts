import {
  disconnect,
  read,
  openTunnel,
  ping,
  write,
} from './serializer';
import {
  DisconnectReponse,
  Channel,
  ConnectResponseTunnel,
  TunnelingAck,
  GroupResponse,
  Hpai,
  Subscriber,
} from './interfaces';
import {
  QueryManager,
} from './query-manager';
import {
  Service,
  Protocol,
  Connection,
  BusEvent,
} from './constants';
import {
  MyIpNumber,
} from './constants';
import {
  AddressInfo,
} from 'dgram';

export class BusListener {
  protected sequenceIds: Set<number>;
  protected qmanager: QueryManager;
  protected controlPoint: Hpai;
  protected heartbeatInterval: NodeJS.Timer;
  protected source: number;
  protected remoteHost: string;
  protected remotePort: number;
  protected channelId: number;
  constructor() {
    this.sequenceIds = new Set();
    this.qmanager = new QueryManager();
  }
  /**
   * Initializes tunneling. It is `never-resolving` promise
   */
  public bind(remoteHost: string, remotePort: number, {
    timeout, onFailure,
  }: { timeout?: number, onFailure?: (err: Error) => void } = {}): any {
    return this.qmanager.connect().then((sock) => {
      this.controlPoint = {
        ip: MyIpNumber,
        protocol: Protocol.Udp4,
        port: sock.port,
      };
      return this.openTunnel(remoteHost, remotePort).then((response) => {
        // when tunneling is open, store important info
        this.source = response.knxAddress;
        this.channelId = response.channelId;
        this.remoteHost = remoteHost;
        this.remotePort = remotePort;
        // begin heartbeat to the remote host
        return this.startHeartbeat();
      });
    }).catch((err) => {
      if (typeof onFailure === 'function') {
        onFailure(err);
      }
      this.stopHeartbeat();
      if (timeout) {
        // cast number to uint
        timeout = timeout >>> 0;
        // schedule retry in `timeout` seconds
        return new Promise((resolve) => setTimeout(resolve, timeout).unref()).then(() => {
          // call to reconnect
          return this.bind(remoteHost, remotePort, {
            timeout, onFailure,
          });
        });
      } else {
        // if no timeout, then propagate error to the caller
        throw err;
      }
    });
  }
  /**
   * returns promise, which indicates socket close
   */
  public complete<T>(cb?: () => T) {
    return this.qmanager.complete(cb);
  }
  public isConnected() {
    return this.heartbeatInterval ? true : false;
  }
  /**
   * ready return promises, which only resolves when tunnel is connected
   */
  public ready<T>(cb?: () => T) {
    return new Promise<T>((resolve) => {
      if (this.isConnected()) {
        resolve(typeof cb === 'function' ? cb() : undefined);
      } else {
        const interval = setInterval(() => {
          if (this.isConnected()) {
            // when connected, clear interval
            clearInterval(interval);
            resolve(typeof cb === 'function' ? cb() : undefined);
          }
        }, 0);
        interval.unref(); // let node exit
      }
    });
  }
  /**
   * Generates next sequence number to number each knx telegram
   */
  protected nextSeqn() {
    let id = 0;
    while (this.sequenceIds.has(id)) {
      if (id++ >= 0xFF) {
        throw new Error('Maximum sequence number reached');
      }
    }
    this.sequenceIds.add(id);
    return id;
  }
  /**
   * Verifies if the sender the one this tunneling was initially bound to
   */
  protected isSameOrigin(res: Channel, sender: AddressInfo) {
    return res.channelId === this.channelId &&
      sender.address === this.remoteHost &&
      sender.port === this.remotePort &&
      sender.family === 'IPv4';
  }
  /**
   * Sends data to the bus
   */
  public write(data: Buffer | Uint8Array | number[], groupAddress: number) {
    const seqn = this.nextSeqn();
    const req = write({
      data, seqn,
      channelId: this.channelId,
      dest: groupAddress,
      source: this.source,
    });
    return this.qmanager.request<TunnelingAck>(this.remoteHost, this.remotePort, req, (res, sender) => {
      return res.seqn === seqn && this.isSameOrigin(res, sender);
    }).then((res) => {
      // always free used sequence number
      this.sequenceIds.delete(seqn);
      return res;
    }, (err) => {
      // always free used sequence number
      this.sequenceIds.delete(seqn);
      throw err;
    });
  }
  /**
   * Sends read request, which will only be resolved when response event received
   */
  public read(groupAddress: number) {
    const seqn = this.nextSeqn();
    const req = read({
      seqn,
      channelId: this.channelId,
      dest: groupAddress,
      source: this.source,
    });
    return this.qmanager.request<GroupResponse>(this.remoteHost, this.remotePort, req, (res, sender) => {
      return res.dest === groupAddress &&
        res.action === BusEvent.GroupResponse &&
        this.isSameOrigin(res, sender);
    }).then((res) => {
      // always free used sequence number
      this.sequenceIds.delete(seqn);
      return res;
    }, (err) => {
      // always free used sequence number
      this.sequenceIds.delete(seqn);
      throw err;
    });
  }
  /**
   * Terminates tunneling
   */
  public disconnect<T>(cb?: () => T) {
    const req = disconnect(this.channelId, this.controlPoint);
    return this.qmanager.request<DisconnectReponse>(
      this.remoteHost, this.remotePort, req, (res, remote) => {
        return this.isSameOrigin(res, remote);
      }).then(() => {
        // when disconnecting, we stop heartbeating
        this.stopHeartbeat();
        return this.qmanager.disconnect(cb);
      });
  }
  /**
   * Pings remote to verify if the channel is still active
   */
  protected startHeartbeat() {
    const req = ping(this.channelId, this.controlPoint);
    return new Promise<void>((_resolve, reject) => {
      // check connection with the first ping
      return this.ping(req).then(() => {
        // indicate that tunnel is ready
        // if it is successfull, then begin heartbeat every 60s
        this.heartbeatInterval = setInterval(() => {
          this.ping(req).catch(reject);
        }, 60000);
        // let node exit without waiting the interval
        this.heartbeatInterval.unref();
      }).catch(reject);
    });
  }
  /**
   * Stop heartbeat
   */
  protected stopHeartbeat() {
    if (this.heartbeatInterval) {
      // stop heartbeat if started
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
  /**
   * Send ping
   */
  protected ping(req: Buffer) {
    return this.qmanager.request<Channel>(
      this.remoteHost, this.remotePort, req, (res, remote) => {
        return this.isSameOrigin(res, remote);
      }, 5000);
  }
  /**
   * Request tunneling
   */
  protected openTunnel(host: string, port: number) {
    const q = openTunnel({
      receiveAt: this.controlPoint,
      respondTo: this.controlPoint,
    });
    return this.qmanager.request<ConnectResponseTunnel>(
      host, port, q, (res, sender) => {
        return sender.address === host &&
          sender.family === 'IPv4' &&
          sender.port === port &&
          res.serviceId === Service.ConnectResponse &&
          res.connectionType === Connection.Tunnel;
      });
  }
  /**
   * Supported events
   */
  on(event: 'unprocessed', cb: (err: Error, raw?: Buffer, remote?: AddressInfo) => void): Subscriber;
  on<T>(event: 'query', cb: (query: T, sender?: AddressInfo) => void): Subscriber;
  on(event: string, cb: (...args: any[]) => void): Subscriber {
    return this.qmanager.on(event, cb);
  }
}
