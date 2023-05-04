# [Museria](https://github.com/ortexx/museria/) [alpha] [![npm version](https://badge.fury.io/js/museria.svg)](https://badge.fury.io/js/museria) [![Build status](https://github.com/ortexx/museria/workflows/build/badge.svg)](https://github.com/ortexx/museria/actions)

Museria is a decentralized music storage based on [spreadable](https://github.com/ortexx/spreadable/), [storacle](https://github.com/ortexx/storacle/) and [metastocle](https://github.com/ortexx/metastocle/).

There is [an article here](https://ortex.medium.com/museria-a-decentralized-music-storage-dc2041a5f196) with an explanation. 

```javascript
const Node = require('museria').Node;

(async () => {
  try {
    const node = new Node({
      port: 4000,
      hostname: 'localhost'
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
      fullTitle: title,
      APIC: './cover.jpg'
    });

    // Add the song
    await client.addSong('./audio.mp3');

    // Get the song info
    const info = await client.getSong(title);

    // Find songs
    const songs = await client.findSongs('arti', { limit: 5 });

    // Find the artist songs
    const artistSongs = await client.findArtistSongs('artist');

    // Get the song audio link
    const audioLink = await client.getSongAudioLink(title);

    // Get the song cover link
    const coverLink = await client.getSongCoverLink(title);
    
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
You can also use the client in a browser. Look at the description of [the spreadable library](https://github.com/ortexx/spreadable/#how-to-use-the-client-in-a-browser). In window you have __window.ClientMuseria__ instead of __window.ClientSpreadable__. The prepared file name is __museria.client.js__.

## How to use it via the command line
Look at the description of [the spreadable library](https://github.com/ortexx/spreadable/#how-to-use-it-via-the-command-line). You only need to change everywhere **spreadable** word to **museria**.

## How it works

The mechanism of the library is very similar to [storacle](https://github.com/ortexx/storacle/). The only difference is that the key to the file is the name of the song, not the hash. Also, a unique song is considered not with the full title match, but the percentage of coincidence set in the options.  

## What are the limitations
Currently only mp3 format is supported. The tags are id3, based on [node-id3](https://github.com/Zazama/node-id3). 
TPE1 and TIT2 tags are required to store the song. You can use setter __fullTitle__ as __TPE1 - TIT2__ when you set the tags using __utils__. It must be a valid combination for __utils.isSongTitle()__ function. Also, the network may have its own cover size requirements. The number of songs that can be added to one node is configurable as well. 

## What are the requirements
Look at [the storacle requirements](https://github.com/ortexx/storacle/#what-are-the-requirements) and [the metastocle requirements](https://github.com/ortexx/metastocle/#what-are-the-requirements).

## Moderation and priority
By adding a song, you can indicate whether you moderate it or not. The __controlled__ option is responsible for this. By default, it is __false__. The moderation mode implies that you take care of the conformity and quality of the song. The file of the corresponding song located in the storage will be replaced with a new one without checks. Adding songs in this mode requires captcha confirmation.

```javascript
await client.addSong(file, { controlled: true });
```

You can also specify the priority of your file as __-1__, __0__ or __1__. By default, it is __0__. If the priority of the new song is higher than the existing one, then it will replace that without checks. If they are equal, then the storage itself will decide which one to choose. If less, then the song in the repository will remain the same. Only the tags, cover and other additional information might be updated in this case. Priority __1__ may only be used in moderation mode.

```javascript
await client.addSong(file, { priority: -1 });
await client.addSong(file, { priority: 1, controlled: true });
```

## Where to use it

### 1. Wherever songs need to be stored decentralized
For example, we can collect all the music on the planet together in [one place](https://github.com/ortexx/museria-global/), but in a decentralized way with the ability to access it at any time.

### 2. For own needs
You can use it to store music as you like.

### 3. Serverless solutions
Since the library is written in javascript, you can receive / send / work with songs in the browser and do not use server code at all. In some cases, it can be very convenient.

## Node configuration

When you create an instance of the node you can pass options below. Only specific options of this library are described here, without considering the options of the parent classes.

* {object} __[music]__ - section that responds for music settings.

* {number} __[music.similarity=0.91]__ - number from 0 to 1 indicating how similar songs titles have to be, in order to consider them the same.

* {number|string} __[music.audioHeadersMaxSize="180kb"]__ - maximum audio headers size.

* {number|string} __[music.coverHeadersMaxSize="5kb"]__ - maximum cover headers size.

* {number} __[music.findingStringMinLength=4]__ - minimum symbols to find songs.

* {number} __[music.findingLimit=200]__ - songs finding maximum result list size.

* {number|string} __[music.relevanceTime="14d"]__ - how long does an existing song take precedence over newly added.

* {boolean} __[music.prepareTitle=true]__ - prepare the title before addition or not. Preparation means bringing the  title to a general view.

* {boolean} __[music.prepareCover=true]__ - prepare the cover before addition or not. Preparation means bringing the size and image quality to the right values.

* {integer} __[music.coverQuality=80]__ - prepared cover quality from 0 to 100. It works only when music.prepareCover is true.

* {integer} __[music.coverMinSize=200]__ - minimum cover size in px. It works only when music.prepareCover is true.

* {integer} __[music.coverMaxSize=500]__ - maximum cover size in px. It works only when music.prepareCover is true.

* {number|string} __[music.coverMaxFileSize="110kb"]__ - maximum cover file size. It works only when music.prepareCover is true.

* {number|string} __[task.cleanUpMusicInterval="1m"]__ - music cleanup task interval.

## Client interface

async __Client.prototype.addSong()__ - add the file to the network.
  * {string|fs.ReadStream|Buffer|Blob} __file__ - mp3 audio file  
  * {object} __[options]__ - addition options
  * {number} __[options.timeout]__ - addition timeout
  * {integer} __[options.priority=0]__ - song priority -1, 1 or 0
  * {boolean} __[options.controlled=false]__ - enable moderation mode or not

async __Client.prototype.getSong()__ - get the song main info.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongInfo()__ - get the song complete info.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.findSongs()__ - find songs by the match.
  * {string} __str__ - string to match
  * {object} __[options]__ - getting options
  * {number} __[options.limit]__ - result list maximum size
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.findArtistSongs()__ - find songs by the artist name.
  * {string} __artist__ - artist name
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongAudioLink()__ - get the song audio file link.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongCoverLink()__ - get the song cover file link.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongAudioToBuffer()__ - download the song audio file and return the buffer.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongCoverToBuffer()__ - download the song cover file and return the buffer.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongAudioToPath()__ - download the song audio file and write it to the specified path.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongCoverToPath()__ - download the song cover file and write it to the specified path.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongAudioToBlob()__ - download the song audio file and return the blob. For browser client only.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getSongCoverToBlob()__ - download the song cover file and return the blob. For browser client only.
  * {string} __title__ - song title
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.removeSong()__ - Remove the song.
  * {string} __title__ - song title
  * {object} __[options]__ - removal options
  * {number} __[options.timeout]__ - removal timeout

__Client.prototype.createRequestedSongAudioLink()__ - сreate a requested audio file link. This is convenient if you need to get the link without doing any asynchronous operations at the moment. 
  * {string} __title__ - song title
  * {object} __[options]__ - options

__Client.prototype.createRequestedSongCoverLink()__ - сreate a requested cover file link. This is convenient if you need to get the link without doing any asynchronous operations at the moment. 
  * {string} __title__ - song title
  * {object} __[options]__ - options


## Exporting songs
If necessary, you have the opportunity to export songs from one server to another. There are two options:

* Copy all project files to the second server. It is convenient and works at the current moment, because the node is able to reconfigure all information to a new address. But there is no guarantee that this will work in the future.

* Use the song export feature: run ``` node.exportSongs() ``` method or via the command line as ``` museria -a exportSongs -n 2.2.2.2:2079 ```. Here, you should add the first server to the trust list of the second one to transfer all songs, including those with priority 1. Without this, the node will require a captcha solution and the file will not be added. Use the option **network.trustlist** of the spreadable library.

## Contribution
If you face a bug or have an idea how to improve the library, create an issue on github. In order to fix something or add new code yourself, fork the library, make changes and create a pull request to the master branch. Don't forget about tests in this case. Also you can join [the project on github](https://github.com/ortexx/museria/projects/2).