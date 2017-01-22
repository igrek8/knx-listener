"use strict";
function header(raw, pos) {
    const headerLength = raw.readUInt8(pos.next());
    const protocolVersion = raw.readUInt8(pos.next());
    const serviceId = raw.readUInt16BE(pos.next(2));
    const totalLength = raw.readUInt16BE(pos.next(2));
    if (headerLength !== 0x06) {
        throw new Error(`Invalid header length ${headerLength}`);
    }
    if (protocolVersion !== 0x10) {
        throw new Error(`Invalid protocol version ${protocolVersion}`);
    }
    if (raw.length !== totalLength) {
        throw new Error(`Invalid total length, expected ${raw.length}, but got ${totalLength}`);
    }
    return {
        serviceId,
    };
}
exports.header = header;
;
function channel(raw, pos) {
    const channelId = raw.readUInt8(pos.next());
    const status = raw.readUInt8(pos.next());
    if (channelId === 0) {
        throw new Error(`Invalid channel id ${channelId}`);
    }
    return {
        channelId, status,
    };
}
exports.channel = channel;
;
function hpai(raw, pos) {
    const size = raw.readUInt8(pos.next());
    if (size !== 0x8) {
        throw new Error(`Failed to read hpai at ${pos.cur}`);
    }
    const protocol = raw.readUInt8(pos.next());
    const ip = raw.readUIntBE(pos.next(4), 4);
    const port = raw.readInt16BE(pos.next(2));
    return {
        ip, port, protocol,
    };
}
exports.hpai = hpai;
;
function connectResponse(raw, pos) {
    const size = raw.readInt8(pos.next());
    const contype = raw.readInt8(pos.next());
    switch (contype) {
        case 4 /* Tunnel */: {
            if (size !== 0x4) {
                throw new Error(`Failed to read connect response for tunneling at ${pos.cur}`);
            }
            const knxAddress = raw.readUInt16BE(pos.next(2));
            return {
                connectionType: contype,
                knxAddress,
            };
        }
        default: throw new Error(`Unknown connection type ${contype}`);
    }
}
exports.connectResponse = connectResponse;
;
function seqnum(raw, pos) {
    const size = raw.readUInt8(pos.next());
    if (size !== 0x4) {
        throw new Error(`Failed to read structure at ${pos.cur}`);
    }
    const channelId = raw.readUInt8(pos.next());
    const seqn = raw.readInt8(pos.next());
    const status = raw.readUInt8(pos.next());
    return {
        channelId, seqn, status,
    };
}
exports.seqnum = seqnum;
;
function tunnelCemi(raw, pos) {
    pos.skip('messageCode');
    const additionalInfoLength = raw.readUInt8(pos.next());
    if (additionalInfoLength) {
        pos.skip('additionalInfo', additionalInfoLength);
    }
    pos.skip('controlField1');
    pos.skip('controlField2');
    const source = raw.readUInt16BE(pos.next(2));
    const dest = raw.readUInt16BE(pos.next(2));
    const npduLength = raw.readUInt8(pos.next());
    const apdu = raw.readUInt16BE(pos.next(2));
    const action = apdu & (128 /* GroupWrite */ |
        64 /* GroupResponse */ | 0 /* GroupRead */);
    if (action & (128 /* GroupWrite */ | 64 /* GroupResponse */)) {
        let data;
        if (npduLength > 1) {
            // data appended
            data = raw.subarray(pos.next(npduLength), pos.cur);
        }
        else {
            // data merged into 6 bits
            data = new Uint8Array([apdu & 0x3f]);
        }
        return {
            data, action, dest, source,
        };
    }
    else {
        // read
        return {
            action, dest, source,
        };
    }
}
exports.tunnelCemi = tunnelCemi;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVzZXJpYWxpemVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2Rlc2VyaWFsaXplci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBYUEsZ0JBQXVCLEdBQVcsRUFBRSxHQUFnQjtJQUNsRCxNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQy9DLE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDbEQsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEQsRUFBRSxDQUFDLENBQUMsWUFBWSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBQ0QsRUFBRSxDQUFDLENBQUMsZUFBZSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyw0QkFBNEIsZUFBZSxFQUFFLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBQ0QsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQy9CLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLEdBQUcsQ0FBQyxNQUFNLGFBQWEsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBQ0QsTUFBTSxDQUFDO1FBQ0wsU0FBUztLQUNWLENBQUM7QUFDSixDQUFDO0FBakJELHdCQWlCQztBQUFBLENBQUM7QUFFRixpQkFBd0Is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QU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxvQkFBbUI7UUFDeEMsc0JBQXNCLEdBQUcsaUJBQWtCLENBQUMsQ0FBQztJQUMvQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxvQkFBbUIsR0FBRyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1RCxJQUFJLElBQWdCLENBQUM7UUFDckIsRUFBRSxDQUFDLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkIsZ0JBQWdCO1lBQ2hCLElBQUksR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLDBCQUEwQjtZQUMxQixJQUFJLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsTUFBTSxDQUFDO1lBQ0wsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTTtTQUMzQixDQUFDO0lBQ0osQ0FBQztJQUFDLElBQUksQ0FBQyxDQUFDO1FBQ04sT0FBTztRQUNQLE1BQU0sQ0FBQztZQUNMLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTTtTQUNyQixDQUFDO0lBQ0osQ0FBQztBQUNILENBQUM7QUFoQ0QsZ0NBZ0NDO0FBQUEsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENvbm5lY3Rpb24sXG4gIEJ1c0V2ZW50LFxufSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQge1xuICBTbWFydEN1cnNvcixcbn0gZnJvbSAnLi91dGlscy9zbWFydC1jdXJzb3InO1xuaW1wb3J0IHtcbiAgQ2hhbm5lbCxcbiAgSGVhZGVyLFxuICBIcGFpLFxufSBmcm9tICcuL2ludGVyZmFjZXMnO1xuXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyKHJhdzogQnVmZmVyLCBwb3M6IFNtYXJ0Q3Vyc29yKTogSGVhZGVyIHtcbiAgY29uc3QgaGVhZGVyTGVuZ3RoID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgY29uc3QgcHJvdG9jb2xWZXJzaW9uID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgY29uc3Qgc2VydmljZUlkID0gcmF3LnJlYWRVSW50MTZCRShwb3MubmV4dCgyKSk7XG4gIGNvbnN0IHRvdGFsTGVuZ3RoID0gcmF3LnJlYWRVSW50MTZCRShwb3MubmV4dCgyKSk7XG4gIGlmIChoZWFkZXJMZW5ndGggIT09IDB4MDYpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaGVhZGVyIGxlbmd0aCAke2hlYWRlckxlbmd0aH1gKTtcbiAgfVxuICBpZiAocHJvdG9jb2xWZXJzaW9uICE9PSAweDEwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHByb3RvY29sIHZlcnNpb24gJHtwcm90b2NvbFZlcnNpb259YCk7XG4gIH1cbiAgaWYgKHJhdy5sZW5ndGggIT09IHRvdGFsTGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHRvdGFsIGxlbmd0aCwgZXhwZWN0ZWQgJHtyYXcubGVuZ3RofSwgYnV0IGdvdCAke3RvdGFsTGVuZ3RofWApO1xuICB9XG4gIHJldHVybiB7XG4gICAgc2VydmljZUlkLFxuICB9O1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNoYW5uZWwocmF3OiBCdWZmZXIsIHBvczogU21hcnRDdXJzb3IpOiBDaGFubmVsIHtcbiAgY29uc3QgY2hhbm5lbElkID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgY29uc3Qgc3RhdHVzID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgaWYgKGNoYW5uZWxJZCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjaGFubmVsIGlkICR7Y2hhbm5lbElkfWApO1xuICB9XG4gIHJldHVybiB7XG4gICAgY2hhbm5lbElkLCBzdGF0dXMsXG4gIH07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gaHBhaShyYXc6IEJ1ZmZlciwgcG9zOiBTbWFydEN1cnNvcik6IEhwYWkge1xuICBjb25zdCBzaXplID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgaWYgKHNpemUgIT09IDB4OCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHJlYWQgaHBhaSBhdCAke3Bvcy5jdXJ9YCk7XG4gIH1cbiAgY29uc3QgcHJvdG9jb2wgPSByYXcucmVhZFVJbnQ4KHBvcy5uZXh0KCkpO1xuICBjb25zdCBpcCA9IHJhdy5yZWFkVUludEJFKHBvcy5uZXh0KDQpLCA0KTtcbiAgY29uc3QgcG9ydCA9IHJhdy5yZWFkSW50MTZCRShwb3MubmV4dCgyKSk7XG4gIHJldHVybiB7XG4gICAgaXAsIHBvcnQsIHByb3RvY29sLFxuICB9O1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3RSZXNwb25zZShyYXc6IEJ1ZmZlciwgcG9zOiBTbWFydEN1cnNvcikge1xuICBjb25zdCBzaXplID0gcmF3LnJlYWRJbnQ4KHBvcy5uZXh0KCkpO1xuICBjb25zdCBjb250eXBlID0gcmF3LnJlYWRJbnQ4KHBvcy5uZXh0KCkpO1xuICBzd2l0Y2ggKGNvbnR5cGUpIHtcbiAgICBjYXNlIENvbm5lY3Rpb24uVHVubmVsOiB7XG4gICAgICBpZiAoc2l6ZSAhPT0gMHg0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHJlYWQgY29ubmVjdCByZXNwb25zZSBmb3IgdHVubmVsaW5nIGF0ICR7cG9zLmN1cn1gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGtueEFkZHJlc3MgPSByYXcucmVhZFVJbnQxNkJFKHBvcy5uZXh0KDIpKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvbm5lY3Rpb25UeXBlOiBjb250eXBlLFxuICAgICAgICBrbnhBZGRyZXNzLFxuICAgICAgfTtcbiAgICB9XG4gICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGNvbm5lY3Rpb24gdHlwZSAke2NvbnR5cGV9YCk7XG4gIH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXFudW0ocmF3OiBCdWZmZXIsIHBvczogU21hcnRDdXJzb3IpIHtcbiAgY29uc3Qgc2l6ZSA9IHJhdy5yZWFkVUludDgocG9zLm5leHQoKSk7XG4gIGlmIChzaXplICE9PSAweDQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byByZWFkIHN0cnVjdHVyZSBhdCAke3Bvcy5jdXJ9YCk7XG4gIH1cbiAgY29uc3QgY2hhbm5lbElkID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgY29uc3Qgc2VxbiA9IHJhdy5yZWFkSW50OChwb3MubmV4dCgpKTtcbiAgY29uc3Qgc3RhdHVzID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgcmV0dXJuIHtcbiAgICBjaGFubmVsSWQsIHNlcW4sIHN0YXR1cyxcbiAgfTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB0dW5uZWxDZW1pKHJhdzogQnVmZmVyLCBwb3M6IFNtYXJ0Q3Vyc29yKSB7XG4gIHBvcy5za2lwKCdtZXNzYWdlQ29kZScpO1xuICBjb25zdCBhZGRpdGlvbmFsSW5mb0xlbmd0aCA9IHJhdy5yZWFkVUludDgocG9zLm5leHQoKSk7XG4gIGlmIChhZGRpdGlvbmFsSW5mb0xlbmd0aCkge1xuICAgIHBvcy5za2lwKCdhZGRpdGlvbmFsSW5mbycsIGFkZGl0aW9uYWxJbmZvTGVuZ3RoKTtcbiAgfVxuICBwb3Muc2tpcCgnY29udHJvbEZpZWxkMScpO1xuICBwb3Muc2tpcCgnY29udHJvbEZpZWxkMicpO1xuICBjb25zdCBzb3VyY2UgPSByYXcucmVhZFVJbnQxNkJFKHBvcy5uZXh0KDIpKTtcbiAgY29uc3QgZGVzdCA9IHJhdy5yZWFkVUludDE2QkUocG9zLm5leHQoMikpO1xuICBjb25zdCBucGR1TGVuZ3RoID0gcmF3LnJlYWRVSW50OChwb3MubmV4dCgpKTtcbiAgY29uc3QgYXBkdSA9IHJhdy5yZWFkVUludDE2QkUocG9zLm5leHQoMikpO1xuICBjb25zdCBhY3Rpb24gPSBhcGR1ICYgKEJ1c0V2ZW50Lkdyb3VwV3JpdGUgfFxuICAgIEJ1c0V2ZW50Lkdyb3VwUmVzcG9uc2UgfCBCdXNFdmVudC5Hcm91cFJlYWQpO1xuICBpZiAoYWN0aW9uICYgKEJ1c0V2ZW50Lkdyb3VwV3JpdGUgfCBCdXNFdmVudC5Hcm91cFJlc3BvbnNlKSkge1xuICAgIGxldCBkYXRhOiBVaW50OEFycmF5O1xuICAgIGlmIChucGR1TGVuZ3RoID4gMSkge1xuICAgICAgLy8gZGF0YSBhcHBlbmRlZFxuICAgICAgZGF0YSA9IHJhdy5zdWJhcnJheShwb3MubmV4dChucGR1TGVuZ3RoKSwgcG9zLmN1cik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGRhdGEgbWVyZ2VkIGludG8gNiBiaXRzXG4gICAgICBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoW2FwZHUgJiAweDNmXSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhLCBhY3Rpb24sIGRlc3QsIHNvdXJjZSxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIC8vIHJlYWRcbiAgICByZXR1cm4ge1xuICAgICAgYWN0aW9uLCBkZXN0LCBzb3VyY2UsXG4gICAgfTtcbiAgfVxufTtcbiJdfQ==