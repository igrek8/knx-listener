// tslint:disable:quotemark:
// tslint:disable:eofline

const root = process.argv[2];
const file = process.argv[3];

const jest = require('jest');
const path = require('path');

let targetFile;

if (/spec.ts$/.test(file)) {
  // simply run the test file
  targetFile = path.relative(path.join(root, '__tests__'), file)
    .replace(/ts$/, 'js');
} else {
  // find test file
  targetFile = path.relative(path.join(root, 'src'), file)
    .replace(/ts$/, 'spec.js');
}

jest.run(['--runInBand', targetFile]);