const assert = require('chai').assert;
const fse = require('fs-extra');
const path = require('path');
const utils = require('../src/utils');
const tools = require('./tools');

describe('utils', () => {
  describe('.splitSongTitle()', () => {
    it('should return the right array', () => {
      const arr = utils.splitSongTitle('x - a, - b - c')
      assert.equal(arr[0], 'x', 'the first part');
      assert.equal(arr[1], 'a, - b - c', 'the second part');
    }); 
  });

  describe('.isValidSongAudioLink()', () => {
    it('should return true', () => {
      assert.isTrue(utils.isValidSongAudioLink('http://localhost:80/audio/hash.mp3'), 'check http and mp3');
      assert.isTrue(utils.isValidSongAudioLink('https://192.0.0.1:3000/audio/hash.mpga'), 'check https and mpga');
    }); 
    
    it('should return false', () => {
      assert.isFalse(utils.isValidSongAudioLink('http://localhost/audio/hash'), 'check without an extenstion');
      assert.isFalse(utils.isValidSongAudioLink('http://localhost/audio/hash.mp3'), 'check without a port');
      assert.isFalse(utils.isValidSongAudioLink('ftp://localhost/audio/hash'), 'check the wrong protocol');
      assert.isFalse(utils.isValidSongAudioLink('http://192.0.0.1:80/cover/hash'), 'check the wrong path');
    });
  });

  describe('.isValidSongCoverLink()', () => {
    it('should return true', () => {
      assert.isTrue(utils.isValidSongCoverLink('http://localhost:80/cover/hash.jpg'), 'check http and jpg');
      assert.isTrue(utils.isValidSongCoverLink('https://192.0.0.1:3000/cover/hash.png'), 'check https and png');
    }); 
    
    it('should return false', () => {
      assert.isFalse(utils.isValidSongCoverLink('http://localhost/cover/hash'), 'check without an extenstion');
      assert.isFalse(utils.isValidSongCoverLink('http://localhost/cover/hash.mp3'), 'check without a port');
      assert.isFalse(utils.isValidSongCoverLink('ftp://localhost/cover/hash'), 'check the wrong protocol');
      assert.isFalse(utils.isValidSongCoverLink('http://192.0.0.1:80/audio/hash'), 'check the wrong path');
    });
  });

  describe('.beautifySongTitle()', () => {
    it('should camalize the title', () => {
      assert.equal(utils.beautifySongTitle('artist - good title (feat. artist2)'), 'Artist - Good Title (feat. Artist2)');
    });

    it('should remove excess spaces', () => {
      const res = utils.beautifySongTitle('  artist  -   good  title (  feat.  artist2 ) ( remix  ) [2019 ] ( europe)');
      assert.equal(res, 'Artist - Good Title (remix) [2019] (europe) (feat. Artist2)');
    });

    it('should remove links', () => {
      const res = utils.beautifySongTitle('почта.рф artist google.com - mail.com good www.mail.ru title http://example.ru');
      assert.equal(res, 'Artist - Good Title');
    });

    it('should remove empty braces', () => {
      const res = utils.beautifySongTitle('artist [] - () title');
      assert.equal(res, 'Artist - Title');
    });

    it('should keep unusual signs but remove emojis and slashes', () => {
      assert.equal(utils.beautifySongTitle(`MrkeyØ - #$-&^@+_*&%'.\\/Song 😀 good`), `Mrkeyø - #$-&^@+_*&%'.\\/song Good`);
    });

    it('should place feats together', () => {
      const res = utils.beautifySongTitle('artist1, artist2,artist3 - title (feat. artist4, artist5,artist6)');
      assert.equal(res, 'Artist1 - Title (feat. Artist2, Artist3, Artist4, Artist5, Artist6)');
    });

    it('should bring all feats to a single form', () => {
      assert.equal(utils.beautifySongTitle('artist - title (ft. Artist)'), 'Artist - Title (feat. Artist)', 'check "ft"');
      assert.equal(utils.beautifySongTitle('artist - title (feat. Artist)'), 'Artist - Title (feat. Artist)', 'check "feat"');
      assert.equal(utils.beautifySongTitle('artist - title ft. Artist'), 'Artist - Title (feat. Artist)', 'check without brackets');
    });

    it('should change the dash type', () => {
      assert.equal(utils.beautifySongTitle('artist — title'), 'Artist - Title', 'check the long dash');
      assert.equal(utils.beautifySongTitle('artist – title'), 'Artist - Title', 'check the short dash');
    });

    it('should return an empty string', () => {
      assert.isEmpty(utils.beautifySongTitle('wrong song title'), 'check the wrong title');
      assert.isEmpty(utils.beautifySongTitle(' - no song artist'), 'check the wrong artist');
    });
  });

  describe('.isSongTitle()', () => {
    it('should return true', () => {
      assert.isTrue(utils.isSongTitle('artist - title'), 'check the simple case');
      assert.isTrue(utils.isSongTitle('artist - title (ft. artist, artist2)'), 'check with the feats');
      assert.isTrue(utils.isSongTitle('artist, artist2 - title (ft. artist)'), 'check with the feats in the beginning');
      assert.isTrue(utils.isSongTitle('artist - title (remix) (ft. artist2)'), 'check the additional info');
    }); 
    
    it('should return false', () => {
      assert.isFalse(utils.isSongTitle({}), 'check an object');
      assert.isFalse(utils.isSongTitle(0), 'check an integer');
      assert.isFalse(utils.isSongTitle('wrong'), 'check without dash');
      assert.isFalse(utils.isSongTitle('wrong title -'), 'check without a name');
      assert.isFalse(utils.isSongTitle('artist -title'), 'check without spaces');
    });
  });

  describe('.getSongName()', () => {
    it('should return an empty string because of a wrong title', () => {
      assert.isEmpty(utils.getSongName('artist'));
    }); 

    it('should return the right name in simple case', () => {
      assert.equal(utils.getSongName('artist - title'), 'Title');
    }); 
    
    it('should return the right name with feats', () => {
      assert.equal(utils.getSongName('artist - title ft. artist2, artist3'), 'Title');
    }); 

    it('should return the right name with a lot artists', () => {
      assert.equal(utils.getSongName('artist, artist2 - title ft. artist3, artist4'), 'Title');
    }); 

    it('should return the right name with additional data', () => {
      assert.equal(utils.getSongName('artist - song title (remix) [1999]'), 'Song Title (remix) [1999]');
    }); 
  });

  describe('.getSongArtists()', () => {
    it('should return an empty array because of a wrong title', () => {
      assert.lengthOf(utils.getSongArtists('artist'), 0);
    }); 

    it('should return the right array', () => {
      const artists = utils.getSongArtists('artist,artist2 - title ft. artist3,  artist4');
      assert.equal(artists.join(','), 'Artist,Artist2,Artist3,Artist4');
    });
  });

  describe('.getSongSimilarity()', () => {
    it('should return 0 because of wrong titles', () => {
      assert.equal(utils.getSongSimilarity('wrong', 'artist - title'), 0, 'check the wrong first argument');
      assert.equal(utils.getSongSimilarity('artist - title', 'wrong'), 0, 'check the wrong secong argument');
    }); 

    it('should return 1', () => {
      assert.equal(utils.getSongSimilarity('Artist - Title', 'artist - title'), 1);
    }); 

    it('should return > 0.8', () => {
      const res = utils.getSongSimilarity('Artist - Title', 'artist - title 1');
      assert.isTrue(res > 0.8 && res < 1);
    });
  });

  describe('.prepareSongTagsToGet()', () => {
    it('should return buffer APIC', async () => {
      const tags = {
        APIC: {
          imageBuffer: Buffer.from('1')
        }
      };
      const res = await utils.prepareSongTagsToGet(tags);
      assert.instanceOf(res.APIC, Buffer);
    }); 
  }); 
  
  describe('.prepareSongTagsToSet()', () => {
    it('should change "image" to "APIC"', async () => {
      const val = Buffer.from('1');
      const tags = { image: val };
      const res = await utils.prepareSongTagsToSet(tags);
      assert.strictEqual(res.APIC, val);
    }); 

    it('should change fs.ReadStream to a string path', async () => {
      const val = path.join(tools.tmpPath, 'audio.mp3');
      const tags = { APIC: fse.createReadStream(val) };
      const res = await utils.prepareSongTagsToSet(tags);
      assert.equal(res.APIC, val);
    }); 
  });

  describe('.encodeSongTitle()', () => {
    it('should include right symbols', () => {
      const res = utils.encodeSongTitle(`${ Math.random() } - ${ Math.random() }`);
      assert.match(res, /[a-z0-9_]/i);
    }); 
  });

  describe('.decodeSongTitle()', () => {
    it('should include right symbols', () => {
      const title = 'artist - title';
      const res = utils.encodeSongTitle(title);
      assert.equal(utils.decodeSongTitle(res), title);
    }); 
  });

  describe('tags manipulation', () => {
    it('should set the tags', async () => {
      const file = path.join(tools.tmpPath, 'audio.mp3');
      const title = 'artist - title';
      const tags = { fullTitle: title };
      await utils.setSongTags(file, tags)
      const res = await utils.getSongTags(file);
      assert.equal(res.fullTitle, utils.beautifySongTitle(title), 'check the title');
      assert.lengthOf(Object.keys(res), 2, 'check the length');
    });  

    it('should reset the tags', async () => {
      const file = path.join(tools.tmpPath, 'audio.mp3');
      const title = 'artist - title';
      const tags = { TIT3: title };
      await utils.setSongTags(file, tags)
      const res = await utils.getSongTags(file);
      assert.equal(res.TIT3, title, 'check the title');
      assert.lengthOf(Object.keys(res), 1, 'check the length');
    });

    it('should add the tags', async () => {
      const file = path.join(tools.tmpPath, 'audio.mp3');
      const tags = { TIT1: '1', TIT2: '2' };
      await utils.addSongTags(file, tags)
      const res = await utils.getSongTags(file);
      assert.equal(res.TIT3, 'artist - title', 'check the TIT3');
      assert.equal(res.TIT1, tags.TIT1, 'check the TIT1');
      assert.equal(res.TIT2, tags.TIT2, 'check the TIT2');
    });

    it('should merge the tags', async () => {
      const source = { fullTitle: 'Artist - Song', XXX: 'x', TIT3: 'z' };
      const dest = { TIT2: 'Song1', TPE1: 'Artist1', YYY: 'y' };
      const tags = await utils.mergeSongTags(source, dest);
      assert.equal(tags.fullTitle, utils.beautifySongTitle(dest.TPE1 + ' - ' + dest.TIT2), 'check the full title');
      assert.equal(tags.TIT3, 'z', 'check the source keys');
      assert.equal(tags.YYY, 'y', 'check the dest keys');
      assert.isUndefined(tags.XXX, 'check the inheritance');
    });

    it('should remove the tags', async () => {
      const file = path.join(tools.tmpPath, 'audio.mp3');
      await utils.removeSongTags(file)
      const res = await utils.getSongTags(file);
      assert.lengthOf(Object.keys(res), 0);
    });
  });

  describe('.getSongMetadata()', () => {
    it('should return a right object from the file path', async () => {
      const res = await utils.getSongMetadata(path.join(tools.tmpPath, 'audio.mp3'));
      assert.containsAllKeys(res, ['bitrate', 'duration', 'sampleRate']);
    });

    it('should return a right object from the buffer', async () => {
      const res = await utils.getSongMetadata(await fse.readFile(path.join(tools.tmpPath, 'audio.mp3')));
      assert.containsAllKeys(res, ['bitrate', 'duration', 'sampleRate']);
    });

    it('should return a right object from the file stream', async () => {
      const res = await utils.getSongMetadata(fse.createReadStream(path.join(tools.tmpPath, 'audio.mp3')));
      assert.containsAllKeys(res, ['bitrate', 'duration', 'sampleRate']);
    });
  });

  describe('.normalizeString()', () => {
    it('should remove accents', () => {
      assert.equal(utils.normalizeString('Mylène Farmer'), 'Mylene Farmer');
    }); 
  });
});