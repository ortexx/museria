# [Museria](https://github.com/ortexx/museria/) [alpha]

Museria is a decentralized music storage based on [spreadable](https://github.com/ortexx/spreadable/), [spreadable](https://github.com/ortexx/storacle/) and [metastocle](https://github.com/ortexx/metastocle/).

```javascript
const Node = require('museria').Node;

(async () => {  
  try {
    const node = new Node({
      port: 4000,
      hostname: 'localhost',
      initialNetworkAddress: 'localhost:4000'
    });
    await node.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

```javascript
const Client = require('museria').Client;
const utils = require('museria/src/utils');

(async () => {  
  try {
    const client = new Client({
      address: 'localhost:4000'
    });
    await client.init();
    const title = 'Artist - Title';

      // Prepare the song tags
    await utils.addSongTags('./audio.mp3', { 
      TIT2: title, 
      APIC: './cover.jpg' 
    });

    // Add the song
    await client.addSong('./audio.mp3');

    // Get the song info
    const info = await client.getSong(title);

    // Get the song audio link
    const audioLink = client.getSongAudioLink(title);

    // Get the song cover link
    const coverLink = client.getSongCoverLink(title);
    
    // Remove the song
    await client.removeSong(title);
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

## Browser client
You can also use the client in a browser. Look at the description of the [spreadable](https://github.com/ortexx/spreadable/) library. In window you  have __window.ClientMuseria__ instead of __window.ClientSpreadable__. The prepared file name is __museria.client.min.js__.

## How it works

The mechanism of the library is very similar to [storacle](https://github.com/ortexx/storacle/). The only difference is that the key to the file is the name of the song, not the hash. Also, a unique song is considered not with the full title match, but the percentage of coincidence set in the options.  

## What are the limitations

Currently only mp3 format is supported. The tags are id3, based on the [node-id3](https://github.com/Zazama/node-id3). 
TIT2 tag is required to store the file. It must be valid for __utils.isSongTitle()__ function. Also, the network may have its own cover size requirements. The number of songs that can be added to one node is configurable as well. 

## Why to use it

This library allows us to collect all the music on the planet together in one place, but decentralized way with the ability to access it at any time.