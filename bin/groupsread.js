#!/usr/bin/env node
"use strict";
const chalk = require("chalk");
const yargs = require("yargs");
const index_1 = require("../dist/utils/index");
const bus_listener_1 = require("../dist/bus-listener");
const util_1 = require("util");
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
    .coerce('server', (ip) => {
    if (!index_1.isIPv4(ip)) {
        throw new Error(`Invalid ip address ${ip}`);
    }
    return ip;
})
    .coerce('port', (port) => {
    const portNumber = +port;
    if (portNumber < 0 || 65535 < portNumber) {
        throw new Error(`Invalid port number ${portNumber}`);
    }
    return portNumber;
})
    .check((args) => {
    if (!index_1.isKnxAddress(args.groupAddress)) {
        throw new Error(`Invalid group address ${args.groupAddress}`);
    }
    return true;
})
    .example('$0 -s 10.10.10.0 -g 0/0/1', 'Will send read telegram to 0/0/1 group address on 10.10.10.0 knx gateway')
    .epilog(util_1.format('GitHub: %s', chalk.underline('https://github.com/crabicode/knx-listener')))
    .help('help').argv;
const server = new bus_listener_1.BusListener();
const die = () => {
    return server.disconnect().then(() => process.exit(), () => process.exit());
};
const fail = (format, ...param) => {
    console.error(chalk.red(`[ FAIL ]`) + ` ${util_1.format(format, ...param)}`);
    die();
};
const ok = (format, ...param) => {
    console.error(chalk.green(`[ OK ]`) + ` ${util_1.format(format, ...param)}`);
    die();
};
process.on('SIGINT', die);
server.bind(argv.server, argv.port).catch((err) => {
    fail('Failed to send request to %s:%d due to %s', argv.server, argv.port, err.code);
});
server.ready(() => {
    server.read(index_1.knxAddr2num(argv.groupAddress)).then((res) => {
        const responder = index_1.num2knxAddr(res.source, false);
        const ga = index_1.num2knxAddr(res.dest);
        const data = Buffer.from([...res.data]).toString('hex').match(/.{1,2}/g).join(' ');
        ok('%s responds to %s with %s data', responder, ga, data);
        setImmediate(() => {
            server.disconnect();
        });
    }).catch((_err) => {
        fail(`No response received for read telegram to %s`, chalk.underline(argv.groupAddress));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXBzcmVhZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdyb3Vwc3JlYWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwrQkFBK0I7QUFDL0IsK0JBQStCO0FBQy9CLCtDQUFxRjtBQUNyRix1REFBbUQ7QUFDbkQsK0JBQTJDO0FBRTNDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsNkNBQTZDLENBQUM7S0FDcEUsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQ2xDLEtBQUssQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDO0tBQ3BCLEtBQUssQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDO0tBQ2xCLEtBQUssQ0FBQyxHQUFHLEVBQUUsY0FBYyxDQUFDO0tBQzFCLEtBQUssQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDO0tBQ2xCLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDO0tBQ3JCLFFBQVEsQ0FBQyxRQUFRLEVBQUUsbUJBQW1CLENBQUM7S0FDdkMsUUFBUSxDQUFDLE1BQU0sRUFBRSxvQkFBb0IsQ0FBQztLQUN0QyxRQUFRLENBQUMsY0FBYyxFQUFFLDZDQUE2QyxDQUFDO0tBQ3ZFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFVO0lBQzNCLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFDRCxNQUFNLENBQUMsRUFBRSxDQUFDO0FBQ1osQ0FBQyxDQUFDO0tBQ0QsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQVk7SUFDM0IsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUM7SUFDekIsRUFBRSxDQUFDLENBQUMsVUFBVSxHQUFHLENBQUMsSUFBSSxLQUFLLEdBQUcsVUFBVSxDQUFDLENBQUMs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QU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN0QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUk7UUFDWixJQUFJLENBQUMsOENBQThDLEVBQ2pELEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDeEMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAqIGFzIGNoYWxrIGZyb20gJ2NoYWxrJztcbmltcG9ydCAqIGFzIHlhcmdzIGZyb20gJ3lhcmdzJztcbmltcG9ydCB7IGlzSVB2NCwga254QWRkcjJudW0sIG51bTJrbnhBZGRyLCBpc0tueEFkZHJlc3MgfSBmcm9tICcuLi9kaXN0L3V0aWxzL2luZGV4JztcbmltcG9ydCB7IEJ1c0xpc3RlbmVyIH0gZnJvbSAnLi4vZGlzdC9idXMtbGlzdGVuZXInO1xuaW1wb3J0IHsgZm9ybWF0IGFzIHN0ckZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuXG5jb25zdCBhcmd2ID0geWFyZ3MudXNhZ2UoJ1VzYWdlICQwIC1zIDxpcCBhZGRyZXNzPiAtZyA8Z3JvdXAgYWRkcmVzcz4nKVxuICAuZGVtYW5kKFsnc2VydmVyJywgJ2dyb3VwQWRkcmVzcyddKVxuICAuYWxpYXMoJ3MnLCAnc2VydmVyJylcbiAgLmFsaWFzKCdwJywgJ3BvcnQnKVxuICAuYWxpYXMoJ2cnLCAnZ3JvdXBBZGRyZXNzJylcbiAgLmFsaWFzKCdoJywgJ2hlbHAnKVxuICAuZGVmYXVsdCgncG9ydCcsIDM2NzEpXG4gIC5kZXNjcmliZSgnc2VydmVyJywgJ1JlbW90ZSBpcCBhZGRyZXNzJylcbiAgLmRlc2NyaWJlKCdwb3J0JywgJ1JlbW90ZSBwb3J0IG51bWJlcicpXG4gIC5kZXNjcmliZSgnZ3JvdXBBZGRyZXNzJywgJ0dyb3VwIGFkZHJlc3MgdG8gaXNzdWUgdGhlIHJlYWQgdGVsZWdyYW0gdG8nKVxuICAuY29lcmNlKCdzZXJ2ZXInLCAoaXA6IHN0cmluZykgPT4ge1xuICAgIGlmICghaXNJUHY0KGlwKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGlwIGFkZHJlc3MgJHtpcH1gKTtcbiAgICB9XG4gICAgcmV0dXJuIGlwO1xuICB9KVxuICAuY29lcmNlKCdwb3J0JywgKHBvcnQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBvcnROdW1iZXIgPSArcG9ydDtcbiAgICBpZiAocG9ydE51bWJlciA8IDAgfHwgNjU1MzUgPCBwb3J0TnVtYmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcG9ydCBudW1iZXIgJHtwb3J0TnVtYmVyfWApO1xuICAgIH1cbiAgICByZXR1cm4gcG9ydE51bWJlcjtcbiAgfSlcbiAgLmNoZWNrKChhcmdzKSA9PiB7XG4gICAgaWYgKCFpc0tueEFkZHJlc3MoYXJncy5ncm91cEFkZHJlc3MpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZ3JvdXAgYWRkcmVzcyAke2FyZ3MuZ3JvdXBBZGRyZXNzfWApO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSlcbiAgLmV4YW1wbGUoJyQwIC1zIDEwLjEwLjEwLjAgLWcgMC8wLzEnLCAnV2lsbCBzZW5kIHJlYWQgdGVsZWdyYW0gdG8gMC8wLzEgZ3JvdXAgYWRkcmVzcyBvbiAxMC4xMC4xMC4wIGtueCBnYXRld2F5JylcbiAgLmVwaWxvZyhzdHJGb3JtYXQoJ0dpdEh1YjogJXMnLCBjaGFsay51bmRlcmxpbmUoJ2h0dHBzOi8vZ2l0aHViLmNvbS9jcmFiaWNvZGUva254LWxpc3RlbmVyJykpKVxuICAuaGVscCgnaGVscCcpLmFyZ3Y7XG5cbmNvbnN0IHNlcnZlciA9IG5ldyBCdXNMaXN0ZW5lcigpO1xuXG5jb25zdCBkaWUgPSAoKSA9PiB7XG4gIHJldHVybiBzZXJ2ZXIuZGlzY29ubmVjdCgpLnRoZW4oXG4gICAgKCkgPT4gcHJvY2Vzcy5leGl0KCksXG4gICAgKCkgPT4gcHJvY2Vzcy5leGl0KCksXG4gICk7XG59O1xuXG5jb25zdCBmYWlsID0gKGZvcm1hdDogYW55LCAuLi5wYXJhbTogYW55W10pID0+IHtcbiAgY29uc29sZS5lcnJvcihcbiAgICBjaGFsay5yZWQoYFsgRkFJTCBdYCkgKyBgICR7c3RyRm9ybWF0KGZvcm1hdCwgLi4ucGFyYW0pfWAsXG4gICk7XG4gIGRpZSgpO1xufTtcblxuY29uc3Qgb2sgPSAoZm9ybWF0OiBhbnksIC4uLnBhcmFtOiBhbnlbXSkgPT4ge1xuICBjb25zb2xlLmVycm9yKFxuICAgIGNoYWxrLmdyZWVuKGBbIE9LIF1gKSArIGAgJHtzdHJGb3JtYXQoZm9ybWF0LCAuLi5wYXJhbSl9YCxcbiAgKTtcbiAgZGllKCk7XG59O1xuXG5wcm9jZXNzLm9uKCdTSUdJTlQnLCBkaWUpOyAvLyBDbG9zZSB0dW5uZWxpbmcgb24gY3RybCtjXG5cbnNlcnZlci5iaW5kKGFyZ3Yuc2VydmVyLCBhcmd2LnBvcnQpLmNhdGNoKChlcnIpID0+IHtcbiAgZmFpbCgnRmFpbGVkIHRvIHNlbmQgcmVxdWVzdCB0byAlczolZCBkdWUgdG8gJXMnLCBhcmd2LnNlcnZlciwgYXJndi5wb3J0LCBlcnIuY29kZSk7XG59KTtcblxuc2VydmVyLnJlYWR5KCgpID0+IHtcbiAgc2VydmVyLnJlYWQoa254QWRkcjJudW0oYXJndi5ncm91cEFkZHJlc3MpKS50aGVuKChyZXMpID0+IHtcbiAgICBjb25zdCByZXNwb25kZXIgPSBudW0ya254QWRkcihyZXMuc291cmNlLCBmYWxzZSk7XG4gICAgY29uc3QgZ2EgPSBudW0ya254QWRkcihyZXMuZGVzdCk7XG4gICAgY29uc3QgZGF0YSA9IEJ1ZmZlci5mcm9tKFsuLi5yZXMuZGF0YV0pLnRvU3RyaW5nKCdoZXgnKS5tYXRjaCgvLnsxLDJ9L2cpLmpvaW4oJyAnKTtcbiAgICBvaygnJXMgcmVzcG9uZHMgdG8gJXMgd2l0aCAlcyBkYXRhJywgcmVzcG9uZGVyLCBnYSwgZGF0YSk7XG4gICAgc2V0SW1tZWRpYXRlKCgpID0+IHtcbiAgICAgIC8vIHNjaGVkdWxlIGRpc2Nvbm5lY3Qgb24gdGhlIG5leHQgZXZlbnQgY3ljbGVcbiAgICAgIHNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfSk7XG4gIH0pLmNhdGNoKChfZXJyKSA9PiB7XG4gICAgZmFpbChgTm8gcmVzcG9uc2UgcmVjZWl2ZWQgZm9yIHJlYWQgdGVsZWdyYW0gdG8gJXNgLFxuICAgICAgY2hhbGsudW5kZXJsaW5lKGFyZ3YuZ3JvdXBBZGRyZXNzKSk7XG4gIH0pO1xufSk7XG4iXX0=