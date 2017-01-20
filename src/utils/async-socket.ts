import {
  createSocket,
  Socket,
  AddressInfo,
} from 'dgram';
import {
  EventEmitter,
} from 'events';
import {
  Subscriber,
} from '../interfaces';

/**
 * Simple promisable udp socket
 */
export class AsyncSocket {
  private socket: Socket;
  protected events: EventEmitter = new EventEmitter();
  isConnected() {
    return this.socket ? true : false;
  }
  connect(port: number = 0 /* OS assigned port */) {
    return new Promise<AddressInfo>((resolve, reject) => {
      if (this.isConnected()) {
        resolve(this.socket.address());
      } else {
        this.socket = createSocket('udp4')
          .on('message', (raw: Buffer, remote) => {
            this.events.emit('raw', raw, remote);
          })
          .once('close', () => {
            this.socket = undefined;
            // remove all used listeners
            this.events.removeAllListeners();
          })
          .once('error', (err) => {
            reject(err);
          })
          .once('listening', () => {
            resolve(this.socket.address());
          });
        this.socket.bind(port);
      }
    });
  }
  complete<T>(cb?: () => T) {
    return new Promise<T>((resolve) => {
      if (this.isConnected()) {
        this.socket.once('close', () => {
          resolve(typeof cb === 'function' ? cb() : undefined);
        });
      } else {
        resolve(typeof cb === 'function' ? cb() : undefined);
      }
    });
  }
  disconnect<T>(cb?: () => T) {
    return new Promise<T>((resolve) => {
      if (this.isConnected()) {
        this.socket.once('close', () => {
          resolve(typeof cb === 'function' ? cb() : undefined);
        });
        this.socket.close();
      } else {
        resolve(typeof cb === 'function' ? cb() : undefined);
      }
    });
  }
  send(host: string, port: number, data) {
    return new Promise<void>((resolve, reject) => {
      if (this.isConnected()) {
        this.socket.send(data, port, host, (err, bytes) => {
          if (err) {
            reject(err);
          }
          if (bytes !== data.length) {
            reject(new Error(`Expected to send ${data.length} bytes, but sent ${bytes}`));
          }
          resolve();
        });
      } else {
        throw new Error(`No connection`);
      }
    });
  }
  on(event: 'raw', cb: (raw: Buffer, sender: AddressInfo) => void): Subscriber;
  on<T>(event: string, cb: (query: T, sender: AddressInfo) => void): Subscriber;
  on(event: string, cb: (...args: any[]) => void): Subscriber {
    if (this.events.on(event, cb)) {
      return {
        unsubscribe: () => this.events.removeListener(event, cb),
      };
    } else {
      throw new Error(`Failed to subscribe`);
    }
  }
}
