"use strict";
function check(i) {
    if (i < 0) {
        throw Error('Index should not be zero or negative number');
    }
}
/**
 * Class helper acts as iterrator to access buffer
 */
class SmartCursor {
    constructor(i = 0) {
        this.cursor = i;
        this.memorizedCursor = i;
    }
    jump(i) {
        check(i);
        this.cursor = i;
        this.memorizedCursor = i;
        return this;
    }
    skip(_field, nextPos = 1) {
        this.next(nextPos);
        return this;
    }
    diff(sync = true) {
        const memorized = this.cursor - this.memorizedCursor;
        if (sync) {
            this.jump(this.cursor);
        }
        return memorized;
    }
    memorize() {
        this.memorizedCursor = this.cursor;
        return this;
    }
    next(nextPos = 1) {
        check(nextPos);
        const clone = this.cursor;
        this.cursor += nextPos;
        return clone;
    }
    get memorized() {
        return this.memorizedCursor;
    }
    get cur() {
        return this.cursor;
    }
}
exports.SmartCursor = SmartCursor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic21hcnQtY3Vyc29yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL3NtYXJ0LWN1cnNvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsZUFBZSxDQUFTO0lBQ3RCLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1YsTUFBTSxLQUFLLENBQUMsNkNBQTZDLENBQUMsQ0FBQztJQUM3RCxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0g7SUFHRSxZQUFZLElBQVksQ0FBQztRQUN2QixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNoQixJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBQ00sSUFBSSxDQUFDLENBQVM7UUFDbkIsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDaEIsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUM7UUFDekIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFDTSxJQUFJLENBQUMsTUFBZSxFQUFFLE9BQU8sR0FBRyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbkIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFDTSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUk7UUFDckIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDO1FBQ3JELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDVCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6QixDQUFDO1FBQ0QsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBQ00sUUFBUTtRQUNiLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUNuQyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNNLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQztRQUNyQixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzFCLElBQUksQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDO1FBQ3ZCLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0QsSUFBSSxTQUFTO1FBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUM7SUFDOUIsQ0FBQztJQUNELElBQUksR0FBRztRQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3JCLENBQUM7Q0FDRjtBQXhDRCxrQ0F3Q0MiLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBjaGVjayhpOiBudW1iZXIpIHtcbiAgaWYgKGkgPCAwKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0luZGV4IHNob3VsZCBub3QgYmUgemVybyBvciBuZWdhdGl2ZSBudW1iZXInKTtcbiAgfVxufVxuXG4vKipcbiAqIENsYXNzIGhlbHBlciBhY3RzIGFzIGl0ZXJyYXRvciB0byBhY2Nlc3MgYnVmZmVyXG4gKi9cbmV4cG9ydCBjbGFzcyBTbWFydEN1cnNvciB7XG4gIHByaXZhdGUgY3Vyc29yOiBudW1iZXI7XG4gIHByaXZhdGUgbWVtb3JpemVkQ3Vyc29yOiBudW1iZXI7XG4gIGNvbnN0cnVjdG9yKGk6IG51bWJlciA9IDApIHtcbiAgICB0aGlzLmN1cnNvciA9IGk7XG4gICAgdGhpcy5tZW1vcml6ZWRDdXJzb3IgPSBpO1xuICB9XG4gIHB1YmxpYyBqdW1wKGk6IG51bWJlcikge1xuICAgIGNoZWNrKGkpO1xuICAgIHRoaXMuY3Vyc29yID0gaTtcbiAgICB0aGlzLm1lbW9yaXplZEN1cnNvciA9IGk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgcHVibGljIHNraXAoX2ZpZWxkPzogc3RyaW5nLCBuZXh0UG9zID0gMSkge1xuICAgIHRoaXMubmV4dChuZXh0UG9zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBwdWJsaWMgZGlmZihzeW5jID0gdHJ1ZSkge1xuICAgIGNvbnN0IG1lbW9yaXplZCA9IHRoaXMuY3Vyc29yIC0gdGhpcy5tZW1vcml6ZWRDdXJzb3I7XG4gICAgaWYgKHN5bmMpIHtcbiAgICAgIHRoaXMuanVtcCh0aGlzLmN1cnNvcik7XG4gICAgfVxuICAgIHJldHVybiBtZW1vcml6ZWQ7XG4gIH1cbiAgcHVibGljIG1lbW9yaXplKCkge1xuICAgIHRoaXMubWVtb3JpemVkQ3Vyc29yID0gdGhpcy5jdXJzb3I7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgcHVibGljIG5leHQobmV4dFBvcyA9IDEpIHtcbiAgICBjaGVjayhuZXh0UG9zKTtcbiAgICBjb25zdCBjbG9uZSA9IHRoaXMuY3Vyc29yO1xuICAgIHRoaXMuY3Vyc29yICs9IG5leHRQb3M7XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG4gIGdldCBtZW1vcml6ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVtb3JpemVkQ3Vyc29yO1xuICB9XG4gIGdldCBjdXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3Vyc29yO1xuICB9XG59XG4iXX0=