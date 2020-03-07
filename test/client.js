const assert = require('chai').assert;
const fse = require('fs-extra');
const path = require('path');
const Node = require('../src/node')();
const Client = require('../src/client')();
const utils = require('../src/utils');
const tools = require('./tools');

describe('Client', () => {
  let client;
  let node;

  before(async function() {
    node = new Node(await tools.createNodeOptions());
    await node.init();
  });

  after(async function() {
    await node.deinit();
  });

  describe('instance creation', function () {
    it('should create an instance', async function () { 
      const options = await tools.createClientOptions({ address: node.address });
      assert.doesNotThrow(() => client = new Client(options));
    });
  });

  describe('.init()', function () {
    it('should not throw an exception', async function () {
      await client.init();
    });
  });

  describe('.addSong()', function () {
    it('should not add the song with a wrong title', async function () {
      const file = await utils.setSongTags(path.join(tools.tmpPath, 'audio.mp3'), { fullTitle: 'wrong' });
      try {
        await client.addSong(file);
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should add the song', async () => {
      const title = 'artist - title';
      const file = await utils.setSongTags(path.join(tools.tmpPath, 'audio.mp3'), { 
        fullTitle: title, 
        APIC: path.join(tools.tmpPath, 'cover.jpg'),
        TIT3: 'x'
      });
      const result = await client.addSong(file);
      const doc = await node.db.getMusicByPk(result.title);
      assert.equal(await utils.beautifySongTitle(title), result.title, 'check the title');
      assert.equal(result.tags.TIT3, 'x', 'check the tags');
      assert.isNotNull(doc, 'check the database');
      assert.isTrue(await node.hasFile(doc.fileHash), 'check the file');
      assert.isTrue(await utils.isValidSongAudioLink(result.audioLink), 'check the audio link');
      assert.isTrue(await utils.isValidSongCoverLink(result.coverLink), 'check the cover link');
    });
  });

  describe('.getSongInfo()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongInfo('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return an empty array', async function () {
      const info = await client.getSongInfo('unexistent - song');      
      assert.lengthOf(info, 0);
    });

    it('should return the info', async function () {
      const title = 'artist - title';
      const info = await client.getSongInfo(title);
      const result = info[0];
      assert.lengthOf(info, 1, 'check the length');
      assert.equal(await utils.beautifySongTitle(title), result.title, 'check the title');
      assert.equal(result.tags.TIT3, 'x', 'check the tags');
      assert.isTrue(await utils.isValidSongAudioLink(result.audioLink), 'check the audio link');
      assert.isTrue(await utils.isValidSongCoverLink(result.coverLink), 'check the cover link');
    });
  });  

  describe('.getSong()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSong('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return null', async function () {
      assert.isNull(await client.getSong('unexistent - song'));
    });

    it('should return the right info', async function () {
      const title = 'artist - title';
      const info = await client.getSong(title);
      assert.equal(await utils.beautifySongTitle(title), info.title, 'check the title');
      assert.equal(info.tags.TIT3, 'x', 'check the tags');
      assert.isTrue(await utils.isValidSongAudioLink(info.audioLink), 'check the audio link');
      assert.isTrue(await utils.isValidSongCoverLink(info.coverLink), 'check the cover link');
    });
  });

  describe('.getSongAudioLink()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongAudioLink('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return an empty string', async function () {
      assert.isEmpty(await client.getSongAudioLink('unexistent - song'));
    });

    it('should return the link', async function () {
      const link = await client.getSongAudioLink('artist - title')
      assert.isTrue(await utils.isValidSongAudioLink(link));
    });
  });

  describe('.getSongCoverLink()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongCoverLink('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return an empty string', async function () {
      assert.isEmpty(await client.getSongCoverLink('unexistent - song'));
    });

    it('should return the link', async function () {
      const link = await client.getSongCoverLink('artist - title')
      assert.isTrue(await utils.isValidSongCoverLink(link));
    });
  });

  describe('.getSongAudioToBuffer()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongAudioToBuffer('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should throw an error because of wrong link', async function () {
      try {
        await client.getSongAudioToBuffer('unexistent - song');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Link for song'));
      }
    });

    it('should be the same buffer', async function () {
      const title = 'artist - title';
      const doc = await node.db.getMusicByPk(title);
      const originalBuffer = await fse.readFile(node.getFilePath(doc.fileHash));
      const buffer = await client.getSongAudioToBuffer(title);
      assert.isTrue(Buffer.compare(originalBuffer, buffer) == 0);
    });
  });

  describe('.getSongCoverToBuffer()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongCoverToBuffer('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should throw an error because of wrong link', async function () {
      try {
        await client.getSongCoverToBuffer('unexistent - song');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Link for song'));
      }
    });

    it('should be the same buffer', async function () {
      const title = 'artist - title';
      const doc = await node.db.getMusicByPk(title);
      const originalBuffer = (await utils.getSongTags(node.getFilePath(doc.fileHash))).APIC;
      const buffer = await client.getSongCoverToBuffer(title);
      assert.isTrue(Buffer.compare(originalBuffer, buffer) == 0);
    });
  });

  describe('.getSongAudioToPath()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongAudioToPath('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should throw an error because of wrong link', async function () {
      try {
        await client.getSongAudioToPath('unexistent - song');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Link for song'));
      }
    });

    it('should save the file', async function () {
      const filePath = path.join(tools.tmpPath, 'audio-saved.mp3');
      const title = 'artist - title';
      const doc = await node.db.getMusicByPk(title);
      const originalBuffer = await fse.readFile(node.getFilePath(doc.fileHash));
      await client.getSongAudioToPath(title, filePath);
      const buffer = await fse.readFile(filePath);
      assert.isTrue(Buffer.compare(originalBuffer, buffer) == 0);
    });
  });

  describe('.getSongCoverToPath()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongCoverToPath('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should throw an error because of wrong link', async function () {
      try {
        await client.getSongCoverToPath('unexistent - song');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Link for song'));
      }
    });

    it('should save the file', async function () {
      const filePath = path.join(tools.tmpPath, '/cover-saved.jpg');
      const title = 'artist - title';
      const doc = await node.db.getMusicByPk(title);
      const originalBuffer = (await utils.getSongTags(node.getFilePath(doc.fileHash))).APIC;
      await client.getSongCoverToPath(title, filePath);
      const buffer = await fse.readFile(filePath);
      assert.isTrue(Buffer.compare(originalBuffer, buffer) == 0);
    });
  });

  describe('.removeSong()', function () {
    it('should throw an error because of a wrong title', async function () {
      try {
        await client.getSongAudioLink('wrong');
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong song title'));
      }
    });

    it('should return the link', async function () {
      const title = 'artist - title';
      const doc = await node.db.getMusicByPk(title);
      const res = await client.removeSong(title);
      assert.equal(res.removed, 1, 'check the result');
      assert.isNull(await node.db.getMusicByPk(title), 'check the database');
      assert.isFalse(await node.hasFile(doc.fileHash), 'check the file');
    });
  });

  describe('.createRequestedSongAudioLink()', () => {
    it('should return the right link', async () => {
      const title = 'artist-title';
      const link = client.createRequestedSongAudioLink(title);
      assert.equal(link, `${client.getRequestProtocol()}://${client.workerAddress}/client/request-song?type=audio&title=${title}`);
    });
  });

  describe('.createRequestedSongCoverLink()', () => {
    it('should return the right link', async () => {
      const title = 'artist-title';
      const link = client.createRequestedSongCoverLink(title);
      assert.equal(link, `${client.getRequestProtocol()}://${client.workerAddress}/client/request-song?type=cover&title=${title}`);
    });
  });

  describe('.deinit()', function () {
    it('should not throw an exception', async function () {
      await client.deinit();
    });
  });
});