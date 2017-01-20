function check(i: number) {
  if (i < 0) {
    throw Error('Index should not be zero or negative number');
  }
}

/**
 * Class helper acts as iterrator to access buffer
 */
export class SmartCursor {
  private cursor: number;
  private memorizedCursor: number;
  constructor(i: number = 0) {
    this.cursor = i;
    this.memorizedCursor = i;
  }
  public jump(i: number) {
    check(i);
    this.cursor = i;
    this.memorizedCursor = i;
    return this;
  }
  public skip(_field?: string, nextPos = 1) {
    this.next(nextPos);
    return this;
  }
  public diff(sync = true) {
    const memorized = this.cursor - this.memorizedCursor;
    if (sync) {
      this.jump(this.cursor);
    }
    return memorized;
  }
  public memorize() {
    this.memorizedCursor = this.cursor;
    return this;
  }
  public next(nextPos = 1) {
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
