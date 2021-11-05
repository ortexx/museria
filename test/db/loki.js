const assert = require('chai').assert;
const tools = require('../tools');
const DatabaseLokiMuseria = require('../../src/db/transports/loki')();
const utils = require('../../src/utils');

describe('DatabaseLokiMetastocle', () => {
  let loki;
  let lastNodeDb;
  
  describe('instance creation', function () {
    it('should create an instance', function () { 
      assert.doesNotThrow(() => loki = new DatabaseLokiMuseria({
        filename: tools.getDbFilePath(this.node)
      }));    
      loki.node = this.node;
      lastNodeDb = this.node.db;
      this.node.db = loki;
    });
  });

  describe('.init()', function () { 
    it('should not throw an exception', async function () {
      await loki.init();
    });

    it('should create a music collection', async function () {
      await loki.addCollection('music', { pk: 'title', loki: { unique: ['fileHash'] } });
    })
  });  

  describe('.getMusicByPk()', function () {
    it('should return the document', async function () {
      const title = 'artist - title';
      await loki.addMusicDocument({ title: title + '0' });
      await loki.addMusicDocument({ title: title + '1' });
      await loki.addMusicDocument({ title: title + '2' });
      const docStrict = await loki.getMusicByPk(title + '1');
      const doc = await loki.getMusicByPk(title + 'on');
      assert.equal(docStrict.title, utils.beautifySongTitle(title + '1'), 'check the strict document');
      assert.isObject(doc, 'check the approximate document');
    });

    it('should return null', async function () {
      assert.isNull(await loki.getMusicByPk('wrong'));
    });
  });

  describe('.getMusicByFileHash()', function () {
    it('should get the right document', async function () {
      const hash = 'y';
      await loki.addMusicDocument({ title: 'it - is a song', fileHash: hash });
      const doc = await loki.getMusicByFileHash(hash);
      assert.equal(doc.fileHash, hash);
    });

    it('should return null', async function () {
      assert.isNull(await loki.getMusicByFileHash('wrong'));
    });
  });

  describe('.removeMusicByFileHash()', function () {
    it('should not remove anything', async function () {
      const count = await loki.getCollectionSize('music');
      await loki.removeMusicByFileHash('x');
      assert.equal(count, await loki.getCollectionSize('music'));
    });

    it('should remove only the necessary document', async function () {
      const count = await loki.getCollectionSize('music');
      await loki.addMusicDocument({ title: 'new - song', fileHash: 'x' });
      await loki.removeMusicByFileHash('x');
      assert.equal(count, await loki.getCollectionSize('music'));
    });
  });

  describe('.deinit()', function () { 
    it('should not throw an exception', async function () {
      await loki.deinit();
    });
  }); 

  describe('reinitialization', () => {
    it('should not throw an exception', async function () {
      await loki.init();
    });
  });
  
  describe('.destroy()', function () { 
    it('should not throw an exception', async function () {
      await loki.destroy();
      this.node.db = lastNodeDb;
    });
  });
});