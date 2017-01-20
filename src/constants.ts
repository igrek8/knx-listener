import {
  getCurrentIp,
  ip2num,
} from './utils/index';

export const enum Service {
  ConnectRequest = 0x205,
  ConnectResponse = 0x206,
  ConnectionStateRequest = 0x207,
  ConnectStateResponse = 0x208,
  DisconnectRequest = 0x209,
  DisconnectResponse = 0x20a,
  TunnelingAck = 0x421,
  TunnelingRequest = 0x420,
}

export const enum Protocol {
  Udp4 = 0x01,
  Tcp4 = 0x02,
};

export const enum Connection {
  Tunnel = 0x4,
};

export const enum Status {
  ConnectionId = 0x21,
  ConnectionOption = 0x23,
  ConnectionType = 0x22,
  DataConnection = 0x26,
  HostProtocolType = 0x1,
  KnxConnection = 0x27,
  NoError = 0x0,
  NoMoreConnections = 0x24,
  SequenceNumber = 0x4,
  TunnelingLayer = 0x29,
  VersionNotSupported = 0x2,
}

export const enum BusEvent {
  GroupRead = 0x0,
  GroupResponse = 0x40,
  GroupWrite = 0x80,
}

export const MyIp = getCurrentIp();

export const MyIpNumber = ip2num(MyIp);
