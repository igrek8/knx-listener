import { AsyncSocket } from 'src/utils/async-socket';
import { mockSocket, FakeSocket } from '__tests__/helpers/fake-socket';

jest.mock('dgram');

(jasmine as any).DEFAULT_TIMEOUT_INTERVAL = 0;

describe('Async socket', () => {
  let sock: FakeSocket;
  let s: AsyncSocket;
  beforeEach(() => {
    sock = mockSocket();
    s = new AsyncSocket();
  });
  it('should resolve connect promise', (done) => {
    s.connect(8000).then(({port}) => {
      expect(port).toBe(8000);
      done();
    });
    sock.fakeConnected();
  });
  it('should reject connect promise', (done) => {
    const err = new Error('my error');
    sock.failNextBind(err);
    s.connect(8000).catch(e => {
      expect(e).toBe(err);
      done();
    });
  });
  describe('when connected', () => {
    const d = Buffer.from([3, 2, 1]);
    beforeEach((done) => {
      s.connect(8000).then(done);
      sock.fakeConnected();
    });
    it('should broadcast raw data', (done) => {
      s.on('raw', (raw) => {
        expect(raw).toBe(d);
        done();
      });
      sock.fakeData(d);
    });
    it('should resolve connect promise when already connected and return used port', (done) => {
      s.connect(1000).then(({port}) => {
        try {
          expect(port).toBe(8000);
          done();
        } catch (e) { done.fail(e); }
      });
    });
    it('should close connection', (done) => {
      s.disconnect().then(() => {
        try {
          expect(sock.close).toBeCalled();
          done();
        } catch (e) { done.fail(e); }
      });
      sock.fakeClose();
    });
    it('should complete when closed', (done) => {
      s.complete().then(done);
      sock.fakeClose();
    });
    it('should send data', (done) => {
      sock.fakeNextSend(null, d.byteLength);
      s.send('localhost', 1000, d).then(() => {
        try {
          const call = sock.send.mock.calls[0];
          call.pop();
          expect(call).toEqual([d, 1000, 'localhost']);
          done();
        } catch (e) { done.fail(e); }
      });
    });
    it('should reject send promise on error', (done) => {
      const err = new Error('bad send');
      sock.fakeNextSend(err);
      s.send('localhost', 1000, d).catch((e) => {
        try {
          expect(e).toBe(err);
          done();
        } catch (e) { done.fail(e); }
      });
    });
    it('should reject send promise if not all data sent', (done) => {
      const bytesn = 1;
      const err = new Error(`Expected to send ${d.length} bytes, but sent ${bytesn}`);
      sock.fakeNextSend(null, bytesn);
      s.send('localhost', 1000, d).catch(e => {
        try {
          expect(e).toEqual(err);
        } catch (e) { done.fail(e); }
        done();
      });
    });
  });
});
