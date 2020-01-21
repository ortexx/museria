const assert = require('chai').assert;
const sharp = require('sharp');
const url = require('url');
const Node = require('../src/node')();
const utils = require('../src/utils');
const tools = require('./tools');

describe('Node', () => {
  let node;

  describe('instance creation', () => {
    it('should create an instance', async () => { 
      const options = await tools.createNodeOptions();
      assert.doesNotThrow(() => node = new Node(options));
    });
  });

  describe('.init()', () => {
    it('should not throw an exception', async () => {
      await node.init();
    });
  });

  describe('.addSong()', () => {
    it('should throw an error because of a wrong title', async () => {
      try {
        await node.addSong(tools.tmpPath + '/audio.mp3');
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should add the song', async () => {
      const file = tools.tmpPath + '/audio.mp3';
      const title = 'artist - title' ;
      await utils.setSongTags(file, { fullTitle: title, TIT3: 'x' });  
      const result = await node.addSong(file);
      const doc = await node.db.getMusicByPk(result.title);
      assert.equal(await utils.beautifySongTitle(title), result.title, 'check the title');
      assert.equal(result.tags.TIT3, 'x', 'check the tags');
      assert.isNotNull(doc, 'check the database');
      assert.isTrue(await node.hasFile(doc.fileHash), 'check the file');
      assert.isTrue(await utils.isValidSongAudioLink(result.audioLink), 'check the audio link');
      assert.isTrue(result.coverLink == '', 'check the cover link');
    });

    it('should not replace the current song with the similar one', async () => {
      let file = tools.tmpPath + '/audio.mp3';
      const title = 'artist - title1' ;
      file = await utils.setSongTags(file, { fullTitle: title, TIT3: 'y', TALB: 'z' });  
      const result = await node.addSong(file);      
      const docs = await node.db.getDocuments('music');
      assert.lengthOf(docs, 1, 'check the docs');
      assert.notEqual(await utils.beautifySongTitle(title), result.title, 'check the title');
      assert.isOk(result.tags.TIT3 == 'x' && result.tags.TALB == 'z', 'check the tags');
      assert.isFalse(await node.hasFile(await utils.getFileHash(file)), 'check the file');
    });

    it('should replace the current song with the similar one', async () => {
      const rel = node.options.music.relevanceTime;
      node.options.music.relevanceTime = 1;
      let file = tools.tmpPath + '/audio.mp3';
      const title = 'artist - title2' ;
      file = await utils.setSongTags(file, { fullTitle: title, TIT3: 'y'});
      const oldDoc = await node.db.getMusicByPk(title);
      const result = await node.addSong(file);
      const newDoc = await node.db.getMusicByPk(title);
      const docs = await node.db.getDocuments('music'); 
      const tags = utils.createSongTags(result.tags);
      assert.lengthOf(docs, 1, 'check the docs');
      assert.equal(await utils.beautifySongTitle(title), tags.fullTitle, 'check the title');
      assert.equal(result.tags.TIT3, 'y', 'check the tags');
      assert.isTrue(await node.hasFile(newDoc.fileHash), 'check the new file');
      assert.isFalse(await node.hasFile(oldDoc.fileHash), 'check the old file');
      node.options.music.relevanceTime = rel;
    });

    it('should add the song with a cover', async () => {
      const file = tools.tmpPath + '/audio.mp3';
      const title = 'new - song';
      await utils.setSongTags(file, { fullTitle: title, APIC: tools.tmpPath + '/cover.jpg' });  
      const result = await node.addSong(file);
      const doc = await node.db.getMusicByPk(result.title);
      const docs = await node.db.getDocuments('music'); 
      assert.equal(await utils.beautifySongTitle(title), result.title, 'check the title');
      assert.isNotNull(doc, 'check the doc');
      assert.lengthOf(docs, 2, 'check the database');
      assert.isTrue(await utils.isValidSongCoverLink(result.coverLink), 'check the audio link');      
    });
  });

  describe('.getSongInfo()', () => {
    it('should throw an error', async () => {
      try {
        await node.getSongInfo('unexistent song');
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return an empty array', async () => {
      const title = 'unexistent - song';
      const result = await node.getSongInfo(title);
      assert.lengthOf(result, 0);
    });

    it('should return the appropriate song', async () => {
      const title = 'a new - song';
      const similarity = node.options.music.similarity;
      const result = await node.getSongInfo(title);
      const doc = await node.db.getMusicByPk(title);
      const tags = utils.createSongTags(result[0].tags);
      assert.lengthOf(result, 1, 'check the array');
      assert.isTrue(utils.getSongSimilarity(doc.title, result[0].title) >= similarity, 'check the title');
      assert.equal(tags.fullTitle, doc.title, 'check the tags');
      assert.isTrue(await utils.isValidSongAudioLink(result[0].audioLink), 'check the audio link');
      assert.isTrue(await utils.isValidSongCoverLink(result[0].coverLink), 'check the cover link');
    });
  });

  describe('.getSongAudioLink()', () => {
    it('should throw an error', async () => {
      try {
        await node.getSongAudioLink('unexistent song');
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return an empty string', async () => {
      const result = await node.getSongAudioLink('unexistent - song');
      assert.equal(result, '');
    });

    it('should return the appropriate song link', async () => {
      const result = await node.getSongAudioLink('new - song');
      assert.isTrue(await utils.isValidSongAudioLink(result));
    });
  });

  describe('.getSongCoverLink()', () => {
    it('should throw an error', async () => {
      try {
        await node.getSongCoverLink('unexistent song');
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return an empty string', async () => {
      const result = await node.getSongCoverLink('unexistent - song');
      assert.equal(result, '');
    });

    it('should return the appropriate song link', async () => {
      const result = await node.getSongCoverLink('new - song');
      assert.isTrue(await utils.isValidSongCoverLink(result));
    });
  });

  describe('.removeSong()', () => {
    it('should remove the song', async () => {
      const title = 'artist - title2';
      const doc = await node.db.getMusicByPk(title)
      const res = await node.removeSong(title);
      assert.equal(res.removed, 1, 'check the result');
      assert.isNull(await node.db.getMusicByPk(title), 'check the database');
      assert.isFalse(await node.hasFile(doc.fileHash), 'check the file');
    });
  });  

  describe('.updateSongCache()', () => {
    let title;

    before(async () => {
      title = 'new - song';
    });

    it('should not add the cache because of a wrong link', async () => {
      const value = {
        audioLink: 'wrong'
      };
      await node.updateSongCache(title, value);
      assert.isNull(await node.cacheFile.get(title));
    });

    it('should not add the cache because of the same address', async () => {
      const doc = await node.db.getMusicByPk(title);
      const value = {
        audioLink: await node.createSongAudioLink(doc.fileHash),
        coverLink: await node.createSongCoverLink(doc.fileHash)
      };
      await node.updateSongCache(title, value);
      assert.isNull(await node.cacheFile.get(title));
    });

    it('should add the cache partially', async () => {
      const doc = await node.db.getMusicByPk(title);
      const info = url.parse(await node.createSongAudioLink(doc.fileHash));
      const audioLink = url.format(Object.assign(info, { host: 'example.com:80' }));
      const value = {
        audioLink,
        coverLink: 'wrong'
      };
      await node.updateSongCache(title, value);
      const cache = (await node.cacheFile.get(title)).value;
      assert.equal(audioLink, cache.audioLink, 'check the audio');
      assert.isNotOk(cache.coverLink, 'check the cover');
    });

    it('should add the cache completely', async () => {
      const doc = await node.db.getMusicByPk(title);
      let info = url.parse(await node.createSongAudioLink(doc.fileHash));
      const audioLink = url.format(Object.assign(info, { host: 'example.com:80' }));
      info = url.parse(await node.createSongCoverLink(doc.fileHash));
      const coverLink = url.format(Object.assign(info, { host: 'example.com:80' }));
      const value = {
        audioLink,
        coverLink,
        userless: true
      };
      await node.updateSongCache(title, value);
      const cache = (await node.cacheFile.get(title)).value;
      assert.equal(audioLink, cache.audioLink, 'check the audio');
      assert.equal(coverLink, cache.coverLink, 'check the cover');
      assert.isUndefined(cache.userless, 'check the wrong proprty');
    });
  });  
  
  describe('.createSongAudioLink()', () => {
    it('should create a right audio link', async () => {
      const doc = await node.db.getMusicByPk('new - song');
      const hash = doc.fileHash;
      assert.equal(await node.createSongAudioLink(hash), `http://${node.address}/audio/${hash}.mp3`);
    });
  });

  describe('.createSongCoverLink()', () => {
    it('should create a right cover link', async () => {
      const doc = await node.db.getMusicByPk('new - song');
      const hash = doc.fileHash;
      assert.equal(await node.createSongCoverLink(hash), `http://${node.address}/cover/${hash}.jpeg`);
    });
  });

  describe('.checkSongRelevance()', () => {
    let title; 

    before(() => {
      title = 'new - song';
    });
    
    it('should return true', async () => {
      const doc = await node.db.getMusicByPk(title);
      const filePath = node.getFilePath(doc.fileHash);
      assert.isTrue(await node.checkSongRelevance(filePath, filePath));
    });

    it('should return false', async () => {
      const rel = node.options.music.relevanceTime;
      node.options.music.relevanceTime = 1;
      const doc = await node.db.getMusicByPk(title);
      const filePath = node.getFilePath(doc.fileHash);
      assert.isFalse(await node.checkSongRelevance(filePath, filePath));
      node.options.music.relevanceTime = rel;
    });
  }); 

  describe('.removeFileFromStorage()', () => {
    let title; 

    before(() => {
      title = 'new - song';
    });

    it('should remove the file and the document', async () => {
      const doc = await node.db.getMusicByPk(title);
      await node.removeFileFromStorage(doc.fileHash);
      assert.isNull(await node.db.getMusicByPk(title), 'check the database');
      assert.isFalse(await node.hasFile(doc.fileHash), 'check the file');
    });

    it('should remove the file and the document', async () => {
      await node.addSong(tools.tmpPath + '/audio.mp3')
      const doc = await node.db.getMusicByPk(title);
      assert.isObject(doc, 'check the database before');
      await node.removeFileFromStorage(doc.fileHash, { ignoreDocument: true });
      assert.isObject(await node.db.getMusicByPk(title));
      assert.isFalse(await node.hasFile(doc.fileHash));
    });    
  });

  describe('.prepareSongCover', () => {
    it('should throw an error because of minimum width', async () => {
      try {
        const image = sharp(tools.tmpPath + '/cover.jpg');
        const metadata = await image.metadata();
        image.resize(node.options.music.coverMinSize - 1, metadata.height);
        await node.prepareSongCover(await image.toBuffer());
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Minimum size'));
      }
    });

    it('should throw an error because of minimum height', async () => {
      try {
        const image = sharp(tools.tmpPath + '/cover.jpg');
        const metadata = await image.metadata();
        image.resize(metadata.width, node.options.music.coverMinSize - 1);
        await node.prepareSongCover(await image.toBuffer());
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Minimum size'));
      }
    });

    it('should prepare and resize the image', async () => {
      const maxSize = node.options.music.coverMaxSize; 
      const buffer = await node.prepareSongCover(tools.tmpPath + '/cover.jpg');      
      const image = sharp(buffer);
      const metadata = await image.metadata();
      assert.instanceOf(buffer, Buffer);
      assert.isTrue(metadata.width <= maxSize && metadata.height <= maxSize);
    });
  }); 

  describe('.prepareSongTitle()', () => {
    it('should return beautified title', async () => {
      const title = 'artist - song ft. artist2';
      const res = await node.prepareSongTitle(title);
      assert.equal(res, utils.beautifySongTitle(title));
    });
  });
  
  describe('.cleanUpMusic()', () => {
    it('should remove wrong documents', async () => {
      const title = 'test - test';
      await node.db.addDocument('music', { title });
      await node.cleanUpMusic();
      assert.isNull(await node.db.getDocumentByPk('music', title))
    });

    it('should remove wrong files', async () => {    
      const filePath = await utils.setSongTags(tools.tmpPath + '/audio.mp3', { fullTitle: 'another - song' });  
      const hash = await utils.getFileHash(filePath);      
      await node.addFileToStorage(filePath, hash, { copy: true });
      await node.cleanUpMusic();
      assert.isFalse(await node.hasFile(hash));
    });
  });

  describe('.exportSongs()', () => {
    let importNode;
    
    before(async () => {
      importNode = new Node(await tools.createNodeOptions());
      await importNode.init();
    });

    after(async () => {
      await importNode.deinit();
    });

    it('should export the song', async () => {
      const title = 'export - song';
      const filePath = tools.tmpPath + '/audio.mp3';
      const file = await utils.setSongTags(filePath, { fullTitle: title });      
      await node.addSong(file);
      await node.exportSongs(importNode.address);
      const doc = await importNode.db.getMusicByPk(title);
      assert.isNotNull(doc, 'check the database');
      assert.isTrue(await importNode.hasFile(doc.fileHash), 'check the file');
    });
  });

  describe('.songTitleTest()', () => {
    it('should throw an error', () => {
      try {
        node.songTitleTest('wrong song title');
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Wrong song'));
      }
    });

    it('should not throw an error', async () => {
      node.songTitleTest('artist - title');
    });
  });  
  
  describe('.deinit()', () => {
    it('should not throw an exception', async () => {
      await node.deinit();
    });
  }); 

  describe('reinitialization', () => {
    it('should not throw an exception', async () => {
      await node.init();
    });
  });

  describe('.destroy()', () => {
    it('should not throw an exception', async () => {
      await node.destroy();
    });
  });
});