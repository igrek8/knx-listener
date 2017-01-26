export declare const enum Service {
    ConnectRequest = 517,
    ConnectResponse = 518,
    ConnectionStateRequest = 519,
    ConnectStateResponse = 520,
    DisconnectRequest = 521,
    DisconnectResponse = 522,
    TunnelingAck = 1057,
    TunnelingRequest = 1056,
}
export declare const enum Protocol {
    Udp4 = 1,
    Tcp4 = 2,
}
export declare const enum Connection {
    Tunnel = 4,
}
export declare const enum Status {
    ConnectionId = 33,
    ConnectionOption = 35,
    ConnectionType = 34,
    DataConnection = 38,
    HostProtocolType = 1,
    KnxConnection = 39,
    NoError = 0,
    NoMoreConnections = 36,
    SequenceNumber = 4,
    TunnelingLayer = 41,
    VersionNotSupported = 2,
}
export declare const enum BusEvent {
    GroupRead = 0,
    GroupResponse = 64,
    GroupWrite = 128,
}
export declare const MyIp: string;
export declare const MyIpNumber: number;
