/**
 * Class helper acts as iterrator to access buffer
 */
export declare class SmartCursor {
    private cursor;
    private memorizedCursor;
    constructor(i?: number);
    jump(i: number): this;
    skip(_field?: string, nextPos?: number): this;
    diff(sync?: boolean): number;
    memorize(): this;
    next(nextPos?: number): number;
    readonly memorized: number;
    readonly cur: number;
}
