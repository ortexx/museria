const fse = require('fs-extra');
const tools = require('./tools');

describe('museria', () => {
  before(async () => {
    await fse.ensureDir(tools.tmpPath);
    await fse.copy(require.resolve('./data/audio.mp3'), tools.tmpPath + '/audio.mp3');
    await fse.copy(require.resolve('./data/cover.jpg'), tools.tmpPath + '/cover.jpg');
  });
  after(() => fse.remove(tools.tmpPath));
  require('./node');
  require('./client');
  require('./services');
  require('./routes');
  require('./utils');
  require('./group');
});