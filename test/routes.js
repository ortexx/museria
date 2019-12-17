const assert = require('chai').assert;
const fse = require('fs-extra');
const fetch = require('node-fetch');
const Node = require('../src/node')();
const Client = require('../src/client')();
const utils = require('../src/utils');
const schema = require('../src/schema');
const tools = require('./tools');

describe('routes', () => {
  let node;
  let client;

  before(async function() {
    node = new Node(await tools.createNodeOptions({ 
      network: { secretKey: 'key' }, 
      collections: {
        test: { pk: 'id' }
      }
    }));
    await node.init();
    client = new Client(await tools.createClientOptions({ address: node.address, secretKey: 'key' }));
    await client.init();
  });

  after(async function() {
    await node.deinit();
    await client.deinit();
  });

  describe('/status', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/status`);
      assert.equal(await res.status, 403);
    });

    it('should return the status', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/status`, options);
      const json = await res.json();
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getStatusResponse(), json);
      });
    });

    it('should return the pretty status', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/status?pretty`, options);
      const json = await res.json();      
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getStatusPrettyResponse(), json);
      });
    });
  });

  describe('/audio/:hash', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/audio/hash`);
      assert.equal(await res.status, 403);
    });

    it('should return 404', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/audio/wrong-hash`, options);
      assert.equal(res.status, 404);
    });

    it('should return the file', async function () {
      const title = 'artist - title';      
      const file = await utils.setSongTags(tools.tmpPath + '/audio.mp3', { TIT2: title });
      await node.addSong(file);
      const doc = await node.db.getMusicByPk(title);
      const buffer = await fse.readFile(node.getFilePath(doc.fileHash));
      const filePath = tools.tmpPath + '/audio-saved.mp3';
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/audio/${doc.fileHash}`, options);
      await tools.saveResponseToFile(res, filePath);
      assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
    });
  });

  describe('/cover/:hash', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/cover/hash`);
      assert.equal(await res.status, 403);
    });

    it('should return 404', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/cover/wrong-hash`, options);
      assert.equal(res.status, 404);
    });

    it('should return the file', async function () {
      const title = 'artist - title';      
      const file = await utils.setSongTags(tools.tmpPath + '/audio.mp3', { TIT2: title, APIC: tools.tmpPath + '/cover.jpg' });
      await node.addSong(file);
      const doc = await node.db.getMusicByPk(title);
      const buffer = (await utils.getSongTags(node.getFilePath(doc.fileHash))).APIC
      const filePath = tools.tmpPath + '/cover-saved.jpg';
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/cover/${doc.fileHash}`, options);
      await tools.saveResponseToFile(res, filePath);
      assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
    });
  });

  describe('/client/request-song', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/client/request-song`, { method: 'get' });
      assert.equal(await res.status, 403);
    });

    it('should return an error because of a wrong title', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-song/?type=audio`, options);
      assert.equal(res.status, 422, 'check the status');
      assert.isOk((await res.json()).message.match('Wrong song title'), 'check the message');
    });

    it('should return an error because of a wrong type', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-song/?title=artist - title`, options);
      assert.equal(res.status, 422, 'check the status');
      assert.isOk((await res.json()).message.match('Link type'), 'check the message');
    });

    it('should return 404 for audio', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-song/?title=unexistent - song&type=audio`, options);
      assert.equal(res.status, 404);
    });

    it('should return 404 for cover', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-song/?title=unexistent - song&type=cover`, options);
      assert.equal(res.status, 404);
    });

    it('should return the audio file', async function () { 
      const title = 'artist - title';
      const doc = await node.db.getMusicByPk(title);
      const buffer = await fse.readFile(node.getFilePath(doc.fileHash));
      const filePath = tools.tmpPath + '/audio-saved.mp3';
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-song/?title=${title}&type=audio`, options);
      await tools.saveResponseToFile(res, filePath);
      assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
    });

    it('should return the cover file', async function () { 
      const title = 'artist - title';
      const doc = await node.db.getMusicByPk(title);
      const buffer = (await utils.getSongTags(node.getFilePath(doc.fileHash))).APIC
      const filePath = tools.tmpPath + '/cover-saved.jpg';
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-song/?title=${title}&type=cover`, options);
      await tools.saveResponseToFile(res, filePath);
      assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
    });
  });

  describe('/client/add-song', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/client/add-song`, { method: 'post' });
      assert.equal(await res.status, 403);
    });

    it('should return an error', async function () { 
      const options = client.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/client/add-song`, options);
      assert.equal(res.status, 422);
    });

    it('should save the song', async function () {
      const title = 'new - song';      
      const file = await utils.setSongTags(tools.tmpPath + '/audio.mp3', { 
        TIT2: title, 
        APIC: tools.tmpPath + '/cover.jpg',
        TIT3: 'x'
      });
      const fileOptions = { contentType: 'audio/mpeg', filename: `audio.mp3` }; 
      const body = tools.createRequestFormData({ 
        file: { value: fse.createReadStream(file), options: fileOptions } 
      });
      const options = client.createDefaultRequestOptions({ body });
      const res = await fetch(`http://${node.address}/client/add-song`, options);
      const json = await res.json();
      const doc = await node.db.getMusicByPk(title);
      assert.isNotNull(doc, 'check the database');
      assert.equal(await utils.beautifySongTitle(title), json.title, 'check the title');
      assert.equal(json.tags.TIT3, 'x', 'check the tags');
      assert.isTrue(await node.hasFile(doc.fileHash), 'check the file');
      assert.isTrue(await utils.isValidSongAudioLink(json.audioLink), 'check the audio link');
      assert.isTrue(await utils.isValidSongCoverLink(json.coverLink), 'check the cover link');
    });
  });

  describe('/client/get-song-info', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/client/get-song-info`, { method: 'post' });
      assert.equal(await res.status, 403);
    });

    it('should return an error', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'post' });
      const res = await fetch(`http://${node.address}/client/get-song-info`, options);
      assert.equal(res.status, 422);
    });

    it('should return the info', async function () { 
      const title = 'new - song';
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { title } }));      
      const res = await fetch(`http://${node.address}/client/get-song-info`, options);
      const json = await res.json();
      const info = json.info[0];
      assert.lengthOf(json.info, 1, 'check the length');
      assert.equal(await utils.beautifySongTitle(title), info.title, 'check the title');
      assert.equal(info.tags.TIT3, 'x', 'check the tags');
      assert.isTrue(await utils.isValidSongAudioLink(info.audioLink), 'check the audio link');
      assert.isTrue(await utils.isValidSongCoverLink(info.coverLink), 'check the cover link');
    });
  });

  describe('/client/get-song-link', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/client/get-song-link`, { method: 'post' });
      assert.equal(await res.status, 403);
    });

    it('should return an error because of a wrong title', async function () { 
      const body = { type: 'audio' }
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/client/get-song-link`, options);
      assert.equal(res.status, 422, 'check the status');
      assert.isOk((await res.json()).message.match('Wrong song title'), 'check the message');
    });

    it('should return an error because of a wrong type', async function () { 
      const body = { title: 'new - song' };
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/client/get-song-link`, options);
      assert.equal(res.status, 422, 'check the status');
      assert.isOk((await res.json()).message.match('Link type'), 'check the message');
    });

    it('should return an empty audio link', async function () { 
      const body = { title: 'unexistent - song', type: 'audio' };
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/client/get-song-link`, options);
      const json = await res.json();
      assert.isEmpty(json.link);
    });

    it('should return an empty cover link', async function () { 
      const body = { title: 'unexistent - song', type: 'cover' };
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/client/get-song-link`, options);
      const json = await res.json();
      assert.isEmpty(json.link);
    });

    it('should return the audio link', async function () { 
      const title = 'new - song';
      const body = { title, type: 'audio' };
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/client/get-song-link`, options);
      const json = await res.json();
      assert.isTrue(utils.isValidSongAudioLink(json.link));
    });

    it('should return the cover link', async function () { 
      const title = 'new - song';
      const body = { title, type: 'cover' };
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/client/get-song-link`, options);
      const json = await res.json();
      assert.isTrue(utils.isValidSongCoverLink(json.link));
    });
  });

  describe('/client/remove-song/', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/client/remove-song/`, { method: 'post' });
      assert.equal(await res.status, 403);
    });

    it('should return a data error', async function () { 
      const options = client.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/client/remove-song/`, options);
      assert.equal(res.status, 422);
    });

    it('should remove the file', async function () { 
      const title = 'new - song';
      const doc = await node.db.getMusicByPk(title);
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { title } }));      
      const res = await fetch(`http://${node.address}/client/remove-song/`, options);
      const json = await res.json();
      assert.equal(json.removed, 1, 'check the response');
      assert.isNull(await node.db.getMusicByPk(title), 'check the database');
      assert.isFalse(await node.hasFile(doc.fileHash), 'check the file');
    });
  });

  describe('/api/master/get-song-info/', function () {
    it('should return an access error', async function () { 
      const res = await fetch(`http://${node.address}/api/master/get-song-info/`, { method: 'post' });
      assert.equal(await res.status, 403);
    });

    it('should return a master acception error', async function () { 
      const options = node.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/api/master/get-song-info/`, options);
      assert.equal(await res.status, 422);
    });

    it('should return a data error', async function () { 
      const body = { ignoreAcception: true };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));   
      const res = await fetch(`http://${node.address}/api/master/get-song-info/`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema', async function () {
      const body = {
        ignoreAcception: true,
        title: 'artist - title'
      };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/master/get-song-info/`, options);
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getSongInfoMasterResponse(), json);
      });
    });

    describe('/api/master/remove-song/', function () {
      it('should return an access error', async function () { 
        const res = await fetch(`http://${node.address}/api/master/remove-song/`, { method: 'post' });
        assert.equal(await res.status, 403);
      });
  
      it('should return a master acception error', async function () { 
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/master/remove-song/`, options);
        assert.equal(await res.status, 422);
      });
  
      it('should return a data error', async function () { 
        const body = { ignoreAcception: true };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));   
        const res = await fetch(`http://${node.address}/api/master/remove-song/`, options);
        assert.equal(res.status, 422);
      });
  
      it('should return the right schema', async function () {
        const body = {
          ignoreAcception: true,
          title: 'artist - title'
        };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
        const res = await fetch(`http://${node.address}/api/master/remove-song/`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getSongRemovalMasterResponse(), json);
        });
      });
    });

    describe('/api/slave/get-song-info/', function () {
      it('should return an access error', async function () { 
        const res = await fetch(`http://${node.address}/api/slave/get-song-info/`, { method: 'post' });
        assert.equal(await res.status, 403);
      });
  
      it('should return a data error', async function () {
        const options = node.createDefaultRequestOptions();   
        const res = await fetch(`http://${node.address}/api/slave/get-song-info/`, options);
        assert.equal(res.status, 422);
      });
  
      it('should return the right schema', async function () {
        const body = {
          ignoreAcception: true,
          title: 'artist - title'
        };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
        const res = await fetch(`http://${node.address}/api/slave/get-song-info/`, options);      
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getSongInfoSlaveResponse(), json);
        });
      });
    });

    describe('/api/slave/remove-song/', function () {
      it('should return an access error', async function () { 
        const res = await fetch(`http://${node.address}/api/slave/remove-song/`, { method: 'post' });
        assert.equal(await res.status, 403);
      });
  
      it('should return a data error', async function () {
        const options = node.createDefaultRequestOptions();   
        const res = await fetch(`http://${node.address}/api/slave/remove-song/`, options);
        assert.equal(res.status, 422);
      });
  
      it('should return the right schema', async function () {
        const body = { title: 'artist - title' };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
        const res = await fetch(`http://${node.address}/api/slave/remove-song/`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getSongRemovalSlaveResponse(), json);
        });
      });
    });

    describe('/api/node/add-song/', function () {
      it('should return an access error', async function () { 
        const res = await fetch(`http://${node.address}/api/node/add-song/`, { method: 'post' });
        assert.equal(await res.status, 403);
      });
  
      it('should return an error', async function () { 
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/add-song/`, options);
        assert.equal(res.status, 422);
      });
  
      it('should return the right schema', async function () {  
        const title = 'new - song';      
        const file = await utils.setSongTags(tools.tmpPath + '/audio.mp3', { TIT2: title });
        const fileOptions = { contentType: 'audio/mpeg', filename: `audio.mp3` }; 
        const body = tools.createRequestFormData({ 
          file: { value: fse.createReadStream(file), options: fileOptions } 
        });
        const options = node.createDefaultRequestOptions({ body });
        const res = await fetch(`http://${node.address}/api/node/add-song/`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getSongAdditionResponse(), json);
        });
      });
    });
  });
});