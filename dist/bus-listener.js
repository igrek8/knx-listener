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
                let ref;
                const interval = setInterval(() => {
                    if (this.isConnected()) {
                        // when connected, clear interval
                        clearInterval(interval);
                        ref.unsubscribe();
                        resolve(typeof cb === 'function' ? cb() : undefined);
                    }
                }, 0);
                interval.unref(); // let node exit
                ref = this.qmanager.on('disconnect', () => {
                    // when disconnect scheduled
                    clearInterval(interval);
                    ref.unsubscribe();
                });
            }
        });
    }
    /**
     * Generates next sequence number to number each knx telegram
     */
    nextSeqn() {
        let id = 0;
        while (this.sequenceIds.has(id)) {
            if (id++ > 0xFF) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVzLWxpc3RlbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2J1cy1saXN0ZW5lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsNkNBTXNCO0FBVXRCLG1EQUV5QjtBQU96QiwyQ0FFcUI7QUFLckI7SUFTRTtRQUNFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksNEJBQVksRUFBRSxDQUFDO0lBQ3JDLENBQUM7SUFDRDs7T0FFRztJQUNJLElBQUksQ0FBQyxVQUFrQixFQUFFLFVBQWtCLEVBQUUsRUFDbEQsT0FBTyxFQUFFLFNBQVMsTUFDd0MsRUFBRTtRQUM1RCxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJO1lBQ3ZDLElBQUksQ0FBQyxZQUFZLEdBQUc7Z0JBQ2xCLEVBQUUsRUFBRSxzQkFBVTtnQkFDZCxRQUFRLEVBQUUsWUFBYTtnQkFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2FBQ2hCLENBQUM7WUFDRixNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUTtnQkFDM0QsK0NBQStDO2dCQUMvQyxJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7Z0JBQzdCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO2dCQUM3QixxQ0FBcUM7Z0JBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDL0IsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMs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QztJQU1ELEVBQUUsQ0FBQyxLQUFhLEVBQUUsRUFBNEI7UUFDNUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNyQyxDQUFDO0NBQ0Y7QUE1T0Qsa0NBNE9DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgZGlzY29ubmVjdCxcbiAgcmVhZCxcbiAgb3BlblR1bm5lbCxcbiAgcGluZyxcbiAgd3JpdGUsXG59IGZyb20gJy4vc2VyaWFsaXplcic7XG5pbXBvcnQge1xuICBEaXNjb25uZWN0UmVwb25zZSxcbiAgQ2hhbm5lbCxcbiAgQ29ubmVjdFJlc3BvbnNlVHVubmVsLFxuICBUdW5uZWxpbmdBY2ssXG4gIEdyb3VwUmVzcG9uc2UsXG4gIEhwYWksXG4gIFN1YnNjcmliZXIsXG59IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5pbXBvcnQge1xuICBRdWVyeU1hbmFnZXIsXG59IGZyb20gJy4vcXVlcnktbWFuYWdlcic7XG5pbXBvcnQge1xuICBTZXJ2aWNlLFxuICBQcm90b2NvbCxcbiAgQ29ubmVjdGlvbixcbiAgQnVzRXZlbnQsXG59IGZyb20gJy4vY29uc3RhbnRzJztcbmltcG9ydCB7XG4gIE15SXBOdW1iZXIsXG59IGZyb20gJy4vY29uc3RhbnRzJztcbmltcG9ydCB7XG4gIEFkZHJlc3NJbmZvLFxufSBmcm9tICdkZ3JhbSc7XG5cbmV4cG9ydCBjbGFzcyBCdXNMaXN0ZW5lciB7XG4gIHByb3RlY3RlZCBzZXF1ZW5jZUlkczogU2V0PG51bWJlcj47XG4gIHByb3RlY3RlZCBxbWFuYWdlcjogUXVlcnlNYW5hZ2VyO1xuICBwcm90ZWN0ZWQgY29udHJvbFBvaW50OiBIcGFpO1xuICBwcm90ZWN0ZWQgaGVhcnRiZWF0SW50ZXJ2YWw6IE5vZGVKUy5UaW1lcjtcbiAgcHJvdGVjdGVkIHNvdXJjZTogbnVtYmVyO1xuICBwcm90ZWN0ZWQgcmVtb3RlSG9zdDogc3RyaW5nO1xuICBwcm90ZWN0ZWQgcmVtb3RlUG9ydDogbnVtYmVyO1xuICBwcm90ZWN0ZWQgY2hhbm5lbElkOiBudW1iZXI7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc2VxdWVuY2VJZHMgPSBuZXcgU2V0KCk7XG4gICAgdGhpcy5xbWFuYWdlciA9IG5ldyBRdWVyeU1hbmFnZXIoKTtcbiAgfVxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgdHVubmVsaW5nLiBJdCBpcyBgbmV2ZXItcmVzb2x2aW5nYCBwcm9taXNlXG4gICAqL1xuICBwdWJsaWMgYmluZChyZW1vdGVIb3N0OiBzdHJpbmcsIHJlbW90ZVBvcnQ6IG51bWJlciwge1xuICAgIHRpbWVvdXQsIG9uRmFpbHVyZSxcbiAgfTogeyB0aW1lb3V0PzogbnVtYmVyLCBvbkZhaWx1cmU/OiAoZXJyOiBFcnJvcikgPT4gdm9pZCB9ID0ge30pOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnFtYW5hZ2VyLmNvbm5lY3QoKS50aGVuKChzb2NrKSA9PiB7XG4gICAgICB0aGlzLmNvbnRyb2xQb2ludCA9IHtcbiAgICAgICAgaXA6IE15SXBOdW1iZXIsXG4gICAgICAgIHByb3RvY29sOiBQcm90b2NvbC5VZHA0LFxuICAgICAgICBwb3J0OiBzb2NrLnBvcnQsXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMub3BlblR1bm5lbChyZW1vdGVIb3N0LCByZW1vdGVQb3J0KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAvLyB3aGVuIHR1bm5lbGluZyBpcyBvcGVuLCBzdG9yZSBpbXBvcnRhbnQgaW5mb1xuICAgICAgICB0aGlzLnNvdXJjZSA9IHJlc3BvbnNlLmtueEFkZHJlc3M7XG4gICAgICAgIHRoaXMuY2hhbm5lbElkID0gcmVzcG9uc2UuY2hhbm5lbElkO1xuICAgICAgICB0aGlzLnJlbW90ZUhvc3QgPSByZW1vdGVIb3N0O1xuICAgICAgICB0aGlzLnJlbW90ZVBvcnQgPSByZW1vdGVQb3J0O1xuICAgICAgICAvLyBiZWdpbiBoZWFydGJlYXQgdG8gdGhlIHJlbW90ZSBob3N0XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXJ0SGVhcnRiZWF0KCk7XG4gICAgICB9KTtcbiAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIG9uRmFpbHVyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBvbkZhaWx1cmUoZXJyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RvcEhlYXJ0YmVhdCgpO1xuICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgLy8gY2FzdCBudW1iZXIgdG8gdWludFxuICAgICAgICB0aW1lb3V0ID0gdGltZW91dCA+Pj4gMDtcbiAgICAgICAgLy8gc2NoZWR1bGUgcmV0cnkgaW4gYHRpbWVvdXRgIHNlY29uZHNcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHRpbWVvdXQpLnVucmVmKCkpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIC8vIGNhbGwgdG8gcmVjb25uZWN0XG4gICAgICAgICAgcmV0dXJuIHRoaXMuYmluZChyZW1vdGVIb3N0LCByZW1vdGVQb3J0LCB7XG4gICAgICAgICAgICB0aW1lb3V0LCBvbkZhaWx1cmUsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgbm8gdGltZW91dCwgdGhlbiBwcm9wYWdhdGUgZXJyb3IgdG8gdGhlIGNhbGxlclxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIHJldHVybnMgcHJvbWlzZSwgd2hpY2ggaW5kaWNhdGVzIHNvY2tldCBjbG9zZVxuICAgKi9cbiAgcHVibGljIGNvbXBsZXRlPFQ+KGNiPzogKCkgPT4gVCkge1xuICAgIHJldHVybiB0aGlzLnFtYW5hZ2VyLmNvbXBsZXRlKGNiKTtcbiAgfVxuICBwdWJsaWMgaXNDb25uZWN0ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPyB0cnVlIDogZmFsc2U7XG4gIH1cbiAgLyoqXG4gICAqIHJlYWR5IHJldHVybiBwcm9taXNlcywgd2hpY2ggb25seSByZXNvbHZlcyB3aGVuIHR1bm5lbCBpcyBjb25uZWN0ZWRcbiAgICovXG4gIHB1YmxpYyByZWFkeTxUPihjYj86ICgpID0+IFQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VD4oKHJlc29sdmUpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgcmVzb2x2ZSh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicgPyBjYigpIDogdW5kZWZpbmVkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCByZWY6IFN1YnNjcmliZXI7XG4gICAgICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgICAgIC8vIHdoZW4gY29ubmVjdGVkLCBjbGVhciBpbnRlcnZhbFxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICByZWYudW5zdWJzY3JpYmUoKTtcbiAgICAgICAgICAgIHJlc29sdmUodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nID8gY2IoKSA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCAwKTtcbiAgICAgICAgaW50ZXJ2YWwudW5yZWYoKTsgLy8gbGV0IG5vZGUgZXhpdFxuICAgICAgICByZWYgPSB0aGlzLnFtYW5hZ2VyLm9uKCdkaXNjb25uZWN0JywgKCkgPT4ge1xuICAgICAgICAgIC8vIHdoZW4gZGlzY29ubmVjdCBzY2hlZHVsZWRcbiAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICByZWYudW5zdWJzY3JpYmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBuZXh0IHNlcXVlbmNlIG51bWJlciB0byBudW1iZXIgZWFjaCBrbnggdGVsZWdyYW1cbiAgICovXG4gIHByb3RlY3RlZCBuZXh0U2VxbigpIHtcbiAgICBsZXQgaWQgPSAwO1xuICAgIHdoaWxlICh0aGlzLnNlcXVlbmNlSWRzLmhhcyhpZCkpIHtcbiAgICAgIGlmIChpZCsrID4gMHhGRikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01heGltdW0gc2VxdWVuY2UgbnVtYmVyIHJlYWNoZWQnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5zZXF1ZW5jZUlkcy5hZGQoaWQpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogVmVyaWZpZXMgaWYgdGhlIHNlbmRlciB0aGUgb25lIHRoaXMgdHVubmVsaW5nIHdhcyBpbml0aWFsbHkgYm91bmQgdG9cbiAgICovXG4gIHByb3RlY3RlZCBpc1NhbWVPcmlnaW4ocmVzOiBDaGFubmVsLCBzZW5kZXI6IEFkZHJlc3NJbmZvKSB7XG4gICAgcmV0dXJuIHJlcy5jaGFubmVsSWQgPT09IHRoaXMuY2hhbm5lbElkICYmXG4gICAgICBzZW5kZXIuYWRkcmVzcyA9PT0gdGhpcy5yZW1vdGVIb3N0ICYmXG4gICAgICBzZW5kZXIucG9ydCA9PT0gdGhpcy5yZW1vdGVQb3J0ICYmXG4gICAgICBzZW5kZXIuZmFtaWx5ID09PSAnSVB2NCc7XG4gIH1cbiAgLyoqXG4gICAqIFNlbmRzIGRhdGEgdG8gdGhlIGJ1c1xuICAgKi9cbiAgcHVibGljIHdyaXRlKGRhdGE6IEJ1ZmZlciB8IFVpbnQ4QXJyYXkgfCBudW1iZXJbXSwgZ3JvdXBBZGRyZXNzOiBudW1iZXIpIHtcbiAgICBjb25zdCBzZXFuID0gdGhpcy5uZXh0U2VxbigpO1xuICAgIGNvbnN0IHJlcSA9IHdyaXRlKHtcbiAgICAgIGRhdGEsIHNlcW4sXG4gICAgICBjaGFubmVsSWQ6IHRoaXMuY2hhbm5lbElkLFxuICAgICAgZGVzdDogZ3JvdXBBZGRyZXNzLFxuICAgICAgc291cmNlOiB0aGlzLnNvdXJjZSxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5xbWFuYWdlci5yZXF1ZXN0PFR1bm5lbGluZ0Fjaz4odGhpcy5yZW1vdGVIb3N0LCB0aGlzLnJlbW90ZVBvcnQsIHJlcSwgKHJlcywgc2VuZGVyKSA9PiB7XG4gICAgICByZXR1cm4gcmVzLnNlcW4gPT09IHNlcW4gJiYgdGhpcy5pc1NhbWVPcmlnaW4ocmVzLCBzZW5kZXIpO1xuICAgIH0pLnRoZW4oKHJlcykgPT4ge1xuICAgICAgLy8gYWx3YXlzIGZyZWUgdXNlZCBzZXF1ZW5jZSBudW1iZXJcbiAgICAgIHRoaXMuc2VxdWVuY2VJZHMuZGVsZXRlKHNlcW4pO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9LCAoZXJyKSA9PiB7XG4gICAgICAvLyBhbHdheXMgZnJlZSB1c2VkIHNlcXVlbmNlIG51bWJlclxuICAgICAgdGhpcy5zZXF1ZW5jZUlkcy5kZWxldGUoc2Vxbik7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFNlbmRzIHJlYWQgcmVxdWVzdCwgd2hpY2ggd2lsbCBvbmx5IGJlIHJlc29sdmVkIHdoZW4gcmVzcG9uc2UgZXZlbnQgcmVjZWl2ZWRcbiAgICovXG4gIHB1YmxpYyByZWFkKGdyb3VwQWRkcmVzczogbnVtYmVyKSB7XG4gICAgY29uc3Qgc2VxbiA9IHRoaXMubmV4dFNlcW4oKTtcbiAgICBjb25zdCByZXEgPSByZWFkKHtcbiAgICAgIHNlcW4sXG4gICAgICBjaGFubmVsSWQ6IHRoaXMuY2hhbm5lbElkLFxuICAgICAgZGVzdDogZ3JvdXBBZGRyZXNzLFxuICAgICAgc291cmNlOiB0aGlzLnNvdXJjZSxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5xbWFuYWdlci5yZXF1ZXN0PEdyb3VwUmVzcG9uc2U+KHRoaXMucmVtb3RlSG9zdCwgdGhpcy5yZW1vdGVQb3J0LCByZXEsIChyZXMsIHNlbmRlcikgPT4ge1xuICAgICAgcmV0dXJuIHJlcy5kZXN0ID09PSBncm91cEFkZHJlc3MgJiZcbiAgICAgICAgcmVzLmFjdGlvbiA9PT0gQnVzRXZlbnQuR3JvdXBSZXNwb25zZSAmJlxuICAgICAgICB0aGlzLmlzU2FtZU9yaWdpbihyZXMsIHNlbmRlcik7XG4gICAgfSkudGhlbigocmVzKSA9PiB7XG4gICAgICAvLyBhbHdheXMgZnJlZSB1c2VkIHNlcXVlbmNlIG51bWJlclxuICAgICAgdGhpcy5zZXF1ZW5jZUlkcy5kZWxldGUoc2Vxbik7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH0sIChlcnIpID0+IHtcbiAgICAgIC8vIGFsd2F5cyBmcmVlIHVzZWQgc2VxdWVuY2UgbnVtYmVyXG4gICAgICB0aGlzLnNlcXVlbmNlSWRzLmRlbGV0ZShzZXFuKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogVGVybWluYXRlcyB0dW5uZWxpbmdcbiAgICovXG4gIHB1YmxpYyBkaXNjb25uZWN0PFQ+KGNiPzogKCkgPT4gVCkge1xuICAgIGNvbnN0IHJlcSA9IGRpc2Nvbm5lY3QodGhpcy5jaGFubmVsSWQsIHRoaXMuY29udHJvbFBvaW50KTtcbiAgICByZXR1cm4gdGhpcy5xbWFuYWdlci5yZXF1ZXN0PERpc2Nvbm5lY3RSZXBvbnNlPihcbiAgICAgIHRoaXMucmVtb3RlSG9zdCwgdGhpcy5yZW1vdGVQb3J0LCByZXEsIChyZXMsIHJlbW90ZSkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5pc1NhbWVPcmlnaW4ocmVzLCByZW1vdGUpO1xuICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgIC8vIHdoZW4gZGlzY29ubmVjdGluZywgd2Ugc3RvcCBoZWFydGJlYXRpbmdcbiAgICAgICAgdGhpcy5zdG9wSGVhcnRiZWF0KCk7XG4gICAgICAgIHJldHVybiB0aGlzLnFtYW5hZ2VyLmRpc2Nvbm5lY3QoY2IpO1xuICAgICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFBpbmdzIHJlbW90ZSB0byB2ZXJpZnkgaWYgdGhlIGNoYW5uZWwgaXMgc3RpbGwgYWN0aXZlXG4gICAqL1xuICBwcm90ZWN0ZWQgc3RhcnRIZWFydGJlYXQoKSB7XG4gICAgY29uc3QgcmVxID0gcGluZyh0aGlzLmNoYW5uZWxJZCwgdGhpcy5jb250cm9sUG9pbnQpO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigoX3Jlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgLy8gY2hlY2sgY29ubmVjdGlvbiB3aXRoIHRoZSBmaXJzdCBwaW5nXG4gICAgICByZXR1cm4gdGhpcy5waW5nKHJlcSkudGhlbigoKSA9PiB7XG4gICAgICAgIC8vIGluZGljYXRlIHRoYXQgdHVubmVsIGlzIHJlYWR5XG4gICAgICAgIC8vIGlmIGl0IGlzIHN1Y2Nlc3NmdWxsLCB0aGVuIGJlZ2luIGhlYXJ0YmVhdCBldmVyeSA2MHNcbiAgICAgICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICB0aGlzLnBpbmcocmVxKS5jYXRjaChyZWplY3QpO1xuICAgICAgICB9LCA2MDAwMCk7XG4gICAgICAgIC8vIGxldCBub2RlIGV4aXQgd2l0aG91dCB3YWl0aW5nIHRoZSBpbnRlcnZhbFxuICAgICAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsLnVucmVmKCk7XG4gICAgICB9KS5jYXRjaChyZWplY3QpO1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBTdG9wIGhlYXJ0YmVhdFxuICAgKi9cbiAgcHJvdGVjdGVkIHN0b3BIZWFydGJlYXQoKSB7XG4gICAgaWYgKHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwpIHtcbiAgICAgIC8vIHN0b3AgaGVhcnRiZWF0IGlmIHN0YXJ0ZWRcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oZWFydGJlYXRJbnRlcnZhbCk7XG4gICAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogU2VuZCBwaW5nXG4gICAqL1xuICBwcm90ZWN0ZWQgcGluZyhyZXE6IEJ1ZmZlcikge1xuICAgIHJldHVybiB0aGlzLnFtYW5hZ2VyLnJlcXVlc3Q8Q2hhbm5lbD4oXG4gICAgICB0aGlzLnJlbW90ZUhvc3QsIHRoaXMucmVtb3RlUG9ydCwgcmVxLCAocmVzLCByZW1vdGUpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNTYW1lT3JpZ2luKHJlcywgcmVtb3RlKTtcbiAgICAgIH0sIDUwMDApO1xuICB9XG4gIC8qKlxuICAgKiBSZXF1ZXN0IHR1bm5lbGluZ1xuICAgKi9cbiAgcHJvdGVjdGVkIG9wZW5UdW5uZWwoaG9zdDogc3RyaW5nLCBwb3J0OiBudW1iZXIpIHtcbiAgICBjb25zdCBxID0gb3BlblR1bm5lbCh7XG4gICAgICByZWNlaXZlQXQ6IHRoaXMuY29udHJvbFBvaW50LFxuICAgICAgcmVzcG9uZFRvOiB0aGlzLmNvbnRyb2xQb2ludCxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5xbWFuYWdlci5yZXF1ZXN0PENvbm5lY3RSZXNwb25zZVR1bm5lbD4oXG4gICAgICBob3N0LCBwb3J0LCBxLCAocmVzLCBzZW5kZXIpID0+IHtcbiAgICAgICAgcmV0dXJuIHNlbmRlci5hZGRyZXNzID09PSBob3N0ICYmXG4gICAgICAgICAgc2VuZGVyLmZhbWlseSA9PT0gJ0lQdjQnICYmXG4gICAgICAgICAgc2VuZGVyLnBvcnQgPT09IHBvcnQgJiZcbiAgICAgICAgICByZXMuc2VydmljZUlkID09PSBTZXJ2aWNlLkNvbm5lY3RSZXNwb25zZSAmJlxuICAgICAgICAgIHJlcy5jb25uZWN0aW9uVHlwZSA9PT0gQ29ubmVjdGlvbi5UdW5uZWw7XG4gICAgICB9KTtcbiAgfVxuICAvKipcbiAgICogU3VwcG9ydGVkIGV2ZW50c1xuICAgKi9cbiAgb24oZXZlbnQ6ICd1bnByb2Nlc3NlZCcsIGNiOiAoZXJyOiBFcnJvciwgcmF3PzogQnVmZmVyLCByZW1vdGU/OiBBZGRyZXNzSW5mbykgPT4gdm9pZCk6IFN1YnNjcmliZXI7XG4gIG9uPFQ+KGV2ZW50OiAncXVlcnknLCBjYjogKHF1ZXJ5OiBULCBzZW5kZXI/OiBBZGRyZXNzSW5mbykgPT4gdm9pZCk6IFN1YnNjcmliZXI7XG4gIG9uKGV2ZW50OiBzdHJpbmcsIGNiOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpOiBTdWJzY3JpYmVyIHtcbiAgICByZXR1cm4gdGhpcy5xbWFuYWdlci5vbihldmVudCwgY2IpO1xuICB9XG59XG4iXX0=