import {
  SmartCursor,
} from './utils/smart-cursor';
import {
  Service,
} from './constants';
import {
  Hpai,
} from './interfaces';

function header(service: Service, bodyLength: number) {
  const size = 0x06;
  const pos = new SmartCursor();
  const raw = Buffer.allocUnsafe(size);
  raw.writeUInt8(size, pos.next()); // header length
  raw.writeUInt8(0x10, pos.next()); // version
  raw.writeUInt16BE(service, pos.next(2)); // service type
  raw.writeUInt16BE(size + bodyLength, pos.next(2)); // total length
  return raw;
};

function message(service: Service, includes: Buffer[]) {
  const size = includes.reduce((acc, item) => acc += item.length, 0);
  const head = header(service, size);
  const ret = Buffer.concat([head, ...includes]);
  return ret;
};

function hpai(protocol: number, ip: number, port: number) {
  const size = 0x08;
  const pos = new SmartCursor();
  const raw = Buffer.allocUnsafe(size);
  raw.writeUInt8(size, pos.next()); // structure length
  raw.writeUInt8(protocol, pos.next()); // protocol
  raw.writeUInt32BE(ip, pos.next(4)); // ip
  raw.writeUInt16BE(port, pos.next(2)); // port
  return raw;
};

function tunneling() {
  const size = 0x04;
  const pos = new SmartCursor();
  const raw = Buffer.allocUnsafe(size);
  raw.writeUInt8(size, pos.next()); // structure length
  raw.writeUInt8(0x04, pos.next()); // TUNNEL_CONNECTION
  raw.writeUInt8(0x02, pos.next()); // TUNNEL_LINKLAYER
  raw.writeUInt8(0x00, pos.next()); // reserved
  return raw;
};

function channel(channelId: number) {
  const pos = new SmartCursor();
  const raw = Buffer.allocUnsafe(2);
  raw.writeUInt8(channelId, pos.next());
  raw.writeUInt8(0x00, pos.next()); // reserved
  return raw;
};

/**
 * Creates buffer of sequence counter, channel id and status code
 */
function seqnum(seqn: number, channelId: number, status = 0x00) {
  const size = 0x04;
  const pos = new SmartCursor();
  const raw = Buffer.allocUnsafe(size);
  raw.writeUInt8(size, pos.next()); // structure length
  raw.writeUInt8(channelId, pos.next()); // channelId
  raw.writeUInt8(seqn, pos.next()); // sequenceCounter
  raw.writeUInt8(status, pos.next()); // reserved or status
  return raw;
};

export const enum DataType {
  Uint8 = 1,
  Uint16 = 2,
  Uint32 = 4,
  Uint64 = 8,
  Uint128 = 16,
}

// ready to use messages

export function ack(seqn: number, channelId: number, status: number) {
  return message(Service.TunnelingAck, [
    seqnum(seqn, channelId, status),
  ]);
};

export function disconnect(channelId: number, respondTo: Hpai) {
  return message(Service.DisconnectRequest, [
    channel(channelId),
    hpai(respondTo.protocol, respondTo.ip, respondTo.port),
  ]);
};

export function ping(channelId: number, respondTo: Hpai) {
  return message(Service.ConnectionStateRequest, [
    channel(channelId),
    hpai(respondTo.protocol, respondTo.ip, respondTo.port),
  ]);
};

export function openTunnel({ receiveAt, respondTo }: {
  respondTo: Hpai;
  receiveAt: Hpai;
}) {
  return message(Service.ConnectRequest, [
    hpai(respondTo.protocol, respondTo.ip, respondTo.port),
    hpai(receiveAt.protocol, receiveAt.ip, receiveAt.port),
    tunneling(),
  ]);
};

export function write({ data, seqn, channelId, source, dest }: {
  data: Buffer | Uint8Array | number[];
  seqn: number;
  channelId: number;
  source: number;
  dest: number;
}) {
  if (data.length > DataType.Uint128) {
    // if data is longer than 16 bytes
    throw new Error(
      `Data is too long, expected maximum ${DataType.Uint128} bytes, got ${data.length}`);
  }
  // cemi
  const isUint6 = data.length === DataType.Uint8 && data[0] <= 0x3f;
  const size = isUint6 ? DataType.Uint8 : data.length + 1;
  const pos = new SmartCursor();
  const cemi = Buffer.alloc(0x0A + size);
  cemi.writeUInt8(0x11, pos.next()); // L_Data_req
  cemi.writeUInt8(0x00, pos.next()); // additional info length
  cemi.writeUInt8(0xbc, pos.next()); // control field 1
  cemi.writeUInt8(0xe0, pos.next()); // control field 2
  cemi.writeUInt16BE(source, pos.next(2)); // source address 0.0.0
  cemi.writeUInt16BE(dest, pos.next(2)); // destination address
  if (isUint6) {
    // data can be merged
    cemi.writeUInt8(size, pos.next()); // payload length
    cemi.writeUInt16BE(data[0] | 0x80, pos.next(2)); // 0x80 GROUPVALUE_WRITE
  } else {
    // data must be appended at the end
    cemi.writeUInt8(size, pos.next()); // payload length
    cemi.writeUInt16BE(0x80, pos.next(2)); // apci 0x80 GROUPVALUE_WRITE
    cemi.set(data, pos.next(size));
  }
  return message(Service.TunnelingRequest, [
    seqnum(seqn, channelId),
    cemi,
  ]);
};

export function read(params: {
  seqn: number;
  channelId: number;
  source: number;
  dest: number;
}) {
  // cemi
  const pos = new SmartCursor();
  const cemi = Buffer.alloc(0x0B);
  cemi.writeUInt8(0x11, pos.next()); // L_Data_req
  cemi.writeUInt8(0x00, pos.next()); // additional info length
  cemi.writeUInt8(0xbc, pos.next()); // control field 1
  cemi.writeUInt8(0xe0, pos.next()); // control field 2
  cemi.writeUInt16BE(params.source, pos.next(2)); // source address 0.0.0
  cemi.writeUInt16BE(params.dest, pos.next(2)); // destination address
  cemi.writeUInt8(0x01, pos.next()); // payload length
  cemi.writeUInt16BE(0x00, pos.next(2)); // 0x00 GROUPVALUE_READ
  return message(Service.TunnelingRequest, [
    seqnum(params.seqn, params.channelId),
    cemi,
  ]);
};
