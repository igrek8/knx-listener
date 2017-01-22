"use strict";
const tslib_1 = require("tslib");
const async_socket_1 = require("./utils/async-socket");
const smart_cursor_1 = require("./utils/smart-cursor");
const deserializer_1 = require("./deserializer");
const serializer_1 = require("./serializer");
/**
 * Manages io server queries and tracks resolution of mappable requests
 */
class QueryManager extends async_socket_1.AsyncSocket {
    connect(port = 0 /* OS assigned port */) {
        // forward raw data for processing
        const ref = super.on('raw', this.process.bind(this));
        return super.connect(port).catch((err) => {
            ref.unsubscribe();
            // propagate error to the caller
            throw err;
        });
    }
    /**
     * Creates a mapable request to track responses with timeout
     */
    request(host, port, data, select, timeout) {
        return new Promise((resolve, reject) => {
            // keep ref to unsub to avoid a memory leak
            const ref = this.on('query', (query, remote) => {
                // map response to the request
                if (select(query, remote)) {
                    if (query.status === 0 /* NoError */) {
                        resolve(query);
                    }
                    else {
                        reject(new Error(`Request error ${query.status}`));
                    }
                }
            });
            // set timeout if no response within given time
            setTimeout(() => {
                ref.unsubscribe(); // avoid memory leak
                const err = new Error(`Request timeout`);
                err.code = 'ETIMEOUT';
                reject(err);
            }, timeout > 200 ? timeout : 200).unref(); // unref timeout to let node exit
            // make request and propagate errors
            return super.send(host, port, data).catch((err) => {
                ref.unsubscribe(); // avoid memory leak
                reject(err);
            });
        });
    }
    /**
     * Processes raw messages from socket stream
     */
    process(raw, remote) {
        try {
            const pos = new smart_cursor_1.SmartCursor();
            const header = deserializer_1.header(raw, pos);
            switch (header.serviceId) {
                case 518 /* ConnectResponse */: {
                    const channel = deserializer_1.channel(raw, pos);
                    const sender = deserializer_1.hpai(raw, pos);
                    const response = deserializer_1.connectResponse(raw, pos);
                    return this.events.emit('query', tslib_1.__assign({}, header, channel, sender, response), remote);
                }
                case 520 /* ConnectStateResponse */: {
                    const channel = deserializer_1.channel(raw, pos);
                    return this.events.emit('query', tslib_1.__assign({}, channel), remote);
                }
                case 1057 /* TunnelingAck */: {
                    const seqn = deserializer_1.seqnum(raw, pos);
                    return this.events.emit('query', tslib_1.__assign({}, seqn), remote);
                }
                case 1056 /* TunnelingRequest */: {
                    const seqn = deserializer_1.seqnum(raw, pos);
                    const cemi = deserializer_1.tunnelCemi(raw, pos);
                    // reply ack to indicate successful reception of the message
                    this.send(remote.address, remote.port, serializer_1.ack(seqn.seqn, seqn.channelId, 0 /* NoError */));
                    return this.events.emit('query', tslib_1.__assign({}, cemi, seqn), remote);
                }
                case 522 /* DisconnectResponse */: {
                    const channel = deserializer_1.channel(raw, pos);
                    return this.events.emit('query', tslib_1.__assign({}, channel), remote);
                }
                default: throw new Error(`Failed to process ${header.serviceId}`);
            }
        }
        catch (err) {
            return this.events.emit('unprocessed', err, raw, remote);
        }
    }
}
exports.QueryManager = QueryManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVlcnktbWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9xdWVyeS1tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBR0EsdURBRThCO0FBQzlCLHVEQUU4QjtBQUM5QixpREFPd0I7QUFDeEIsNkNBRXNCO0FBTXRCOztHQUVHO0FBQ0gsa0JBQTBCLFNBQVEsMEJBQVc7SUFDM0MsT0FBTyxDQUFDLE9BQWUsQ0FBQyxDQUFDLHNCQUFzQjtRQUM3QyxrQ0FBa0M7UUFDbEMsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRCxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHO1lBQ25DLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNsQixnQ0FBZ0M7WUFDaEMsTUFBTSxHQUFHLENBQUM7UUFDWixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDRDs7T0FFRztJQUNILE9BQU8sQ0FDTCxJQUFZLEVBQUUsSUFBWSxFQUFFLElBQVksRUFDeEMsTUFBZ0QsRUFBRSxPQUFnQjtRQUVsRSxNQUFNLENBQUMsSUFBSSxPQUFPLENBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTTtZQUNwQywyQ0FBMkM7WUFDM0MsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBeUIsT0FBTyxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU07Z0JBQ2pFLDhCQUE4QjtnQkFDOUIsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzFCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssZUFBYyxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsT0FBTyxDQUFDLEtBQUssQ0FB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eEMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLGVBQWMsQ0FDMUMsQ0FBQyxDQUFDO29CQUNILE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLHVCQUFPLElBQUksRUFBSyxJQUFJLEdBQUksTUFBTSxDQUFDLENBQUM7Z0JBQ2pFLENBQUM7Z0JBQ0QsS0FBSyw0QkFBMEIsRUFBRSxDQUFDO29CQUNoQyxNQUFNLE9BQU8sR0FBRyxzQkFBVyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sdUJBQU8sT0FBTyxHQUFJLE1BQU0sQ0FBQyxDQUFDO2dCQUMzRCxDQUFDO2dCQUNELFNBQVMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDcEUsQ0FBQztRQUNILENBQUU7UUFBQSxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzNELENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUF0RkQsb0NBc0ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgUmVtb3RlSW5mbyxcbn0gZnJvbSAnZGdyYW0nO1xuaW1wb3J0IHtcbiAgQXN5bmNTb2NrZXQsXG59IGZyb20gJy4vdXRpbHMvYXN5bmMtc29ja2V0JztcbmltcG9ydCB7XG4gIFNtYXJ0Q3Vyc29yLFxufSBmcm9tICcuL3V0aWxzL3NtYXJ0LWN1cnNvcic7XG5pbXBvcnQge1xuICBjaGFubmVsIGFzIHJlYWRDaGFubmVsLFxuICBjb25uZWN0UmVzcG9uc2UsXG4gIGhlYWRlciBhcyByZWFkSGVhZGVyLFxuICBocGFpLFxuICBzZXFudW0sXG4gIHR1bm5lbENlbWksXG59IGZyb20gJy4vZGVzZXJpYWxpemVyJztcbmltcG9ydCB7XG4gIGFjayxcbn0gZnJvbSAnLi9zZXJpYWxpemVyJztcbmltcG9ydCB7XG4gIFNlcnZpY2UsXG4gIFN0YXR1cyxcbn0gZnJvbSAnLi9jb25zdGFudHMnO1xuXG4vKipcbiAqIE1hbmFnZXMgaW8gc2VydmVyIHF1ZXJpZXMgYW5kIHRyYWNrcyByZXNvbHV0aW9uIG9mIG1hcHBhYmxlIHJlcXVlc3RzXG4gKi9cbmV4cG9ydCBjbGFzcyBRdWVyeU1hbmFnZXIgZXh0ZW5kcyBBc3luY1NvY2tldCB7XG4gIGNvbm5lY3QocG9ydDogbnVtYmVyID0gMCAvKiBPUyBhc3NpZ25lZCBwb3J0ICovKTogUHJvbWlzZTxSZW1vdGVJbmZvPiB7XG4gICAgLy8gZm9yd2FyZCByYXcgZGF0YSBmb3IgcHJvY2Vzc2luZ1xuICAgIGNvbnN0IHJlZiA9IHN1cGVyLm9uKCdyYXcnLCB0aGlzLnByb2Nlc3MuYmluZCh0aGlzKSk7XG4gICAgcmV0dXJuIHN1cGVyLmNvbm5lY3QocG9ydCkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgcmVmLnVuc3Vic2NyaWJlKCk7XG4gICAgICAvLyBwcm9wYWdhdGUgZXJyb3IgdG8gdGhlIGNhbGxlclxuICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbWFwYWJsZSByZXF1ZXN0IHRvIHRyYWNrIHJlc3BvbnNlcyB3aXRoIHRpbWVvdXRcbiAgICovXG4gIHJlcXVlc3Q8VD4oXG4gICAgaG9zdDogc3RyaW5nLCBwb3J0OiBudW1iZXIsIGRhdGE6IEJ1ZmZlcixcbiAgICBzZWxlY3Q6IChyZXM6IFQsIHNlbmRlcj86IFJlbW90ZUluZm8pID0+IGJvb2xlYW4sIHRpbWVvdXQ/OiBudW1iZXIsXG4gICkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxUPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAvLyBrZWVwIHJlZiB0byB1bnN1YiB0byBhdm9pZCBhIG1lbW9yeSBsZWFrXG4gICAgICBjb25zdCByZWYgPSB0aGlzLm9uPFQgJiB7IHN0YXR1czogbnVtYmVyIH0+KCdxdWVyeScsIChxdWVyeSwgcmVtb3RlKSA9PiB7XG4gICAgICAgIC8vIG1hcCByZXNwb25zZSB0byB0aGUgcmVxdWVzdFxuICAgICAgICBpZiAoc2VsZWN0KHF1ZXJ5LCByZW1vdGUpKSB7XG4gICAgICAgICAgaWYgKHF1ZXJ5LnN0YXR1cyA9PT0gU3RhdHVzLk5vRXJyb3IpIHtcbiAgICAgICAgICAgIHJlc29sdmUocXVlcnkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBSZXF1ZXN0IGVycm9yICR7cXVlcnkuc3RhdHVzfWApKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gc2V0IHRpbWVvdXQgaWYgbm8gcmVzcG9uc2Ugd2l0aGluIGdpdmVuIHRpbWVcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWYudW5zdWJzY3JpYmUoKTsgLy8gYXZvaWQgbWVtb3J5IGxlYWtcbiAgICAgICAgY29uc3QgZXJyOiBOb2RlSlMuRXJybm9FeGNlcHRpb24gPSBuZXcgRXJyb3IoYFJlcXVlc3QgdGltZW91dGApO1xuICAgICAgICBlcnIuY29kZSA9ICdFVElNRU9VVCc7XG4gICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgfSwgdGltZW91dCA+IDIwMCA/IHRpbWVvdXQgOiAyMDApLnVucmVmKCk7IC8vIHVucmVmIHRpbWVvdXQgdG8gbGV0IG5vZGUgZXhpdFxuICAgICAgLy8gbWFrZSByZXF1ZXN0IGFuZCBwcm9wYWdhdGUgZXJyb3JzXG4gICAgICByZXR1cm4gc3VwZXIuc2VuZChob3N0LCBwb3J0LCBkYXRhKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgIHJlZi51bnN1YnNjcmliZSgpOyAvLyBhdm9pZCBtZW1vcnkgbGVha1xuICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBQcm9jZXNzZXMgcmF3IG1lc3NhZ2VzIGZyb20gc29ja2V0IHN0cmVhbVxuICAgKi9cbiAgcHJpdmF0ZSBwcm9jZXNzKHJhdzogQnVmZmVyLCByZW1vdGU6IFJlbW90ZUluZm8pIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcG9zID0gbmV3IFNtYXJ0Q3Vyc29yKCk7XG4gICAgICBjb25zdCBoZWFkZXIgPSByZWFkSGVhZGVyKHJhdywgcG9zKTtcbiAgICAgIHN3aXRjaCAoaGVhZGVyLnNlcnZpY2VJZCkge1xuICAgICAgICBjYXNlIFNlcnZpY2UuQ29ubmVjdFJlc3BvbnNlOiB7XG4gICAgICAgICAgY29uc3QgY2hhbm5lbCA9IHJlYWRDaGFubmVsKHJhdywgcG9zKTtcbiAgICAgICAgICBjb25zdCBzZW5kZXIgPSBocGFpKHJhdywgcG9zKTtcbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGNvbm5lY3RSZXNwb25zZShyYXcsIHBvcyk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZXZlbnRzLmVtaXQoJ3F1ZXJ5Jywge1xuICAgICAgICAgICAgLi4uaGVhZGVyLCAuLi5jaGFubmVsLCAuLi5zZW5kZXIsIC4uLnJlc3BvbnNlLFxuICAgICAgICAgIH0sIHJlbW90ZSk7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBTZXJ2aWNlLkNvbm5lY3RTdGF0ZVJlc3BvbnNlOiB7XG4gICAgICAgICAgY29uc3QgY2hhbm5lbCA9IHJlYWRDaGFubmVsKHJhdywgcG9zKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5ldmVudHMuZW1pdCgncXVlcnknLCB7IC4uLmNoYW5uZWwgfSwgcmVtb3RlKTtcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFNlcnZpY2UuVHVubmVsaW5nQWNrOiB7XG4gICAgICAgICAgY29uc3Qgc2VxbiA9IHNlcW51bShyYXcsIHBvcyk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZXZlbnRzLmVtaXQoJ3F1ZXJ5JywgeyAuLi5zZXFuIH0sIHJlbW90ZSk7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBTZXJ2aWNlLlR1bm5lbGluZ1JlcXVlc3Q6IHtcbiAgICAgICAgICBjb25zdCBzZXFuID0gc2VxbnVtKHJhdywgcG9zKTtcbiAgICAgICAgICBjb25zdCBjZW1pID0gdHVubmVsQ2VtaShyYXcsIHBvcyk7XG4gICAgICAgICAgLy8gcmVwbHkgYWNrIHRvIGluZGljYXRlIHN1Y2Nlc3NmdWwgcmVjZXB0aW9uIG9mIHRoZSBtZXNzYWdlXG4gICAgICAgICAgdGhpcy5zZW5kKHJlbW90ZS5hZGRyZXNzLCByZW1vdGUucG9ydCwgYWNrKFxuICAgICAgICAgICAgc2Vxbi5zZXFuLCBzZXFuLmNoYW5uZWxJZCwgU3RhdHVzLk5vRXJyb3IsXG4gICAgICAgICAgKSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZXZlbnRzLmVtaXQoJ3F1ZXJ5JywgeyAuLi5jZW1pLCAuLi5zZXFuIH0sIHJlbW90ZSk7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBTZXJ2aWNlLkRpc2Nvbm5lY3RSZXNwb25zZToge1xuICAgICAgICAgIGNvbnN0IGNoYW5uZWwgPSByZWFkQ2hhbm5lbChyYXcsIHBvcyk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZXZlbnRzLmVtaXQoJ3F1ZXJ5JywgeyAuLi5jaGFubmVsIH0sIHJlbW90ZSk7XG4gICAgICAgIH1cbiAgICAgICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcHJvY2VzcyAke2hlYWRlci5zZXJ2aWNlSWR9YCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gdGhpcy5ldmVudHMuZW1pdCgndW5wcm9jZXNzZWQnLCBlcnIsIHJhdywgcmVtb3RlKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==