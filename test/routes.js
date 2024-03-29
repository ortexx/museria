import { assert } from "chai";
import fse from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import node from "../src/node.js";
import client from "../src/client.js";
import utils from "../src/utils.js";
import schema from "../src/schema.js";
import tools from "./tools.js";

const Node = node();
const Client = client();

export default function () {
  describe('routes', () => {
    let node;
    let client;

    before(async function () {
      node = new Node(await tools.createNodeOptions({
        network: {
          auth: { username: 'username', password: 'password' }
        }
      }));
      await node.init();
      client = new Client(await tools.createClientOptions({
        address: node.address,
        auth: { username: 'username', password: 'password' }
      }));
      await client.init();
    });

    after(async function () {
      await node.deinit();
      await client.deinit();
    });

    describe('/status', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/status`);
        assert.equal(await res.status, 401);
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
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/audio/hash`);
        assert.equal(await res.status, 401);
      });

      it('should return 404', async function () {
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/audio/wrong-hash`, options);
        assert.equal(res.status, 404);
      });

      it('should return the file', async function () {
        const title = 'artist - title';
        const file = await utils.setSongTags(path.join(tools.tmpPath, 'audio.mp3'), { fullTitle: title });
        await node.addSong(file);
        const doc = await node.db.getMusicByPk(title);
        const code = utils.encodeSongTitle(doc.title);
        const buffer = await fse.readFile(node.getFilePath(doc.fileHash));
        const filePath = path.join(tools.tmpPath, 'audio-saved.mp3');
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/audio/${code}?${doc.fileHash}`, options);
        await tools.saveResponseToFile(res, filePath);
        assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
      });
    });

    describe('/cover/:hash', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/cover/hash`);
        assert.equal(await res.status, 401);
      });

      it('should return 404', async function () {
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/cover/wrong-hash`, options);
        assert.equal(res.status, 404);
      });

      it('should return the file', async function () {
        const title = 'artist - title';
        const file = await utils.setSongTags(path.join(tools.tmpPath, 'audio.mp3'), {
          fullTitle: title,
          APIC: path.join(tools.tmpPath, 'cover.jpg')
        });
        await node.addSong(file);
        const doc = await node.db.getMusicByPk(title);
        const code = utils.encodeSongTitle(doc.title);
        const buffer = (await utils.getSongTags(node.getFilePath(doc.fileHash))).APIC;
        const filePath = path.join(tools.tmpPath, 'cover-saved.jpg');
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/cover/${code}?${doc.fileHash}`, options);
        await tools.saveResponseToFile(res, filePath);
        assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
      });
    });

    describe('/client/request-song', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/request-song`, { method: 'get' });
        assert.equal(await res.status, 401);
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
        const filePath = path.join(tools.tmpPath, 'audio-saved.mp3');
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/client/request-song/?title=${title}&type=audio`, options);
        await tools.saveResponseToFile(res, filePath);
        assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
      });

      it('should return the cover file', async function () {
        const title = 'artist - title';
        const doc = await node.db.getMusicByPk(title);
        const buffer = (await utils.getSongTags(node.getFilePath(doc.fileHash))).APIC;
        const filePath = path.join(tools.tmpPath, 'cover-saved.jpg');
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/client/request-song/?title=${title}&type=cover`, options);
        await tools.saveResponseToFile(res, filePath);
        assert.isOk(Buffer.compare(await fse.readFile(filePath), buffer) == 0);
      });
    });

    describe('/client/add-song', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/add-song`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return an error', async function () {
        const options = client.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/client/add-song`, options);
        assert.equal(res.status, 422);
      });

      it('should save the song', async function () {
        const title = 'new - song';
        const file = await utils.setSongTags(path.join(tools.tmpPath, 'audio.mp3'), {
          fullTitle: title,
          APIC: path.join(tools.tmpPath, 'cover.jpg'),
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
        assert.equal(utils.beautifySongTitle(title), json.title, 'check the title');
        assert.equal(json.tags.TIT3, 'x', 'check the tags');
        assert.isTrue(await node.hasFile(doc.fileHash), 'check the file');
        assert.isTrue(utils.isValidSongAudioLink(json.audioLink), 'check the audio link');
        assert.isTrue(utils.isValidSongCoverLink(json.coverLink), 'check the cover link');
      });
    });

    describe('/client/get-song-info', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/get-song-info`, { method: 'post' });
        assert.equal(await res.status, 401);
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
        assert.equal(utils.beautifySongTitle(title), info.title, 'check the title');
        assert.equal(info.tags.TIT3, 'x', 'check the tags');
        assert.isTrue(utils.isValidSongAudioLink(info.audioLink), 'check the audio link');
        assert.isTrue(utils.isValidSongCoverLink(info.coverLink), 'check the cover link');
      });
    });

    describe('/client/find-songs', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/find-songs`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return the songs', async function () {
        const str = 'new - song';
        const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { str } }));
        const res = await fetch(`http://${node.address}/client/find-songs`, options);
        const json = await res.json();
        const songs = json.songs[0];
        assert.lengthOf(json.songs, 1, 'check the length');
        assert.isOk(songs.title.toLowerCase().match(str.toLowerCase()), 'check the title');
        assert.equal(songs.tags.TIT3, 'x', 'check the tags');
        assert.isTrue(utils.isValidSongAudioLink(songs.audioLink), 'check the audio link');
        assert.isTrue(utils.isValidSongCoverLink(songs.coverLink), 'check the cover link');
      });
    });

    describe('/client/find-artist-songs', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/find-artist-songs`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return the songs', async function () {
        const artist = 'new';
        const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { artist } }));
        const res = await fetch(`http://${node.address}/client/find-artist-songs`, options);
        const json = await res.json();
        const songs = json.songs[0];
        assert.lengthOf(json.songs, 1, 'check the length');
        assert.isOk(songs.title.toLowerCase().match(artist.toLowerCase()), 'check the title');
        assert.equal(songs.tags.TIT3, 'x', 'check the tags');
        assert.isTrue(utils.isValidSongAudioLink(songs.audioLink), 'check the audio link');
        assert.isTrue(utils.isValidSongCoverLink(songs.coverLink), 'check the cover link');
      });
    });

    describe('/client/get-song-link', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/get-song-link`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return an error because of a wrong title', async function () {
        const body = { type: 'audio' };
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
        const body = { title: 'unexistent - unexistent', type: 'audio' };
        const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/client/get-song-link`, options);
        const json = await res.json();
        assert.isEmpty(json.link);
      });

      it('should return an empty cover link', async function () {
        const body = { title: 'unexistent - unexistent', type: 'cover' };
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
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/remove-song/`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = client.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/client/remove-song/`, options);
        assert.equal(res.status, 422);
      });

      it('should not remove the file with priority 1', async function () {
        const title = 'new - song';
        const doc = await node.db.getMusicByPk(title);
        doc.priority = 1;
        const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { title } }));
        const res = await fetch(`http://${node.address}/client/remove-song/`, options);
        const json = await res.json();
        doc.priority = 0;
        assert.equal(json.removed, 0, 'check the response');
        assert.isTrue(await node.hasFile(doc.fileHash), 'check the file');
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

    describe('/api/master/remove-song/', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/api/master/remove-song/`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions());
        const res = await fetch(`http://${node.address}/api/master/remove-song/`, options);
        assert.equal(res.status, 422);
      });

      it('should return the right schema', async function () {
        const body = {
          level: 2,
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

    describe('/api/butler/remove-song/', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/api/butler/remove-song/`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions());
        const res = await fetch(`http://${node.address}/api/butler/remove-song/`, options);
        assert.equal(res.status, 422);
      });

      it('should return the right schema', async function () {
        const body = {
          level: 1,
          title: 'artist - title'
        };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/api/butler/remove-song/`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getSongRemovalButlerResponse(), json);
        });
      });
    });

    describe('/api/slave/remove-song/', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/api/slave/remove-song/`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/slave/remove-song/`, options);
        assert.equal(res.status, 422);
      });

      it('should return the right schema', async function () {
        const body = {
          level: 0,
          title: 'artist - title'
        };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/api/slave/remove-song/`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getSongRemovalSlaveResponse(), json);
        });
      });
    });

    describe('/api/node/add-song/', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/api/node/add-song/`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return an error', async function () {
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/add-song/`, options);
        assert.equal(res.status, 422);
      });
      
      it('should return the right schema', async function () {
        const fullTitle = 'new - song';
        const file = await utils.setSongTags(path.join(tools.tmpPath, 'audio.mp3'), { fullTitle });
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
}