const fs = require('fs');
const merge = require('lodash/merge');
const omit = require('lodash/omit');
const ClientMetastocle= require('metastocle-ms/src/client')();
const ClientStoracle = require('storacle-ms/src/client')(ClientMetastocle);
const utils = require('./utils');
const errors = require('./errors');
const pack = require('../package.json');

module.exports = (Parent) => {
  /**
   * Class to manage client requests to the network
   */
  return class ClientMuseria extends (Parent || ClientStoracle) {
    static get version () { return pack.version }
    static get codename () { return pack.name }
    static get utils () { return utils }
    static get errors () { return errors }
    
    constructor(options = {}) {
      options = merge({
        request: {
          fileStoringTimeout: '11m',
          fileGettingTimeout: '5m'
        }
      }, options);
      super(options);
    }    
    
    /**
     * Get the song complete info
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {object[]}
     */
    async getSongInfo(title, options = {}) {
      const result = await this.request('get-song-info', Object.assign({}, options, {
        body: { title },
        timeout: options.timeout || this.options.request.documentGettingTimeout
      }));
      result.info.forEach(obj => obj.tags = utils.createSongTags(obj.tags));
      return result.info;
    }

    /**
     * Find songs
     * 
     * @async
     * @param {string} str
     * @param {object} [options]
     * @param {number} [options.limit]
     * @returns {object[]}
     */
     async findSongs(str, options = {}) {
      const result = await this.request('find-songs', Object.assign({}, options, {
        body: { str, limit: options.limit },
        timeout: options.timeout || this.options.request.documentGettingTimeout
      }));
      result.songs.forEach(obj => obj.tags = utils.createSongTags(obj.tags));
      return result.songs;
    }

    /**
     * Find artist songs
     * 
     * @async
     * @param {string} artist
     * @param {object} [options]
     * @returns {object[]}
     */
     async findArtistSongs(artist, options = {}) {
      const result = await this.request('find-artist-songs', Object.assign({}, options, {
        body: { artist },
        timeout: options.timeout || this.options.request.documentGettingTimeout
      }));
      result.songs.forEach(obj => obj.tags = utils.createSongTags(obj.tags));
      return result.songs;
    }

    /**
     * Get the song main info
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {object}
     */
    async getSong(title, options = {}) {
      const result = await this.request('get-song-info', Object.assign({}, options, {
        body: { title },
        timeout: options.timeout || this.options.request.documentGettingTimeout
      }));

      if(!result.info.length) {
        return null;
      }

      let obj = { tags: {} };

      for(let i = result.info.length - 1; i >= 0; i--) {
        const info = result.info[i];
        !info.coverLink && delete info.coverLink;
        const tags = utils.mergeSongTags(obj.tags, info.tags);  
        obj = Object.assign(obj, info);
        obj.tags = tags; 
      }

      return obj;
    }

    /**
     * Get the song audio link
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {object[]}
     */
    async getSongAudioLink(title, options = {}) {
      return (await this.request('get-song-link', Object.assign({}, options, {
        body: { title, type: 'audio' },
        timeout: options.timeout || this.options.request.documentGettingTimeout
      }))).link;
    }

    /**
     * Get the song cover link
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {string}
     */
    async getSongCoverLink(title, options = {}) {
      return (await this.request('get-song-link', Object.assign({}, options, {
        body: { title, type: 'cover' },
        timeout: options.timeout || this.options.request.documentGettingTimeout
      }))).link;
    }

    /**
     * Get the song to a buffer
     * 
     * @param {string} title
     * @param {string} type
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getSongToBuffer(title, type, options = {}) {
      this.envTest(false, 'getSongToBuffer');
      const { result, timer } = await this.getSongLinkAndTimer(title, type, options);      
      return await utils.fetchFileToBuffer(result.link, this.createDefaultRequestOptions({ timeout: timer() }));
    }
    
    /**
     * Get the song audio to a buffer
     * 
     * @see ClientMuseria.prototype.getSongToBuffer
     */
    async getSongAudioToBuffer(title, options = {}) {
      return this.getSongToBuffer(title, 'audio', options);
    }

    /**
     * Get the song cover to a buffer
     * 
     * @see ClientMuseria.prototype.getSongToBuffer
     */
    async getSongCoverToBuffer(title, options = {}) {
      return this.getSongToBuffer(title, 'cover', options);
    }

    /**
     * Get the song to the path
     * 
     * @param {string} title
     * @param {string} filePath
     * @param {string} type
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getSongToPath(title, filePath, type, options = {}) {
      this.envTest(false, 'getSongToPath');
      const { result, timer } = await this.getSongLinkAndTimer(title, type, options);      
      await utils.fetchFileToPath(filePath, result.link, this.createDefaultRequestOptions({ timeout: timer() }));
    }

    /**
     * Get the song audio to the path
     * 
     * @see ClientMuseria.prototype.getSongToPath
     */
    async getSongAudioToPath(title, filePath, options = {}) {
      return this.getSongToPath(title, filePath, 'audio', options);
    }

    /**
     * Get the song cover to the path
     * 
     * @see ClientMuseria.prototype.getSongToPath
     */
    async getSongCoverToPath(title, filePath, options = {}) {
      return this.getSongToPath(title, filePath,  'cover', options);
    }

    /**
     * Get the song to a blob
     * 
     * @param {string} title
     * @param {string} type
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getSongToBlob(title, type, options = {}) {
      this.envTest(true, 'getSongToBlob');
      const { result, timer } = await this.getSongLinkAndTimer(title, type, options);      
      return await utils.fetchFileToBlob(result.link, this.createDefaultRequestOptions({ timeout: timer() }));
    }

    /**
     * Get the song audio to a blob
     * 
     * @see ClientMuseria.prototype.getSongToBlob
     */
    async getSongAudioToBlob(title, options = {}) {
      return this.getSongToBlob(title, 'audio', options);
    }

    /**
     * Get the song cover to a blob
     * 
     * @see ClientMuseria.prototype.getSongToBlob
     */
    async getSongCoverToBlob(title, options = {}) {
      return this.getSongToBlob(title, 'cover', options);
    }

    /**
     * Get the song link and timer
     *
     * @async
     * @param {string} title
     * @param {string} type
     * @param {object} [options]
     * @returns {Object}
     */
    async getSongLinkAndTimer(title, type, options) {
      const timeout = options.timeout || this.options.request.fileGettingTimeout;
      const timer = this.createRequestTimer(timeout);
      const result  = await this.request('get-song-link', Object.assign({}, options, {
        body: { title, type },
        timeout: timer(this.options.request.fileLinkGettingTimeout)
      }));
      
      if(!result.link) {
        throw new errors.WorkError(`Link for song "${title}" is not found`, 'ERR_MUSERIA_NOT_FOUND_LINK');
      }

      return {
        result,
        timer
      }
    }

    /**
     * Store the file to the storage
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream|Blob|File} file
     * @param {object} [options]
     * @param {boolean} [options.controlled]
     * @param {number} [options.priority]
     */
    async addSong(file, options = {}) {      
      const destroyFileStream = () => utils.isFileReadStream(file) && file.destroy();

      try {
        options = Object.assign({ 
          priority: 0,
          controlled: false 
        }, options);
        const info = await utils.getFileInfo(file);
        const tags = await utils.getSongTags(file);
        
        if(!utils.isSongTitle(tags.fullTitle)) {
          throw new errors.WorkError(`Wrong song title "${tags.fullTitle}"`, 'ERR_MUSERIA_SONG_WRONG_TITLE');
        }

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }

        const priority = String(options.priority);
        const controlled = options.controlled? '1': ''; 
        const result = await this.request('add-song', Object.assign({}, omit(options, ['priority']), {
          formData: {
            priority,
            controlled,
            file: {
              value: file,
              options: {
                filename: info.hash + (info.ext? '.' + info.ext: ''),
                contentType: info.mime
              }
            }
          },
          timeout: options.timeout || this.options.request.fileStoringTimeout
        }));

        destroyFileStream();
        return result;
      }
      catch(err) {
        destroyFileStream();
        throw err;
      }
    }    

    /**
     * Remove the song
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {object}
     */
    async removeSong(title, options = {}) {
      return await this.request('remove-song', Object.assign({}, options, {
        body: { title },
        timeout: options.timeout || this.options.request.fileRemovalTimeout
      }));
    }

    /**
     * Create a deferred song link
     * 
     * @param {string} title 
     * @param {string} type 
     * @param {object} options 
     * @returns {string}
     */
    createRequestedSongLink(title, type, options = {}) {
      options = Object.assign({ 
        query: {
          type,
          title          
        }
      }, options);
      return this.createRequestUrl(`request-song`, options);
    }

    /**
     * Create a deferred song audio link
     * 
     * @see ClientMuseria.prototype.createRequestedSongLink
     */
    createRequestedSongAudioLink(title, options = {}) {
      return this.createRequestedSongLink(title, 'audio', options);
    }

    /**
     * Create a deferred song cover link
     * 
     * @see ClientMuseria.prototype.createRequestedSongLink
     */
    createRequestedSongCoverLink(title, options = {}) {
      return this.createRequestedSongLink(title, 'cover', options);
    }
  }
};