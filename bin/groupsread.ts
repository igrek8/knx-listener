#!/usr/bin/env node
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import { isIPv4, knxAddr2num, num2knxAddr, isKnxAddress } from '../dist/utils/index';
import { BusListener } from '../dist/bus-listener';
import { format as strFormat } from 'util';

const argv = yargs.usage('Usage $0 -s <ip address> -g <group address>')
  .demand(['server', 'groupAddress'])
  .alias('s', 'server')
  .alias('p', 'port')
  .alias('g', 'groupAddress')
  .alias('h', 'help')
  .default('port', 3671)
  .describe('server', 'Remote ip address')
  .describe('port', 'Remote port number')
  .describe('groupAddress', 'Group address to issue the read telegram to')
  .coerce('server', (ip: string) => {
    if (!isIPv4(ip)) {
      throw new Error(`Invalid ip address ${ip}`);
    }
    return ip;
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
  .example('$0 -s 10.10.10.0 -g 0/0/1', 'Will send read telegram to 0/0/1 group address on 10.10.10.0 knx gateway')
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
  die();
};

process.on('SIGINT', die); // Close tunneling on ctrl+c

server.bind(argv.server, argv.port).catch((err) => {
  fail('Failed to send request to %s:%d due to %s', argv.server, argv.port, err.code);
});

server.ready(() => {
  server.read(knxAddr2num(argv.groupAddress)).then((res) => {
    const responder = num2knxAddr(res.source, false);
    const ga = num2knxAddr(res.dest);
    const data = Buffer.from([...res.data]).toString('hex').match(/.{1,2}/g).join(' ');
    ok('%s responds to %s with %s data', responder, ga, data);
    setImmediate(() => {
      // schedule disconnect on the next event cycle
      server.disconnect();
    });
  }).catch((_err) => {
    fail(`No response received for read telegram to %s`,
      chalk.underline(argv.groupAddress));
  });
});
