const assert = require('chai').assert;
const fse = require('fs-extra');
const utils = require('../src/utils');
const tools = require('./tools');

describe('utils', () => {
  describe('.isValidSongAudioLink()', () => {
    it('should return true', () => {
      assert.isTrue(utils.isValidSongAudioLink('http://localhost:80/audio/hash.mp3'), 'check http and mp3');
      assert.isTrue(utils.isValidSongAudioLink('https://192:0.0.1:3000/audio/hash.mpga'), 'check https and mpga');
    }); 
    
    it('should return false', () => {
      assert.isFalse(utils.isValidSongAudioLink('http://localhost/audio/hash'), 'check without an extenstion');
      assert.isFalse(utils.isValidSongAudioLink('http://localhost/audio/hash.mp3'), 'check without a port');
      assert.isFalse(utils.isValidSongAudioLink('ftp://localhost/audio/hash'), 'check the wrong protocol');
      assert.isFalse(utils.isValidSongAudioLink('http://192:0.0.1:80/cover/hash'), 'check the wrong path');
    });
  });

  describe('.isValidSongCoverLink()', () => {
    it('should return true', () => {
      assert.isTrue(utils.isValidSongCoverLink('http://localhost:80/cover/hash.jpg'), 'check http and jpg');
      assert.isTrue(utils.isValidSongCoverLink('https://192:0.0.1:3000/cover/hash.png'), 'check https and png');
    }); 
    
    it('should return false', () => {
      assert.isFalse(utils.isValidSongCoverLink('http://localhost/cover/hash'), 'check without an extenstion');
      assert.isFalse(utils.isValidSongCoverLink('http://localhost/cover/hash.mp3'), 'check without a port');
      assert.isFalse(utils.isValidSongCoverLink('ftp://localhost/cover/hash'), 'check the wrong protocol');
      assert.isFalse(utils.isValidSongCoverLink('http://192:0.0.1:80/audio/hash'), 'check the wrong path');
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

    it('should keep unusual signs but remove emojis and slashes', () => {
      assert.equal(utils.beautifySongTitle(`MrkeyØ - #$-&^@+_*&%'.\\/Song 😀 good`), `Mrkeyø - #$-&^@+_*&%'.\\/song Good`);
    });

    it('should place feats together', () => {
      const res = utils.beautifySongTitle('artist1, artist2,artist3 - title (feat. artist4, artist5,artist6)');
      assert.equal(res, 'Artist1 - Title (feat. Artist4, Artist5, Artist6, Artist2, Artist3)');
    });

    it('should bring all feats to a single form', () => {
      assert.equal(utils.beautifySongTitle('artist - title (ft. Artist)'), 'Artist - Title (feat. Artist)', 'check "ft"');
      assert.equal(utils.beautifySongTitle('artist - title (feat. Artist)'), 'Artist - Title (feat. Artist)', 'check "feat"');
      assert.equal(utils.beautifySongTitle('artist - title (featuring Artist)'), 'Artist - Title (feat. Artist)', 'check "featuring"');
      assert.equal(utils.beautifySongTitle('artist - title ft Artist'), 'Artist - Title (feat. Artist)', 'check without brackets');
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
      assert.equal(utils.getSongName('artist - song title (remix) [1999]'), 'Song Title');
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
      const res = utils.getSongSimilarity('Artist - Title', 'artist - title1');
      assert.isTrue(res > 0.8 && res < 1);
    }); 

    it('should return < 0.3', () => {
      const res = utils.getSongSimilarity('Artist - Title', 'nothing - tiger');
      assert.isTrue(res > 0 && res < 0.3);
    }); 
  });

  describe('.prepareSongTagsToGet()', () => {
    it('should return buffer APIC', () => {
      const tags = {
        APIC: {
          imageBuffer: Buffer.from('1')
        }
      };
      assert.instanceOf(utils.prepareSongTagsToGet(tags).APIC, Buffer);
    }); 
  }); 
  
  describe('.prepareSongTagsToSet()', () => {
    it('should change "image" to "APIC"', () => {
      const val = Buffer.from('1');
      const tags = { image: val };
      assert.strictEqual(utils.prepareSongTagsToSet(tags).APIC, val);
    }); 

    it('should change fs.ReadStream to a string path', () => {
      const val = tools.tmpPath + '/audio.mp3';
      const tags = { APIC: fse.createReadStream(val) };
      assert.equal(utils.prepareSongTagsToSet(tags).APIC, val);
    }); 
  });

  describe('tags manipulation', () => {
    it('should set the tags', async () => {
      const file = tools.tmpPath + '/audio.mp3';
      const title = 'artist - title';
      const tags = { TIT2: title };
      await utils.setSongTags(file, tags)
      const res = await utils.getSongTags(file);
      assert.equal(res.TIT2, title, 'check the title');
      assert.lengthOf(Object.keys(res), 1, 'check the length');
    });  

    it('should reset the tags', async () => {
      const file = tools.tmpPath + '/audio.mp3';
      const title = 'artist - title';
      const tags = { TIT3: title };
      await utils.setSongTags(file, tags)
      const res = await utils.getSongTags(file);
      assert.equal(res.TIT3, title, 'check the title');
      assert.lengthOf(Object.keys(res), 1, 'check the length');
    });

    it('should add the tags', async () => {
      const file = tools.tmpPath + '/audio.mp3';
      const tags = { TIT1: '1', TIT2: '2' };
      await utils.addSongTags(file, tags)
      const res = await utils.getSongTags(file);
      assert.equal(res.TIT3, 'artist - title', 'check the TIT3');
      assert.equal(res.TIT1, tags.TIT1, 'check the TIT1');
      assert.equal(res.TIT2, tags.TIT2, 'check the TIT2');
    });

    it('should remove the tags', async () => {
      const file = tools.tmpPath + '/audio.mp3';
      await utils.removeSongTags(file)
      const res = await utils.getSongTags(file);
      assert.lengthOf(Object.keys(res), 0);
    });
  });
});