#!/usr/bin/env node
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import { isIPv4, knxAddr2num, isKnxAddress } from '../dist/utils/index';
import { BusListener } from '../dist/bus-listener';
import { format as strFormat } from 'util';

const argv = yargs.usage('Usage $0 -s <ip address> -g <group address> -d <XX:XX:..>')
  .demand(['server', 'groupAddress', 'data'])
  .alias('s', 'server')
  .alias('p', 'port')
  .alias('g', 'groupAddress')
  .alias('d', 'data')
  .alias('h', 'help')
  .default('port', 3671)
  .describe('data', 'Data to write')
  .describe('server', 'Remote ip address')
  .describe('port', 'Remote port number')
  .describe('groupAddress', 'Group address to issue the write telegram to')
  .coerce('server', (ip: string) => {
    if (!isIPv4(ip)) {
      throw new Error(`Invalid ip address ${ip}`);
    }
    return ip;
  })
  .coerce('data', (data: string) => {
    if (!/^([0-9A-Fa-f]{2})+([:][0-9A-Fa-f]{2})?$/.test(data)) {
      throw new Error(`Invalid data format ${data}`);
    }
    return data;
  })
  .coerce('port', (port: string) => {
    const portNumber = +port;
    if (portNumber < 0 || 65535 < portNumber) {
      throw new Error(`Invalid port number ${portNumber}`);
    }
    return portNumber;
  })
  .check((args) => {
    if (!isKnxAddress(args.groupAddress)) {
      throw new Error(`Invalid group address ${args.groupAddress}`);
    }
    return true;
  })
  .example('$0 -s 10.10.10.0 -g 0/0/1 -d 00:FF', 'Writes 0x00 0xFF to 0/0/1 through 10.10.10.0 knx gateway')
  .epilog(strFormat('GitHub: %s', chalk.underline('https://github.com/crabicode/knx-listener')))
  .help('help').argv;

const server = new BusListener();

const die = () => {
  return server.disconnect().then(
    () => process.exit(),
    () => process.exit(),
  );
};

const fail = (format: any, ...param: any[]) => {
  console.error(
    chalk.red(`[ FAIL ]`) + ` ${strFormat(format, ...param)}`,
  );
  die();
};

const ok = (format: any, ...param: any[]) => {
  console.error(
    chalk.green(`[ OK ]`) + ` ${strFormat(format, ...param)}`,
  );
  // schedule die next cycle
  setImmediate(die);
};

process.on('SIGINT', die); // Close tunneling on ctrl+c

server.bind(argv.server, argv.port).catch((err) => {
  fail('Failed to send request to %s:%d due to %s', argv.server, argv.port, err.code);
});

server.ready(() => {
  const data = Buffer.from(argv.data.split(':').map(i => parseInt(i, 16)));
  server.write(data, knxAddr2num(argv.groupAddress)).then(() => {
    ok(`Sent %s to %s`, argv.data, argv.groupAddress);
  }).catch((_err) => {
    fail(`Failed to write %s to %s`,
      argv.data, argv.groupAddress);
  });
});
