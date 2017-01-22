"use strict";
const serializer_1 = require("./serializer");
const query_manager_1 = require("./query-manager");
const constants_1 = require("./constants");
class BusListener {
    constructor() {
        this.sequenceIds = new Set();
        this.qmanager = new query_manager_1.QueryManager();
    }
    /**
     * Initializes tunneling. It is `never-resolving` promise
     */
    bind(remoteHost, remotePort, { timeout, onFailure, } = {}) {
        return this.qmanager.connect().then((sock) => {
            this.controlPoint = {
                ip: constants_1.MyIpNumber,
                protocol: 1 /* Udp4 */,
                port: sock.port,
            };
            return this.openTunnel(remoteHost, remotePort).then((response) => {
                // when tunneling is open, store important info
                this.source = response.knxAddress;
                this.channelId = response.channelId;
                this.remoteHost = remoteHost;
                this.remotePort = remotePort;
                // begin heartbeat to the remote host
                return this.startHeartbeat();
            });
        }).catch((err) => {
            if (typeof onFailure === 'function') {
                onFailure(err);
            }
            this.stopHeartbeat();
            if (timeout) {
                // cast number to uint
                timeout = timeout >>> 0;
                // schedule retry in `timeout` seconds
                return new Promise((resolve) => setTimeout(resolve, timeout).unref()).then(() => {
                    // call to reconnect
                    return this.bind(remoteHost, remotePort, {
                        timeout, onFailure,
                    });
                });
            }
            else {
                // if no timeout, then propagate error to the caller
                throw err;
            }
        });
    }
    /**
     * returns promise, which indicates socket close
     */
    complete(cb) {
        return this.qmanager.complete(cb);
    }
    isConnected() {
        return this.heartbeatInterval ? true : false;
    }
    /**
     * ready return promises, which only resolves when tunnel is connected
     */
    ready(cb) {
        return new Promise((resolve) => {
            if (this.isConnected()) {
                resolve(typeof cb === 'function' ? cb() : undefined);
            }
            else {
                const interval = setInterval(() => {
                    if (this.isConnected()) {
                        // when connected, clear interval
                        clearInterval(interval);
                        resolve(typeof cb === 'function' ? cb() : undefined);
                    }
                }, 0);
                const ref = this.qmanager.on('disconnect', () => {
                    // when disconnect scheduled
                    clearInterval(interval);
                    ref.unsubscribe();
                });
                interval.unref(); // let node exit
            }
        });
    }
    /**
     * Generates next sequence number to number each knx telegram
     */
    nextSeqn() {
        let id = 0;
        while (this.sequenceIds.has(id)) {
            if (id++ >= 0xFF) {
                throw new Error('Maximum sequence number reached');
            }
        }
        this.sequenceIds.add(id);
        return id;
    }
    /**
     * Verifies if the sender the one this tunneling was initially bound to
     */
    isSameOrigin(res, sender) {
        return res.channelId === this.channelId &&
            sender.address === this.remoteHost &&
            sender.port === this.remotePort &&
            sender.family === 'IPv4';
    }
    /**
     * Sends data to the bus
     */
    write(data, groupAddress) {
        const seqn = this.nextSeqn();
        const req = serializer_1.write({
            data, seqn,
            channelId: this.channelId,
            dest: groupAddress,
            source: this.source,
        });
        return this.qmanager.request(this.remoteHost, this.remotePort, req, (res, sender) => {
            return res.seqn === seqn && this.isSameOrigin(res, sender);
        }).then((res) => {
            // always free used sequence number
            this.sequenceIds.delete(seqn);
            return res;
        }, (err) => {
            // always free used sequence number
            this.sequenceIds.delete(seqn);
            throw err;
        });
    }
    /**
     * Sends read request, which will only be resolved when response event received
     */
    read(groupAddress) {
        const seqn = this.nextSeqn();
        const req = serializer_1.read({
            seqn,
            channelId: this.channelId,
            dest: groupAddress,
            source: this.source,
        });
        return this.qmanager.request(this.remoteHost, this.remotePort, req, (res, sender) => {
            return res.dest === groupAddress &&
                res.action === 64 /* GroupResponse */ &&
                this.isSameOrigin(res, sender);
        }).then((res) => {
            // always free used sequence number
            this.sequenceIds.delete(seqn);
            return res;
        }, (err) => {
            // always free used sequence number
            this.sequenceIds.delete(seqn);
            throw err;
        });
    }
    /**
     * Terminates tunneling
     */
    disconnect(cb) {
        const req = serializer_1.disconnect(this.channelId, this.controlPoint);
        return this.qmanager.request(this.remoteHost, this.remotePort, req, (res, remote) => {
            return this.isSameOrigin(res, remote);
        }).then(() => {
            // when disconnecting, we stop heartbeating
            this.stopHeartbeat();
            return this.qmanager.disconnect(cb);
        });
    }
    /**
     * Pings remote to verify if the channel is still active
     */
    startHeartbeat() {
        const req = serializer_1.ping(this.channelId, this.controlPoint);
        return new Promise((_resolve, reject) => {
            // check connection with the first ping
            return this.ping(req).then(() => {
                // indicate that tunnel is ready
                // if it is successfull, then begin heartbeat every 60s
                this.heartbeatInterval = setInterval(() => {
                    this.ping(req).catch(reject);
                }, 60000);
                // let node exit without waiting the interval
                this.heartbeatInterval.unref();
            }).catch(reject);
        });
    }
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            // stop heartbeat if started
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }
    }
    /**
     * Send ping
     */
    ping(req) {
        return this.qmanager.request(this.remoteHost, this.remotePort, req, (res, remote) => {
            return this.isSameOrigin(res, remote);
        }, 5000);
    }
    /**
     * Request tunneling
     */
    openTunnel(host, port) {
        const q = serializer_1.openTunnel({
            receiveAt: this.controlPoint,
            respondTo: this.controlPoint,
        });
        return this.qmanager.request(host, port, q, (res, sender) => {
            return sender.address === host &&
                sender.family === 'IPv4' &&
                sender.port === port &&
                res.serviceId === 518 /* ConnectResponse */ &&
                res.connectionType === 4 /* Tunnel */;
        });
    }
    on(event, cb) {
        return this.qmanager.on(event, cb);
    }
}
exports.BusListener = BusListener;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVzLWxpc3RlbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2J1cy1saXN0ZW5lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsNkNBTXNCO0FBVXRCLG1EQUV5QjtBQU96QiwyQ0FFcUI7QUFLckI7SUFTRTtRQUNFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksNEJBQVksRUFBRSxDQUFDO0lBQ3JDLENBQUM7SUFDRDs7T0FFRztJQUNJLElBQUksQ0FBQyxVQUFrQixFQUFFLFVBQWtCLEVBQUUsRUFDbEQsT0FBTyxFQUFFLFNBQVMsTUFDd0MsRUFBRTtRQUM1RCxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJO1lBQ3ZDLElBQUksQ0FBQyxZQUFZLEdBQUc7Z0JBQ2xCLEVBQUUsRUFBRSxzQkFBVTtnQkFDZCxRQUFRLEVBQUUsWUFBYTtnQkFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2FBQ2hCLENBQUM7WUFDRixNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUTtnQkFDM0QsK0NBQStDO2dCQUMvQyxJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7Z0JBQzdCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO2dCQUM3QixxQ0FBcUM7Z0JBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDL0IsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMs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SUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7Q0FDRjtBQTFPRCxrQ0EwT0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBkaXNjb25uZWN0LFxuICByZWFkLFxuICBvcGVuVHVubmVsLFxuICBwaW5nLFxuICB3cml0ZSxcbn0gZnJvbSAnLi9zZXJpYWxpemVyJztcbmltcG9ydCB7XG4gIERpc2Nvbm5lY3RSZXBvbnNlLFxuICBDaGFubmVsLFxuICBDb25uZWN0UmVzcG9uc2VUdW5uZWwsXG4gIFR1bm5lbGluZ0FjayxcbiAgR3JvdXBSZXNwb25zZSxcbiAgSHBhaSxcbiAgU3Vic2NyaWJlcixcbn0gZnJvbSAnLi9pbnRlcmZhY2VzJztcbmltcG9ydCB7XG4gIFF1ZXJ5TWFuYWdlcixcbn0gZnJvbSAnLi9xdWVyeS1tYW5hZ2VyJztcbmltcG9ydCB7XG4gIFNlcnZpY2UsXG4gIFByb3RvY29sLFxuICBDb25uZWN0aW9uLFxuICBCdXNFdmVudCxcbn0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHtcbiAgTXlJcE51bWJlcixcbn0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHtcbiAgQWRkcmVzc0luZm8sXG59IGZyb20gJ2RncmFtJztcblxuZXhwb3J0IGNsYXNzIEJ1c0xpc3RlbmVyIHtcbiAgcHJvdGVjdGVkIHNlcXVlbmNlSWRzOiBTZXQ8bnVtYmVyPjtcbiAgcHJvdGVjdGVkIHFtYW5hZ2VyOiBRdWVyeU1hbmFnZXI7XG4gIHByb3RlY3RlZCBjb250cm9sUG9pbnQ6IEhwYWk7XG4gIHByb3RlY3RlZCBoZWFydGJlYXRJbnRlcnZhbDogTm9kZUpTLlRpbWVyO1xuICBwcm90ZWN0ZWQgc291cmNlOiBudW1iZXI7XG4gIHByb3RlY3RlZCByZW1vdGVIb3N0OiBzdHJpbmc7XG4gIHByb3RlY3RlZCByZW1vdGVQb3J0OiBudW1iZXI7XG4gIHByb3RlY3RlZCBjaGFubmVsSWQ6IG51bWJlcjtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5zZXF1ZW5jZUlkcyA9IG5ldyBTZXQoKTtcbiAgICB0aGlzLnFtYW5hZ2VyID0gbmV3IFF1ZXJ5TWFuYWdlcigpO1xuICB9XG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyB0dW5uZWxpbmcuIEl0IGlzIGBuZXZlci1yZXNvbHZpbmdgIHByb21pc2VcbiAgICovXG4gIHB1YmxpYyBiaW5kKHJlbW90ZUhvc3Q6IHN0cmluZywgcmVtb3RlUG9ydDogbnVtYmVyLCB7XG4gICAgdGltZW91dCwgb25GYWlsdXJlLFxuICB9OiB7IHRpbWVvdXQ/OiBudW1iZXIsIG9uRmFpbHVyZT86IChlcnI6IEVycm9yKSA9PiB2b2lkIH0gPSB7fSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMucW1hbmFnZXIuY29ubmVjdCgpLnRoZW4oKHNvY2spID0+IHtcbiAgICAgIHRoaXMuY29udHJvbFBvaW50ID0ge1xuICAgICAgICBpcDogTXlJcE51bWJlcixcbiAgICAgICAgcHJvdG9jb2w6IFByb3RvY29sLlVkcDQsXG4gICAgICAgIHBvcnQ6IHNvY2sucG9ydCxcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5vcGVuVHVubmVsKHJlbW90ZUhvc3QsIHJlbW90ZVBvcnQpLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgIC8vIHdoZW4gdHVubmVsaW5nIGlzIG9wZW4sIHN0b3JlIGltcG9ydGFudCBpbmZvXG4gICAgICAgIHRoaXMuc291cmNlID0gcmVzcG9uc2Uua254QWRkcmVzcztcbiAgICAgICAgdGhpcy5jaGFubmVsSWQgPSByZXNwb25zZS5jaGFubmVsSWQ7XG4gICAgICAgIHRoaXMucmVtb3RlSG9zdCA9IHJlbW90ZUhvc3Q7XG4gICAgICAgIHRoaXMucmVtb3RlUG9ydCA9IHJlbW90ZVBvcnQ7XG4gICAgICAgIC8vIGJlZ2luIGhlYXJ0YmVhdCB0byB0aGUgcmVtb3RlIGhvc3RcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhcnRIZWFydGJlYXQoKTtcbiAgICAgIH0pO1xuICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgIGlmICh0eXBlb2Ygb25GYWlsdXJlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG9uRmFpbHVyZShlcnIpO1xuICAgICAgfVxuICAgICAgdGhpcy5zdG9wSGVhcnRiZWF0KCk7XG4gICAgICBpZiAodGltZW91dCkge1xuICAgICAgICAvLyBjYXN0IG51bWJlciB0byB1aW50XG4gICAgICAgIHRpbWVvdXQgPSB0aW1lb3V0ID4+PiAwO1xuICAgICAgICAvLyBzY2hlZHVsZSByZXRyeSBpbiBgdGltZW91dGAgc2Vjb25kc1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGltZW91dCkudW5yZWYoKSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgLy8gY2FsbCB0byByZWNvbm5lY3RcbiAgICAgICAgICByZXR1cm4gdGhpcy5iaW5kKHJlbW90ZUhvc3QsIHJlbW90ZVBvcnQsIHtcbiAgICAgICAgICAgIHRpbWVvdXQsIG9uRmFpbHVyZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiBubyB0aW1lb3V0LCB0aGVuIHByb3BhZ2F0ZSBlcnJvciB0byB0aGUgY2FsbGVyXG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogcmV0dXJucyBwcm9taXNlLCB3aGljaCBpbmRpY2F0ZXMgc29ja2V0IGNsb3NlXG4gICAqL1xuICBwdWJsaWMgY29tcGxldGU8VD4oY2I/OiAoKSA9PiBUKSB7XG4gICAgcmV0dXJuIHRoaXMucW1hbmFnZXIuY29tcGxldGUoY2IpO1xuICB9XG4gIHB1YmxpYyBpc0Nvbm5lY3RlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA/IHRydWUgOiBmYWxzZTtcbiAgfVxuICAvKipcbiAgICogcmVhZHkgcmV0dXJuIHByb21pc2VzLCB3aGljaCBvbmx5IHJlc29sdmVzIHdoZW4gdHVubmVsIGlzIGNvbm5lY3RlZFxuICAgKi9cbiAgcHVibGljIHJlYWR5PFQ+KGNiPzogKCkgPT4gVCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxUPigocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICByZXNvbHZlKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJyA/IGNiKCkgOiB1bmRlZmluZWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgLy8gd2hlbiBjb25uZWN0ZWQsIGNsZWFyIGludGVydmFsXG4gICAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICAgIHJlc29sdmUodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nID8gY2IoKSA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCAwKTtcbiAgICAgICAgY29uc3QgcmVmID0gdGhpcy5xbWFuYWdlci5vbignZGlzY29ubmVjdCcsICgpID0+IHtcbiAgICAgICAgICAvLyB3aGVuIGRpc2Nvbm5lY3Qgc2NoZWR1bGVkXG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgcmVmLnVuc3Vic2NyaWJlKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBpbnRlcnZhbC51bnJlZigpOyAvLyBsZXQgbm9kZSBleGl0XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBuZXh0IHNlcXVlbmNlIG51bWJlciB0byBudW1iZXIgZWFjaCBrbnggdGVsZWdyYW1cbiAgICovXG4gIHByb3RlY3RlZCBuZXh0U2VxbigpIHtcbiAgICBsZXQgaWQgPSAwO1xuICAgIHdoaWxlICh0aGlzLnNlcXVlbmNlSWRzLmhhcyhpZCkpIHtcbiAgICAgIGlmIChpZCsrID49IDB4RkYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNYXhpbXVtIHNlcXVlbmNlIG51bWJlciByZWFjaGVkJyk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2VxdWVuY2VJZHMuYWRkKGlkKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFZlcmlmaWVzIGlmIHRoZSBzZW5kZXIgdGhlIG9uZSB0aGlzIHR1bm5lbGluZyB3YXMgaW5pdGlhbGx5IGJvdW5kIHRvXG4gICAqL1xuICBwcm90ZWN0ZWQgaXNTYW1lT3JpZ2luKHJlczogQ2hhbm5lbCwgc2VuZGVyOiBBZGRyZXNzSW5mbykge1xuICAgIHJldHVybiByZXMuY2hhbm5lbElkID09PSB0aGlzLmNoYW5uZWxJZCAmJlxuICAgICAgc2VuZGVyLmFkZHJlc3MgPT09IHRoaXMucmVtb3RlSG9zdCAmJlxuICAgICAgc2VuZGVyLnBvcnQgPT09IHRoaXMucmVtb3RlUG9ydCAmJlxuICAgICAgc2VuZGVyLmZhbWlseSA9PT0gJ0lQdjQnO1xuICB9XG4gIC8qKlxuICAgKiBTZW5kcyBkYXRhIHRvIHRoZSBidXNcbiAgICovXG4gIHB1YmxpYyB3cml0ZShkYXRhOiBCdWZmZXIgfCBVaW50OEFycmF5IHwgbnVtYmVyW10sIGdyb3VwQWRkcmVzczogbnVtYmVyKSB7XG4gICAgY29uc3Qgc2VxbiA9IHRoaXMubmV4dFNlcW4oKTtcbiAgICBjb25zdCByZXEgPSB3cml0ZSh7XG4gICAgICBkYXRhLCBzZXFuLFxuICAgICAgY2hhbm5lbElkOiB0aGlzLmNoYW5uZWxJZCxcbiAgICAgIGRlc3Q6IGdyb3VwQWRkcmVzcyxcbiAgICAgIHNvdXJjZTogdGhpcy5zb3VyY2UsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMucW1hbmFnZXIucmVxdWVzdDxUdW5uZWxpbmdBY2s+KHRoaXMucmVtb3RlSG9zdCwgdGhpcy5yZW1vdGVQb3J0LCByZXEsIChyZXMsIHNlbmRlcikgPT4ge1xuICAgICAgcmV0dXJuIHJlcy5zZXFuID09PSBzZXFuICYmIHRoaXMuaXNTYW1lT3JpZ2luKHJlcywgc2VuZGVyKTtcbiAgICB9KS50aGVuKChyZXMpID0+IHtcbiAgICAgIC8vIGFsd2F5cyBmcmVlIHVzZWQgc2VxdWVuY2UgbnVtYmVyXG4gICAgICB0aGlzLnNlcXVlbmNlSWRzLmRlbGV0ZShzZXFuKTtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfSwgKGVycikgPT4ge1xuICAgICAgLy8gYWx3YXlzIGZyZWUgdXNlZCBzZXF1ZW5jZSBudW1iZXJcbiAgICAgIHRoaXMuc2VxdWVuY2VJZHMuZGVsZXRlKHNlcW4pO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBTZW5kcyByZWFkIHJlcXVlc3QsIHdoaWNoIHdpbGwgb25seSBiZSByZXNvbHZlZCB3aGVuIHJlc3BvbnNlIGV2ZW50IHJlY2VpdmVkXG4gICAqL1xuICBwdWJsaWMgcmVhZChncm91cEFkZHJlc3M6IG51bWJlcikge1xuICAgIGNvbnN0IHNlcW4gPSB0aGlzLm5leHRTZXFuKCk7XG4gICAgY29uc3QgcmVxID0gcmVhZCh7XG4gICAgICBzZXFuLFxuICAgICAgY2hhbm5lbElkOiB0aGlzLmNoYW5uZWxJZCxcbiAgICAgIGRlc3Q6IGdyb3VwQWRkcmVzcyxcbiAgICAgIHNvdXJjZTogdGhpcy5zb3VyY2UsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMucW1hbmFnZXIucmVxdWVzdDxHcm91cFJlc3BvbnNlPih0aGlzLnJlbW90ZUhvc3QsIHRoaXMucmVtb3RlUG9ydCwgcmVxLCAocmVzLCBzZW5kZXIpID0+IHtcbiAgICAgIHJldHVybiByZXMuZGVzdCA9PT0gZ3JvdXBBZGRyZXNzICYmXG4gICAgICAgIHJlcy5hY3Rpb24gPT09IEJ1c0V2ZW50Lkdyb3VwUmVzcG9uc2UgJiZcbiAgICAgICAgdGhpcy5pc1NhbWVPcmlnaW4ocmVzLCBzZW5kZXIpO1xuICAgIH0pLnRoZW4oKHJlcykgPT4ge1xuICAgICAgLy8gYWx3YXlzIGZyZWUgdXNlZCBzZXF1ZW5jZSBudW1iZXJcbiAgICAgIHRoaXMuc2VxdWVuY2VJZHMuZGVsZXRlKHNlcW4pO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9LCAoZXJyKSA9PiB7XG4gICAgICAvLyBhbHdheXMgZnJlZSB1c2VkIHNlcXVlbmNlIG51bWJlclxuICAgICAgdGhpcy5zZXF1ZW5jZUlkcy5kZWxldGUoc2Vxbik7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFRlcm1pbmF0ZXMgdHVubmVsaW5nXG4gICAqL1xuICBwdWJsaWMgZGlzY29ubmVjdDxUPihjYj86ICgpID0+IFQpIHtcbiAgICBjb25zdCByZXEgPSBkaXNjb25uZWN0KHRoaXMuY2hhbm5lbElkLCB0aGlzLmNvbnRyb2xQb2ludCk7XG4gICAgcmV0dXJuIHRoaXMucW1hbmFnZXIucmVxdWVzdDxEaXNjb25uZWN0UmVwb25zZT4oXG4gICAgICB0aGlzLnJlbW90ZUhvc3QsIHRoaXMucmVtb3RlUG9ydCwgcmVxLCAocmVzLCByZW1vdGUpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNTYW1lT3JpZ2luKHJlcywgcmVtb3RlKTtcbiAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAvLyB3aGVuIGRpc2Nvbm5lY3RpbmcsIHdlIHN0b3AgaGVhcnRiZWF0aW5nXG4gICAgICAgIHRoaXMuc3RvcEhlYXJ0YmVhdCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5xbWFuYWdlci5kaXNjb25uZWN0KGNiKTtcbiAgICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBQaW5ncyByZW1vdGUgdG8gdmVyaWZ5IGlmIHRoZSBjaGFubmVsIGlzIHN0aWxsIGFjdGl2ZVxuICAgKi9cbiAgcHJvdGVjdGVkIHN0YXJ0SGVhcnRiZWF0KCkge1xuICAgIGNvbnN0IHJlcSA9IHBpbmcodGhpcy5jaGFubmVsSWQsIHRoaXMuY29udHJvbFBvaW50KTtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKF9yZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIC8vIGNoZWNrIGNvbm5lY3Rpb24gd2l0aCB0aGUgZmlyc3QgcGluZ1xuICAgICAgcmV0dXJuIHRoaXMucGluZyhyZXEpLnRoZW4oKCkgPT4ge1xuICAgICAgICAvLyBpbmRpY2F0ZSB0aGF0IHR1bm5lbCBpcyByZWFkeVxuICAgICAgICAvLyBpZiBpdCBpcyBzdWNjZXNzZnVsbCwgdGhlbiBiZWdpbiBoZWFydGJlYXQgZXZlcnkgNjBzXG4gICAgICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5waW5nKHJlcSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSwgNjAwMDApO1xuICAgICAgICAvLyBsZXQgbm9kZSBleGl0IHdpdGhvdXQgd2FpdGluZyB0aGUgaW50ZXJ2YWxcbiAgICAgICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbC51bnJlZigpO1xuICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogU3RvcCBoZWFydGJlYXRcbiAgICovXG4gIHByb3RlY3RlZCBzdG9wSGVhcnRiZWF0KCkge1xuICAgIGlmICh0aGlzLmhlYXJ0YmVhdEludGVydmFsKSB7XG4gICAgICAvLyBzdG9wIGhlYXJ0YmVhdCBpZiBzdGFydGVkXG4gICAgICBjbGVhckludGVydmFsKHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwpO1xuICAgICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFNlbmQgcGluZ1xuICAgKi9cbiAgcHJvdGVjdGVkIHBpbmcocmVxOiBCdWZmZXIpIHtcbiAgICByZXR1cm4gdGhpcy5xbWFuYWdlci5yZXF1ZXN0PENoYW5uZWw+KFxuICAgICAgdGhpcy5yZW1vdGVIb3N0LCB0aGlzLnJlbW90ZVBvcnQsIHJlcSwgKHJlcywgcmVtb3RlKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzU2FtZU9yaWdpbihyZXMsIHJlbW90ZSk7XG4gICAgICB9LCA1MDAwKTtcbiAgfVxuICAvKipcbiAgICogUmVxdWVzdCB0dW5uZWxpbmdcbiAgICovXG4gIHByb3RlY3RlZCBvcGVuVHVubmVsKGhvc3Q6IHN0cmluZywgcG9ydDogbnVtYmVyKSB7XG4gICAgY29uc3QgcSA9IG9wZW5UdW5uZWwoe1xuICAgICAgcmVjZWl2ZUF0OiB0aGlzLmNvbnRyb2xQb2ludCxcbiAgICAgIHJlc3BvbmRUbzogdGhpcy5jb250cm9sUG9pbnQsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMucW1hbmFnZXIucmVxdWVzdDxDb25uZWN0UmVzcG9uc2VUdW5uZWw+KFxuICAgICAgaG9zdCwgcG9ydCwgcSwgKHJlcywgc2VuZGVyKSA9PiB7XG4gICAgICAgIHJldHVybiBzZW5kZXIuYWRkcmVzcyA9PT0gaG9zdCAmJlxuICAgICAgICAgIHNlbmRlci5mYW1pbHkgPT09ICdJUHY0JyAmJlxuICAgICAgICAgIHNlbmRlci5wb3J0ID09PSBwb3J0ICYmXG4gICAgICAgICAgcmVzLnNlcnZpY2VJZCA9PT0gU2VydmljZS5Db25uZWN0UmVzcG9uc2UgJiZcbiAgICAgICAgICByZXMuY29ubmVjdGlvblR5cGUgPT09IENvbm5lY3Rpb24uVHVubmVsO1xuICAgICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFN1cHBvcnRlZCBldmVudHNcbiAgICovXG4gIG9uKGV2ZW50OiAndW5wcm9jZXNzZWQnLCBjYjogKGVycjogRXJyb3IsIHJhdz86IEJ1ZmZlciwgcmVtb3RlPzogQWRkcmVzc0luZm8pID0+IHZvaWQpOiBTdWJzY3JpYmVyO1xuICBvbjxUPihldmVudDogJ3F1ZXJ5JywgY2I6IChxdWVyeTogVCwgc2VuZGVyPzogQWRkcmVzc0luZm8pID0+IHZvaWQpOiBTdWJzY3JpYmVyO1xuICBvbihldmVudDogc3RyaW5nLCBjYjogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKTogU3Vic2NyaWJlciB7XG4gICAgcmV0dXJuIHRoaXMucW1hbmFnZXIub24oZXZlbnQsIGNiKTtcbiAgfVxufVxuIl19