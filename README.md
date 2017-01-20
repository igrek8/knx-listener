# KNX Listener
A thin client to monitor, write and read telegrams through KNX gateway

[![npm version](https://badge.fury.io/js/knx-listener.svg)](https://badge.fury.io/js/knx-listener) [![npm](https://img.shields.io/npm/l/express.svg)]()

## Install
```
npm install --save knx-listener
```
## Remote access to the knx net
### Monitor telegrams
```
Usage bin/busmonitor.js -s <ip address>

Options:
  -t, --timeout  Seconds to retry, 0 - fail on first attemp         [default: 0]
  -p, --port     Remote port number                              [default: 3671]
  -s, --server   Remote ip address                                    [required]
  -h, --help     Show help                                             [boolean]
```
```
node bin/busmonitor -s 192.168.0.100
```
![](http://i.giphy.com/26xBuNRYG1nGUnj3O.gif)

### Write value `1` to `0/0/1` through `192.168.0.100`
```
Usage bin/groupswrite.js -s <ip address> -g <group address> -d <XX:XX:..>

Options:
  -s, --server        Remote ip address                               [required]
  -p, --port          Remote port number                         [default: 3671]
  -g, --groupAddress  Group address to issue the write telegram to    [required]
  -d, --data          Data to write                                   [required]
  -h, --help          Show help                                        [boolean]
```
```
node bin/groupswrite -s 192.168.1.100 -g 0/0/1 -d 01
```
![](http://i.giphy.com/26xBvwQEv3gKYdRp6.gif)

### Read value from `0/0/1` through `192.168.0.100`
```
Usage bin/groupsread.js -s <ip address> -g <group address>

Options:
  -s, --server        Remote ip address                               [required]
  -p, --port          Remote port number                         [default: 3671]
  -g, --groupAddress  Group address to issue the read telegram to     [required]
  -h, --help          Show help                                        [boolean]
```
```
node bin/groupsread -s 192.168.0.100 -g 0/0/1
```
![](http://i.giphy.com/l3q2Yr9ZgyRYYQBva.gif)

## Development use cases
```js
const KnxListener = require("knx-listener");

// 1. Initialize bus listener
const client = new KnxListener.BusListener();

// helper to terminate tunnel
const die = () => {
  return client.disconnect().then(
    () => process.exit(),
    () => process.exit(),
  );
};

// 2. Establish tunneling with recovery time of 1s
client.bind("192.168.1.105", 3671, {
  timeout: 1000,
});

// 3. Print processed queries to the console
client.on("query", console.log);

client.ready(() => {
  // 4. When connection is established
  // 5. Send read telegram and receive response with data
  client.read(KnxListener.utils.knxAddr2num("0/0/1")).then((res) => {
    console.log("Remote responded with", res);
  }, (err) => {
    console.error("Request failed", err);
  });
  // 6. Send write telegram with data 0xFF to the group address 0/0/2
  client.write([0xFF], KnxListener.utils.knxAddr2num("0/0/2")).then(() => {
    console.log("Success");
  }, (err) => {
    console.error("Request failed", err);
  });
});

// ctrl+c to exit
process.on('SIGINT', die);
```

## TODO
* Generate `JSDoc`
* Integration testing
* Create another npm module for data types decoding
* Create `REST API` with `express`
* Create stream using websockets to broadcast telegrams to rich web apps
* Create `ETS` project parser to get

## What is next?
* You may record telegrams to a database and `return last values` on demand
* You may build visualization with any `KNX gateway`
* You may delagate decoding of data to your `thick` clients (rich & mobile apps)
