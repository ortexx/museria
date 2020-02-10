const assert = require('chai').assert;
const fse = require('fs-extra');
const path = require('path');
const Node = require('../src/node')();
const Client = require('../src/client')();
const utils = require('../src/utils');
const tools = require('./tools');

describe('group communication', () => {
  let nodes;
  let client;
  let filePath;
  let duplicates;
  let fileStoringNodeTimeout;

  before(async () => {
    nodes = [];
    fileStoringNodeTimeout = 1000;

    for(let i = 0; i < 4; i++) {
      const node = new Node(await tools.createNodeOptions({ request: { fileStoringNodeTimeout } }));
      await node.init();
      nodes.push(node);
      node.initialNetworkAddress = nodes[0].address;
    }
    
    client = new Client(await tools.createClientOptions({ address: nodes[0].address }));
    await client.init();
    await tools.nodesSync(nodes, nodes.length * 2); 
    filePath = path.join(tools.tmpPath, 'audio.mp3');
    duplicates = await nodes[0].getFileDuplicatesCount();
  });

  after(async () => {
    for(let i = 0; i < nodes.length; i++) {
      await nodes[i].deinit();
    }
  });

  it('should get the right network size', async () => {
    for(let i = 0; i < nodes.length; i++) {
      assert.equal(await nodes[i].getNetworkSize(), nodes.length);
    }
  });
  
  it('should add the song', async () => {
    const title = 'artist - title';
    await utils.setSongTags(filePath, { fullTitle: title });
    await client.addSong(filePath);       
    await tools.wait(fileStoringNodeTimeout);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const doc = await node.db.getMusicByPk(title);
      doc && await node.hasFile(doc.fileHash) && count++;
    }
    
    assert.equal(count, duplicates);
  });

  it('should not add the existent songs again', async () => {
    const title = 'artist - title';
    await utils.setSongTags(filePath, { fullTitle: title });
    await client.addSong(filePath); 
    await tools.wait(fileStoringNodeTimeout);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const doc = await node.db.getMusicByPk(title);
      doc && await node.hasFile(doc.fileHash) && count++;
    }

    assert.equal(count, duplicates);
  });

  it('should not add the similar songs again', async () => {
    const title = 'artist - title1';
    await utils.setSongTags(filePath, { fullTitle: title });
    await client.addSong(filePath); 
    await tools.wait(fileStoringNodeTimeout);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const doc = await node.db.getMusicByPk(title);
      doc && await node.hasFile(doc.fileHash) && count++;
    }

    assert.equal(count, duplicates);
  });

  it('should add the necessary count of duplicates', async () => {
    const title = 'artist - title';

    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const doc = await node.db.getMusicByPk(title);

      if(doc) {
        await node.removeFileFromStorage(doc.fileHash);
        break;
      }
    }

    await client.addSong(filePath);
    await tools.wait(fileStoringNodeTimeout);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const doc = await node.db.getMusicByPk(title);
      doc && await node.hasFile(doc.fileHash) && count++;
    }

    assert.equal(count, duplicates);
  });

  it('should return the right links', async () => {
    const info = await client.getSongInfo('artist - title');
    assert.equal(info.length, duplicates);
  });

  it('should remove the song', async () => {
    const title = 'artist - title';
    await client.removeSong(title);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const doc = await node.db.getMusicByPk(title);
      doc && await node.hasFile(doc.fileHash) && count++;
    }

    assert.equal(count, 0);
  });

  it('should add songs in parallel', async () => {
    const length = 10;  
    const p = [];
    let fCount = 0;
    let dCount = 0;

    for(let i = 0; i < length; i++) {
      const newPath = path.join(tools.tmpPath, `audio${i}.mp3`);
      await fse.copy(filePath, newPath);
      const tags = { fullTitle: `${ Math.random() } - ${ Math.random() }` };
      await utils.setSongTags(newPath, tags);
    }

    for(let i = 0; i < length; i++) {      
      p.push(client.addSong(path.join(tools.tmpPath, `audio${i}.mp3`)));
    }

    await Promise.all(p);
    await tools.wait(fileStoringNodeTimeout * 2);

    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      fCount += await node.db.getData('filesCount');
      dCount += await node.db.getCollectionSize('music');
    }

    assert.isOk(fCount >= length * duplicates, 'check the files');
    assert.isOk(dCount >= length * duplicates, 'check the documents');
  });
});