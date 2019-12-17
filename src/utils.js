const NodeID3 = require('node-id3');
const fs = require('fs');
const similarity = require('string-similarity');
const utils = Object.assign({}, require('storacle/src/utils'));
const emojiStrip = require('emoji-strip');
const urlRegex = require('url-regex');

utils.regexSongLinks = urlRegex({ strict: false });
utils.regexSongFeats = /[([]*((ft\.?|feat\.?|featuring)[\s]+((?!(\s+[-([)\]]+))[^)\]])+)\s*[)\]]*([\s]+[-([]+|$)/i;

utils.heritableSongTags = [
  'TALB', 'TCOM', 'TCON', 'TCOP', 'TDAT', 'TEXT', 'TIT1', 'TIT3', 'TLAN', 
  'TOAL', 'TOLY', 'TOPE', 'TORY', 'TPE1', 'TPE2', 'TPE3', 'TPE4', 'APIC'
];

/**
 * Check the link is valid as an audio
 * 
 * @see utils.isValidFileLink
 */
utils.isValidSongAudioLink = function (link) {
  if(typeof link != 'string' || !link.match(/\.(mp3|mpeg|mpga)$/i)) {
    return false;
  }

  return this.isValidFileLink(link, { action: 'audio'})
};

/**
 * Check the link is valid as a cover
 * 
 * @see utils.isValidFileLink
 */
utils.isValidSongCoverLink = function (link) {
  if(typeof link != 'string' || !link.match(/\.(jpe?g|png)$/i)) {
    return false;
  }

  return this.isValidFileLink(link, { action: 'cover'})
};

/**
 * Beautify the song title
 * 
 * @param {string} title
 * @returns {string} 
 */
utils.beautifySongTitle = function (title) {
  if(typeof title != 'string') {
    return '';
  }

  title = emojiStrip(title)    
    .replace(/[–—]+/g, '-')
    .replace(this.regexSongLinks, '')
    .replace(/[\sᅠ]+/g, ' ')
    .replace(/([([])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .toLowerCase();

  if(!title.match(' - ')) {
    return '';
  }

  const sides = title.split(' - ');
  let artists = sides[0].split(/,[\s]*/);
  const mainArtist = artists[0];
  artists.shift();
  
  if(!mainArtist) {
    return '';
  }

  const match = title.match(this.regexSongFeats);
  let feats = (match? match[1]: '').replace(/,([^\s])/, ', $1').trim();
  title = `${mainArtist} - ${sides[1]}`;
  title = title.replace(this.regexSongFeats, '$5'); 
  artists = artists.map(a => a.trim());
  
  if(artists.length) {
    feats = feats? [feats].concat(artists).join(', '): `ft. ${ artists.join(', ') }`;  
  }
  
  feats && (title += ` (${feats})`);
  
  title = title   
    .replace(/(feat|ft|featuring)(\.?\s+)/i, 'feat$2')
    .replace(/(feat)(\s+)/, '$1.$2')
    .replace(/\s+/g, ' ')
    .split(' ').map(p => p? (p[0].toUpperCase() + p.slice(1)): p).join(' ')
    .trim()

  return title;
};

/**
 * Check it is a right song title
 * 
 * @param {string} title
 * @param {object} [options]
 * @returns {boolean} 
 */
utils.isSongTitle = function (title, options = {}) {
  if(options.beautify || options.beautify === undefined) {
    title = this.beautifySongTitle(title);
  }

  if(typeof title != 'string' || title.length > 500) {
    return false;
  }

  return /.\s+-\s+./.test(title);
};

/**
 * Get the song name
 * 
 * @param {string} title
 * @param {object} [options]
 * @returns {string} 
 */
utils.getSongName = function (title, options = {}) {  
  if(options.beautify || options.beautify === undefined) {
    title = this.beautifySongTitle(title);
  }

  if(!this.isSongTitle(title, { beautify: false })) {
    return '';
  }

  return title.replace(this.regexSongFeats, '$5').split(' - ')[1].split(/[[(]/)[0].trim();
};

/**
 * Get the song similarity
 * 
 * @param {string} source
 * @param {string} target
 * @returns {float} 
 */
utils.getSongSimilarity = function (source, target) {  
  source = this.beautifySongTitle(source).toLowerCase();
  target = this.beautifySongTitle(target).toLowerCase();

  if(!source || !target) {
    return 0;
  }

  const m = similarity.compareTwoStrings(source, target);
  source = this.getSongName(source, { beautify: false });
  target = this.getSongName(target, { beautify: false });
  const a = similarity.compareTwoStrings(source, target);
  return (m + a) / 2;
};

/**
 * Prepare the song tags to get
 * 
 * @param {object} tags
 * @returns {object}
 */
utils.prepareSongTagsToGet = function (tags) {
  if(tags.APIC && typeof tags.APIC == 'object' && !(tags.APIC instanceof Buffer)) {
    tags.APIC = tags.APIC.imageBuffer;
  } 

  return tags;
};

/**
 * Prepare the song tags to set
 * 
 * @param {object} tags
 * @returns {object}
 */
utils.prepareSongTagsToSet = function (tags) {
  if(tags.image) {
    tags.APIC = tags.image;
    delete tags.image;
  }

  if(this.isFileReadStream(tags.APIC)) {    
    tags.APIC.destroy();
    tags.APIC = tags.APIC.path;
  }

  return tags;
};

/**
 * Prepare the song Blob file
 * 
 * @param {Buffer} buffer
 * @param {Blob|File} blob 
 * @returns {Blob|File}
 */
utils.prepareSongBlobFile = function (buffer, blob) {
  const opts = { type: blob.type };
  return blob instanceof File? new File([buffer], blob.name, opts): new Blob([buffer], opts);
};

/**
 * Get the song tags
 * 
 * @async
 * @param {string|Buffer|fs.ReadStream|Blob} file
 * @returns {object} 
 */
utils.getSongTags = async function (file) {  
  if(typeof Blob == 'function' && file instanceof Blob) {
    file = await this.blobToBuffer(file);
  }
 
  if(file instanceof Buffer) {
    const tags = NodeID3.read(file);
    return this.prepareSongTagsToGet(tags? tags.raw: {});
  }

  return new Promise((resolve, reject) => {
    NodeID3.read(file.path || file, (err, tags) => {
      if(err) {
        return reject(err);
      }

      resolve(this.prepareSongTagsToGet(tags.raw || {}));
    });
  });  
};

/**
 * Get the song tags
 * 
 * @async
 * @param {string|Buffer|fs.ReadStream|Blob} file
 * @param {object} tags
 * @returns {string|Buffer|fs.ReadStream|Blob} 
 */
utils.setSongTags = async function (file, tags) {
  tags = this.prepareSongTagsToSet(tags);

  if(typeof Blob == 'function' && file instanceof Blob) {
    const buffer = NodeID3.write(tags, await this.blobToBuffer(file));
    return this.prepareSongBlobFile(buffer, file);
  }

  if(file instanceof Buffer) {
    return NodeID3.write(tags, file);
  }

  return new Promise((resolve, reject) => {
    NodeID3.write(tags, file.path || file, (err) => {
      if(err) {
        return reject(err);
      }

      if(file.path) {
        file.destroy();
        file = fs.createReadStream(file.path);
      }

      resolve(file);
    });
  });
};

/**
 * Add the song tags
 * 
 * @async
 * @param {string|Buffer|fs.ReadStream|Blob} file
 * @param {object} tags
 * @returns {string|Buffer|fs.ReadStream|Blob} 
 */
utils.addSongTags = async function (file, tags) {
  tags = this.prepareSongTagsToSet(tags);

  if(typeof Blob == 'function' && file instanceof Blob) {
    const buffer = NodeID3.update(tags, await this.blobToBuffer(file));
    return this.prepareSongBlobFile(buffer, file);
  }

  if(file instanceof Buffer) {
    return NodeID3.update(tags, file);
  }

  return new Promise((resolve, reject) => {
    NodeID3.update(tags, file.path || file, (err) => {
      if(err) {
        return reject(err);
      }

      if(file.path) {
        file.destroy();
        file = fs.createReadStream(file.path);
      }

      resolve(file);
    });
  });  
};

/**
 * Remove the song
 * 
 * @async
 * @param {string|Buffer|fs.ReadStream|Blob} file
 * @returns {string|Buffer|fs.ReadStream|Blob} 
 */
utils.removeSongTags = async function (file) {
  if(typeof Blob == 'function' && file instanceof Blob) {
    const buffer = NodeID3.removeTagsFromBuffer(await this.blobToBuffer(file));
    return this.prepareSongBlobFile(buffer, file);
  }

  if(file instanceof Buffer) {
    return NodeID3.removeTagsFromBuffer(file);
  }

  return new Promise((resolve, reject) => {
    NodeID3.removeTags(file.path || file, (err) => {
      if(err) {
        return reject(err);
      }

      if(file.path) {
        file.destroy();
        file = fs.createReadStream(file.path);
      }

      resolve(file);
    });
  });  
};

module.exports = utils;
