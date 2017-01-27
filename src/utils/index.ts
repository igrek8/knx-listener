import { networkInterfaces } from 'os';

export function ip2num(ipString: string) {
  const ipNumber = ipString.split('.');
  return ((((((+ipNumber[0]) * 256) + (+ipNumber[1])) * 256) + (+ipNumber[2])) * 256) + (+ipNumber[3]);
}

export function num2ip(ipNumber: number) {
  let ipString = (ipNumber % 256).toString();
  for (let i = 3; i > 0; i--) {
    ipNumber = Math.floor(ipNumber / 256);
    ipString = ipNumber % 256 + '.' + ipString;
  }
  return ipString;
}

export function num2mac(macNumber: number) {
  return String(1e12 + (macNumber)
    .toString(16)).slice(-12).match(/.{1,2}/g).join(':');
}

export function mac2num(macString: string) {
  return parseInt(macString.split(':').join(''), 16);
}

export function getCurrentIp() {
  const ifaces = networkInterfaces();
  for (const dev in ifaces) {
    for (const details of ifaces[dev]) {
      if (details.family === 'IPv4' && details.internal === false) {
        return details.address;
      }
    }
  }
  throw new Error('Failed to get current ip');
}

export function sizeOf(value: number) {
  return Math.ceil(Math.log2(value + 1) / 4) || 1;
}

export function knxAddr2num(addrStr: string) {
  const m = addrStr.split(/[\.\/]/);
  if (m && m.length > 0) {
    return (((+m[0]) & 0x01f) << 11) + (((+m[1]) & 0x07) << 8) + ((+m[2]) & 0xff);
  }
  throw Error(`Could not encode ${addrStr} address`);
}

export function num2knxAddr(addrNum: number, isGroupAddr = true) {
  return [
    (addrNum >> 11) & 0xf,
    isGroupAddr ? (addrNum >> 8) & 0x7 : (addrNum >> 8) & 0xf,
    (addrNum & 0xff)].join(isGroupAddr ? '/' : '.');
}

export function removeNonPrintable(str: string) {
  return str.replace(/[^\x20-\x7E]+/g, '');
}

export function noop(..._: any[]): any { }

export function isIPv4(ipStr: string) {
  return /(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/
    .test(ipStr);
}

export function isKnxAddress(knxStrAddr: string, isGroupAddress = true) {
  if (isGroupAddress) {
    // group address 1/1/1
    return /^(3[01]|([0-2]?[0-9]))\/(([0-7]\/(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))|(([01]?\d{1,3})|(20[0-4][0-7])))$/
      .test(knxStrAddr);
  } else {
    // individual address 1.1.15
    return /^([01]?\d)\.([01]?\d)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9])?$/.test(knxStrAddr);
  }
}
