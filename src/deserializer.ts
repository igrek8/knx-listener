import {
  Connection,
  BusEvent,
} from './constants';
import {
  SmartCursor,
} from './utils/smart-cursor';
import {
  Channel,
  Header,
  Hpai,
} from './interfaces';

export function header(raw: Buffer, pos: SmartCursor): Header {
  const headerLength = raw.readUInt8(pos.next());
  const protocolVersion = raw.readUInt8(pos.next());
  const serviceId = raw.readUInt16BE(pos.next(2));
  const totalLength = raw.readUInt16BE(pos.next(2));
  if (headerLength !== 0x06) {
    throw new Error(`Invalid header length ${headerLength}`);
  }
  if (protocolVersion !== 0x10) {
    throw new Error(`Invalid protocol version ${protocolVersion}`);
  }
  if (raw.length !== totalLength) {
    throw new Error(`Invalid total length, expected ${raw.length}, but got ${totalLength}`);
  }
  return {
    serviceId,
  };
};

export function channel(raw: Buffer, pos: SmartCursor): Channel {
  const channelId = raw.readUInt8(pos.next());
  const status = raw.readUInt8(pos.next());
  if (channelId === 0) {
    throw new Error(`Invalid channel id ${channelId}`);
  }
  return {
    channelId, status,
  };
};

export function hpai(raw: Buffer, pos: SmartCursor): Hpai {
  const size = raw.readUInt8(pos.next());
  if (size !== 0x8) {
    throw new Error(`Failed to read hpai at ${pos.cur}`);
  }
  const protocol = raw.readUInt8(pos.next());
  const ip = raw.readUIntBE(pos.next(4), 4);
  const port = raw.readInt16BE(pos.next(2));
  return {
    ip, port, protocol,
  };
};

export function connectResponse(raw: Buffer, pos: SmartCursor) {
  const size = raw.readInt8(pos.next());
  const contype = raw.readInt8(pos.next());
  switch (contype) {
    case Connection.Tunnel: {
      if (size !== 0x4) {
        throw new Error(`Failed to read connect response for tunneling at ${pos.cur}`);
      }
      const knxAddress = raw.readUInt16BE(pos.next(2));
      return {
        connectionType: contype,
        knxAddress,
      };
    }
    default: throw new Error(`Unknown connection type ${contype}`);
  }
};

export function seqnum(raw: Buffer, pos: SmartCursor) {
  const size = raw.readUInt8(pos.next());
  if (size !== 0x4) {
    throw new Error(`Failed to read structure at ${pos.cur}`);
  }
  const channelId = raw.readUInt8(pos.next());
  const seqn = raw.readInt8(pos.next());
  const status = raw.readUInt8(pos.next());
  return {
    channelId, seqn, status,
  };
};

export function tunnelCemi(raw: Buffer, pos: SmartCursor) {
  pos.skip('messageCode');
  const additionalInfoLength = raw.readUInt8(pos.next());
  if (additionalInfoLength) {
    pos.skip('additionalInfo', additionalInfoLength);
  }
  pos.skip('controlField1');
  pos.skip('controlField2');
  const source = raw.readUInt16BE(pos.next(2));
  const dest = raw.readUInt16BE(pos.next(2));
  const npduLength = raw.readUInt8(pos.next());
  const apdu = raw.readUInt16BE(pos.next(2));
  const action = apdu & (BusEvent.GroupWrite |
    BusEvent.GroupResponse | BusEvent.GroupRead);
  if (action & (BusEvent.GroupWrite | BusEvent.GroupResponse)) {
    let data: Uint8Array;
    if (npduLength > 1) {
      // data appended
      data = raw.subarray(pos.next(npduLength), pos.cur);
    } else {
      // data merged into 6 bits
      data = new Uint8Array([apdu & 0x3f]);
    }
    return {
      data, action, dest, source,
    };
  } else {
    // read
    return {
      action, dest, source,
    };
  }
};
