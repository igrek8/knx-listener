import { createSocket, AddressInfo } from 'dgram';
import { EventEmitter } from 'events';

export class FakeSocket {
  info: AddressInfo = {
    address: '127.0.0.1',
    port: -1,
    family: 'IPv4',
  };
  events = new EventEmitter();
  bind = jest.fn((port) => {
    this.info.port = port;
  });
  close = jest.fn();
  send = jest.fn();
  on = jest.fn((...args: any[]) => {
    this.events.on.apply(this.events, args);
    return this;
  });
  once = jest.fn((...args: any[]) => {
    this.events.once.apply(this.events, args);
    return this;
  });
  address = jest.fn(() => {
    return this.info;
  });
  constructor() {
  }
  fakeConnected() {
    this.events.emit('listening');
    return this;
  }
  fakeClose() {
    this.events.emit('close');
    return this;
  }
  failNextBind(err: Error) {
    this.bind.mockImplementationOnce((...args: any[]) => {
      if (this.events.listeners('error').length > 0) {
        this.events.emit('error', err);
      } else {
        throw err;
      }
      const cb: Function = args[args.length - 1];
      if (typeof cb === 'function') {
        cb.call(this);
      }
    });
    return this;
  }
  fakeNextSend(err?: any, bytes?: number) {
    this.send.mockImplementationOnce((...args: any[]) => {
      const cb: Function = args[args.length - 1];
      if (typeof cb === 'function') {
        cb.call(this, err, bytes);
      }
    });
    return this;
  }
  fakeError(err: any) {
    this.events.emit('error', err);
    return this;
  }
  fakeData(data: Buffer, sender?: AddressInfo) {
    this.events.emit('message', data, sender);
    return this;
  }
}

export const mockSocket = () => {
  const socket = new FakeSocket();
  (createSocket as jest.Mock<any>).mockReturnValue(socket);
  return socket;
};
