#!/usr/bin/env node
import * as yargs from 'yargs';
import * as chalk from 'chalk';
import { BusListener } from '../dist/bus-listener';
import { num2knxAddr, isIPv4 } from '../dist/utils/index';
import { format as strFormat } from 'util';

const argv = yargs.usage('Usage $0 -s <ip address>')
  .demand(['server'])
  .alias('p', 'port')
  .alias('s', 'server')
  .alias('t', 'timeout')
  .default('port', 3671)
  .default('timeout', 0)
  .describe('server', 'Remote ip address')
  .describe('port', 'Remote port number')
  .describe('t', 'Seconds to retry, 0 - fail on first attemp')
  .help('help')
  .alias('h', 'help')
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
  .coerce('timeout', (timeout: string) => {
    return ((+timeout) >>> 0) * 1000;
  })
  .example('$0 -s 10.10.10.0', 'Will listen bus through 10.10.10.0 knx gateway')
  .epilog(strFormat('GitHub: %s', chalk.underline('https://github.com/crabicode/knx-listener')))
  .argv;

// tslint:disable-next-line:no-console
console.log(`Listening ${argv.server}:${argv.port}`);

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
};

const ok = (format: any, ...param: any[]) => {
  console.error(
    chalk.green(`[ OK ]`) + ` ${strFormat(format, ...param)}`,
  );
};

// Close tunneling on ctrl+c
process.on('SIGINT', die);

server.bind(argv.server, argv.port, {
  timeout: argv.timeout,
  onFailure: (err: Error & { code: string }) => {
    fail('Error ocurred while connecting %s', err.code);
  },
}).catch(die);

server.on('query', (query: any) => {
  const action = ((action) => {
    switch (action) {
      case 0x00: return 'read';
      case 0x40: return 'response';
      case 0x80: return 'write';
      default: return undefined;
    };
  })(query.action);
  if (action) {
    const knxaddr = num2knxAddr(query.dest);
    if (action === 'write' || action === 'response') {
      const data = Buffer.from(query.data)
        .toString('hex').match(/.{1,2}/g).join(':');
      ok('%s data %s to %s', action, data, knxaddr);
    }
    if (action === 'read') {
      ok('read %s', knxaddr);
    }
  }
});
