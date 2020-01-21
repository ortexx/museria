const _ = require('lodash');
const url = require('url');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fse = require('fs-extra');
const qs = require('querystring');
const SplayTree = require('splaytree');
const DatabaseLokiMuseria = require('./db/transports/loki')();
const ServerExpressMuseria = require('./server/transports/express')();
const NodeMetastocle = require('metastocle/src/node')();
const NodeStoracle = require('storacle/src/node')(NodeMetastocle);
const schema = require('./schema');
const utils = require('./utils');
const errors = require('./errors');

module.exports = (Parent) => {
  /**
   * Class to manage the node
   */
  return class NodeMuseria extends (Parent || NodeStoracle) {
    static get codename () { return 'museria' }
    static get DatabaseTransport () { return DatabaseLokiMuseria }
    static get ServerTransport () { return ServerExpressMuseria }

    /**
     * @see NodeStoracle
     */
    constructor(options = {}) {
      options = _.merge({
        request: {
          fileStoringNodeTimeout: '10m'
        },
        collections: {
          music: {
            pk: 'title',
            limit: 100000,
            queue: true,
            schema: schema.getMusicCollection()
          }
        },
        music: {
          similarity: 0.8,
          relevanceTime: '1s',
          prepareTitle: true,
          prepareCover: true,
          coverQuality: 85,
          coverMinSize: 200,
          coverMaxSize: 500
        },
        storage: {     
          autoCleanSize: '30mb',
          dataSize: '90%',
          tempSize: '10%'
        },
        file: {
          maxSize: '30mb',
          mimeTypeWhitelist: [
            'audio/mp3',
            'audio/mpeg', 
            'audio/mpeg3'    
          ]
        },
        task: {
          cleanUpMusicInterval: '30s'
        }
      }, options);

      super(options); 
    }

    /**
     * @see NodeStoracle.prototype.prepareServices
     */
    async prepareServices() {
      await super.prepareServices();

      if(!this.task) {
        return;
      }

      if(this.options.task.cleanUpMusicInterval) {
        await this.task.add('cleanUpMusic', this.options.task.cleanUpMusicInterval, () => this.cleanUpMusic());
      }
    }

    /** 
     * Clean up the music  
     * 
     * @async
     */
    async cleanUpMusic() {
      const docs = await this.db.getDocuments('music');
      const hashes = {};

      for(let i = 0; i < docs.length; i++) {
        const doc = docs[i];

        if(!doc.fileHash || typeof doc.fileHash != 'string' || !await this.hasFile(doc.fileHash)) {
          await this.db.deleteDocument(doc);
          continue;
        }

        hashes[doc.fileHash] = true;
      }

      await this.iterateFiles(async (filePath) => {
        try {
          const hash = path.basename(filePath);

          if(!hashes[hash]) {
            await this.removeFileFromStorage(hash);
          }
        }
        catch(err) {
          this.logger.warn(err.stack);
        }
      });
    }

    /**
     * @see NodeStoracle.prototype.getStorageCleaningUpTree
     */
    async getStorageCleaningUpTree() {      
      const docs = await this.db.getDocuments('music');
      const hashes = {};

      for(let i = 0; i < docs.length; i++) {
        const doc = docs[i];

        if(!doc.fileHash || typeof doc.fileHash != 'string') {
          continue;
        }

        hashes[doc.fileHash] = doc.$accessedAt;
      }
      
      const tree = new SplayTree((a, b) => a.accessedAt - b.accessedAt);
      await this.iterateFiles((filePath, stat) => {
        const accessedAt = hashes[path.basename(filePath)] || 0;
        tree.insert({ accessedAt }, { size: stat.size, path: filePath });
      });
      return tree;
    }
    
    /**
     * Add the song
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream} file
     * @param {object} [options]
     * @returns {string}
     */
    async addSong(file, options = {}) {
      const destroyFileStream = () => utils.isFileReadStream(file) && file.destroy();

      try {
        file = await this.prepareSongFileBeforeAddition(file);
        const timer = this.createRequestTimer(options.timeout);
        const collection = await this.getCollection('music');        
        const tags = await utils.getSongTags(file);
        this.songTitleTest(tags.fullTitle);        
        const fileInfo = await utils.getFileInfo(file);
        const info = { collection: 'music', pkValue: tags.fullTitle, fileInfo };
        const masterRequestTimeout = this.getRequestMastersTimeout(options);

        options = _.merge({
          cache: true
        }, options);

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }

        const results = await this.requestMasters('get-document-addition-candidates', {
          body: { info },
          timeout: timer(
            [masterRequestTimeout, this.options.request.fileStoringNodeTimeout],
            { min: masterRequestTimeout, grabFree: true }
          ),
          masterTimeout: options.masterTimeout,
          slaveTimeout: options.slaveTimeout,
          responseSchema: schema.getDocumentAdditionCandidatesMasterResponse({ 
            networkOptimum: await this.getNetworkOptimum(),
            schema: collection.schema
          })
        });

        const limit = await this.getDocumentDuplicatesCount(info);
        const filterOptions = Object.assign(await this.getDocumentAdditionCandidatesFilterOptions(info), { limit });
        const candidates = await this.filterCandidatesMatrix(results.map(r => r.candidates), filterOptions);

        if(!candidates.length) {
          throw new errors.WorkError('Not found a suitable server to store the song', 'ERR_MUSERIA_NOT_FOUND_STORAGE');
        }

        const suspicious = candidates.filter(c => !c.existenceInfo)[0];
        suspicious && await this.db.addBehaviorCandidate('addSong', suspicious.address);
        const servers = candidates.map(c => c.address).sort(await this.createAddressComparisonFunction()); 
        const result = await this.duplicateSong(servers, file, _.merge({ title: tags.fullTitle }, fileInfo), { timeout: timer() });
        
        if(!result) {
          throw new errors.WorkError('Not found an available server to store the file', 'ERR_MUSERIA_NOT_FOUND_STORAGE');
        }

        options.cache && await this.updateSongCache(result.title, result);
        destroyFileStream();
        return _.omit(result, ['address']);
      }
      catch(err) {
        destroyFileStream();
        throw err;
      }
    }

    /**
     * Prepare the song file before the addition
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream} file
     * @returns {string|Buffer|fs.ReadStream}
     */
    async prepareSongFileBeforeAddition(file) {
      const tags = await utils.getSongTags(file);
      let changed = false;

      if(this.options.music.prepareTitle) {     
        this.songTitleTest(tags.fullTitle);
        tags.fullTitle = await this.prepareSongTitle(tags.fullTitle);     
        changed = true;
      }

      if(tags.APIC && this.options.music.prepareCover) {
        tags.APIC = await this.prepareSongCover(tags.APIC);
        changed = true;
      }

      if(!changed) {
        return file;
      }
      
      return await utils.setSongTags(file, tags);
    }

    /**
     * Prepare the song cover
     * 
     * @async
     * @param {Buffer} buffer
     * @returns {Buffer}
     */
    async prepareSongCover(buffer) {      
      const image = await sharp(buffer);
      const maxSize = this.options.music.coverMaxSize;
      const minSize = this.options.music.coverMinSize;
      const metadata = await image.metadata();
      let width = metadata.width;
      let height = metadata.height;
      
      if(minSize && (width < minSize || height < minSize )) {
        throw new errors.WorkError(`Minimum size of cover width or height is ${minSize}px`, 'ERR_MUSERIA_COVER_MIN_SIZE');
      }

      let dev; 
      let maxDev;

      if(width > maxSize) {
        maxDev = height / maxSize;
        dev = width / maxSize;
      }
      else {
        maxDev = width / maxSize;
        dev = height / maxSize;        
      }

      dev > maxDev && (dev = maxDev);
      width = Math.floor(width / dev);
      height =  Math.floor(height / dev);
      const size = width > height? height: width;
      return await image
      .jpeg({ quality: this.options.music.coverQuality })
      .resize(width, height)
      .extract({ 
        left: Math.floor((width - size) / 2),
        top: Math.floor((height - size) / 2),
        width: size,
        height: size
      })
      .toBuffer();
    }

    /**
     * Prepare the song title
     * 
     * @async
     * @param {string} title
     * @returns {string}
     */
    async prepareSongTitle(title) {
      return utils.beautifySongTitle(title);
    }

    /**
     * Get the song info 
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {string[]}
     */
    async getSongInfo(title, options = {}) {  
      this.songTitleTest(title);

      let results = await this.requestMasters('get-song-info', {
        body: { title },
        timeout: options.timeout,
        masterTimeout: options.masterTimeout,
        slaveTimeout: options.slaveTimeout,
        responseSchema: schema.getSongInfoMasterResponse({ networkOptimum: await this.getNetworkOptimum() })
      });

      const filterOptions = _.merge(await this.getSongInfoFilterOptions());
      let list = await this.filterCandidatesMatrix(results.map(r => r.info), filterOptions);
      list = list.map(c => {
        c.score = utils.getSongSimilarity(title, c.title);
        return c;
      });
      return _.orderBy(list, 'score', 'asc').map(c => _.omit(c, ['address']));
    }

    /**
     * Get the song link
     * 
     * @async
     * @param {string} title
     * @param {string} type
     * @param {object} [options]
     * @returns {string}
     */
    async getSongLink(title, type, options = {}) {
      if(type != 'audio' && type != 'cover') {
        throw new errors.WorkError(`Link type must be "audio" or "cover", not "${type}"`, 'ERR_MUSERIA_SONG_LINK_TYPE');
      }

      this.songTitleTest(title);

      options = _.merge({
        cache: true
      }, options);

      title = utils.beautifySongTitle(title);
      const existent = await this.db.getMusicByPk(title);

      if(existent && existent.fileHash && await this.hasFile(existent.fileHash)) {
        return await this[`createSong${_.capitalize(type)}Link`](existent.fileHash);
      }

      LOOKING_FOR_CACHE: if(this.cacheFile && options.cache) {
        const cache = await this.cacheFile.get(title);

        if(!cache) {
          break LOOKING_FOR_CACHE;
        }

        const link = cache.value[`${type}Link`];

        if(await this.checkCacheLink(link)) {
          return link;
        }

        const obj = _.merge({}, cache.value, { [`${type}Link`]: '' });
        
        if(!obj.audioLink && !obj.coverLink) {
          await this.cacheFile.remove(title);
          break LOOKING_FOR_CACHE;
        }

        await this.cacheFile.set(title, obj);
      } 

      const info = (await this.getSongInfo(title, options)).filter(c => c[`${type}Link`]);      
      const selected = _.maxBy(_.shuffle(info), 'score');

      if(options.cache && selected) {
        await this.updateSongCache(title, selected);
        selected.title != title && await this.updateSongCache(selected.title, selected);
      }
      
      return selected? selected[`${type}Link`]: '';
    }

    /**
     * Get the song audio link
     * 
     * @see NodeMuseria.prototype.getSongAudioLink
     */
    async getSongAudioLink(title, options = {}) {
      return this.getSongLink(title, 'audio', options);
    }

    /**
     * Get the song cover link
     * 
     * @see NodeMuseria.prototype.getSongCoverLink
     */
    async getSongCoverLink(title, options = {}) {
      return this.getSongLink(title, 'cover', options);
    }

    /**
     * Get the song info filter options
     * 
     * @async
     * @returns {object}
     */
    async getSongInfoFilterOptions() {
      return {
        fnFilter: c => (
          utils.isValidSongAudioLink(c.audioLink) &&
          (!c.coverLink || utils.isValidSongCoverLink(c.coverLink))
        )
      }
    }

    /**
     * Remove the song
     * 
     * @async
     * @param {string} title
     * @param {object} [options]
     * @returns {string}
     */
    async removeSong(title, options = {}) {
      this.songTitleTest(title);

      const result = await this.requestMasters('remove-song', {
        body: { title },
        timeout: options.timeout,
        masterTimeout: options.masterTimeout,
        slaveTimeout: options.slaveTimeout,
        responseSchema: schema.getSongRemovalMasterResponse()
      });

      return { removed: result.reduce((p, c) => p + c.removed, 0) };
    }

    /**
     * Update the song cache
     * 
     * @async
     * @param {string} title
     * @param {object} value
     * @param {string} value.audioLink
     * @param {string} [value.coverLink]
     */
    async updateSongCache(title, value) {  
      if(!this.cacheFile) {
        return;
      }
      
      const cache = await this.cacheFile.get(title);        
      let obj = { audioLink: value.audioLink, coverLink: value.coverLink };      
      (!await utils.isValidSongAudioLink(obj.audioLink) || url.parse(obj.audioLink).host == this.address) && delete obj.audioLink;
      (!await utils.isValidSongCoverLink(obj.coverLink) || url.parse(obj.coverLink).host == this.address) && delete obj.coverLink;
      obj = _.merge(cache? cache.value: {}, obj);
      
      if(!Object.keys(obj).length) {
        return;
      }
      
      await this.cacheFile.set(title, obj);
    }

    /**
     * @see NodeStoracle.prototype.duplicateFile
     */
    async duplicateSong(servers, file, info, options = {}) {
      options = _.assign({}, { 
        action: `add-song?${qs.stringify({ title: info.title, hash: info.hash })}`,
        responseSchema: schema.getSongAdditionResponse()
      }, options);
      return await super.duplicateFile(servers, file, info, options);
    }

    /**
     * Export songs to another server
     * 
     * @see NodeStoracle.prototype.exportFiles
     */
    async exportSongs(address, options = {}) {  
      options = _.merge({
        strict: false
      }, options);

      let success = 0;
      let fail = 0;
      const timer = this.createRequestTimer(options.timeout);

      await this.requestServer(address, `/ping`, {
        method: 'GET',
        timeout: timer(this.options.request.pingTimeout)
      });
  
      await this.iterateFiles(async (filePath) => {
        const fileInfo = await utils.getFileInfo(filePath);
        const tags = await utils.getSongTags(filePath);
        const title = tags.fullTitle;
        const info = Object.assign({ title }, fileInfo);
        let file;

        try {
          file = fs.createReadStream(filePath);
          await this.duplicateSong([address], file, info, { timeout: timer() });                       
          success++;
          file.destroy();
          this.logger.info(`Song "${title}" has been exported`);
        }
        catch(err) {
          file.destroy();

          if(options.strict) {
            throw err;
          }
          
          fail++;
          this.logger.warn(err.stack);
          this.logger.info(`Song "${title}" has been failed`);
        }
      });

      if(!success && !fail) {
        this.logger.info(`There are not songs to export`);
      }
      else if(!fail) {
        this.logger.info(`${success} song(s) have been exported`);
      }
      else {
        this.logger.info(`${success} song(s) have been exported, ${fail} song(s) have been failed`);
      }
    }

    /**
     * @see NodeMetastocle.prototype.getDocumentAdditionCandidatesFilterOptions
     */
    async getDocumentAdditionCandidatesFilterOptions() {
      return  _.merge(await super.getDocumentAdditionCandidatesFilterOptions.apply(this, arguments), {
        fnCompare: await this.createSongAdditionComparisonFunction(),
        fnFilter: c => c.isAvailable
      });
    }

    /**
     * @see NodeMetastocle.prototype.getDocumentExistenceInfo
     */
    async getDocumentExistenceInfo(info) {
      if(info.collection == 'music') {
        return await this.db.getMusicByPk(info.pkValue);
      }      

      return await super.getDocumentExistenceInfo.apply(this, arguments);
    }

    /**
     * @see NodeMetastocle.prototype.documentAvailabilityTest
     */
    async documentAvailabilityTest(info = {}) {
      if(info.collection == 'music') {
        await this.fileAvailabilityTest(info.fileInfo);
        const existent = await this.db.getMusicByPk(info.pkValue);

        if(existent) {
          return;
        }
      }
      
      return await super.documentAvailabilityTest.apply(this, arguments);
    }

    /**
     * Create a document addition comparison function
     * 
     * @async
     * @returns {function}
     */
    async createSongAdditionComparisonFunction() {
      const obj = await this.prepareCandidateSuscpicionInfo('addSong');
      const fn = await this.createDocumentAdditionComparisonFunction();

      return (a, b) => {
        if(a.existenceInfo && !b.existenceInfo) {
          return -1;
        }

        if(!a.existenceInfo && b.existenceInfo) {
          return 1;
        }

        const suspicionLevelA = obj[a.address] || 0;
        const suspicionLevelB = obj[b.address] || 0;

        if(suspicionLevelA != suspicionLevelB) {
          return suspicionLevelA - suspicionLevelB;
        }

        return fn(a, b);
      }
    }

    /**
     * Create the song audio link
     * 
     * @see NodeStoracle.prototype.createFileLink
     */
    async createSongAudioLink(hash) {
      const info = await utils.getFileInfo(this.getFilePath(hash), { hash: false });
      return `${this.getRequestProtocol()}://${this.address}/audio/${hash}${info.ext? '.' + info.ext: ''}`;
    }

    /**
     * Create the song cover link
     * 
     * @see NodeStoracle.prototype.createFileLink
     */
    async createSongCoverLink(hash) {
      const filePath = this.getFilePath(hash);
      const tags = await utils.getSongTags(filePath);

      if(!tags.APIC) {
        return '';
      }

      const info = await utils.getFileInfo(tags.APIC, { hash: false });
      return `${this.getRequestProtocol()}://${this.address}/cover/${hash}${info.ext? '.' + info.ext: ''}`;
    }

    /**
     * @see NodeStoracle.prototype.removeFileFromStorage
     * 
     * @param [options]
     */
    async removeFileFromStorage(hash, options = {}) {
      await super.removeFileFromStorage.apply(this, arguments);
      !options.ignoreDocument && await this.db.removeMusicByFileHash(hash);
    }    

    /**
     * Check the song relevance
     * 
     * @async
     * @param {string} filePathSource
     * @param {string} filePathTarget
     * @returns {boolean}
     */
    async checkSongRelevance(filePathSource, filePathTarget) {
      if(!this.hasFile(path.basename(filePathSource))) {
        return false;
      }

      if(!await fse.exists(filePathTarget)) {
        return true;
      }

      return Date.now() - (await fse.stat(filePathSource)).birthtimeMs <= this.options.music.relevanceTime;
    }

    /**
     * Test the song title
     * 
     * @param {string} title 
     */
    songTitleTest(title) {
      if(!utils.isSongTitle(title)) {
        throw new errors.WorkError(`Wrong song title "${title}"`, 'ERR_MUSERIA_SONG_WRONG_TITLE');
      }
    }

    /**
     * Prepare the options
     */
    prepareOptions() {
      super.prepareOptions();
      this.options.music.relevanceTime = utils.getMs(this.options.music.relevanceTime);
    }
  }
};