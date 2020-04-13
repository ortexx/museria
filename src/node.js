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
const ApprovalCaptcha = require('spreadable/src/approval/transports/captcha')();
const NodeMetastocle = require('metastocle/src/node')();
const NodeStoracle = require('storacle/src/node')(NodeMetastocle);
const schema = require('./schema');
const utils = require('./utils');
const errors = require('./errors');
const pack = require('../package.json');

module.exports = (Parent) => {
  /**
   * Class to manage the node
   */
  return class NodeMuseria extends (Parent || NodeStoracle) {
    static get version () { return pack.version }
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
            limit: 'auto',
            queue: true,
            limitationOrder: ['priority', '$accessedAt'],
            schema: schema.getMusicCollection()
          }
        },
        music: {
          similarity: 0.85,
          relevanceTime: '14d',
          prepareTitle: true,
          prepareCover: true,
          coverQuality: 85,
          coverMinSize: 200,
          coverMaxSize: 500
        },
        storage: {     
          autoCleanSize: '30mb',
          tempLifetime: '10m',
          dataSize: '95% - 2gb',
          tempSize: '2gb'
        },
        file: {
          maxSize: '30mb',
          minSize: '200kb',
          mimeWhitelist: [
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
      this.__songSyncDelay = 1000 * 10;
    }

    /**
     * @see NodeStoracle.prototype.init
     */
    async init() {
      await this.addApproval('addSong', new ApprovalCaptcha(this, { period: this.options.request.fileStoringNodeTimeout }));
      await super.init.apply(this, arguments);
    }

    /**
     * @see NodeStoracle.prototype.prepareServices
     */
    async prepareServices() {
      await super.prepareServices.apply(this, arguments);

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
        
        if(
          !doc.fileHash || 
          typeof doc.fileHash != 'string' ||
          (
            Date.now() - doc.$updatedAt > this.__songSyncDelay &&
            !await this.hasFile(doc.fileHash)
          )
        ) {
          await this.db.deleteDocument(doc);
          continue;
        }

        hashes[doc.fileHash] = true;
      }

      await this.iterateFiles(async (filePath, stat) => {
        try {
          const hash = path.basename(filePath);

          if(!hashes[hash] && Date.now() - stat.mtimeMs > this.__songSyncDelay) {
            await this.removeFileFromStorage(hash);
          }
        }
        catch(err) {
          this.logger.warn(err.stack);
        }
      });
    }

     /**
     * @see NodeStoracle.prototype.calculateStorageInfo
     */
    async calculateStorageInfo() { 
      let limit = this.options.collections.music.limit;           
      await super.calculateStorageInfo.apply(this, arguments);   

      if(limit != 'auto') {
        return;
      }
      
      const filesTotalSize = await this.db.getData('filesTotalSize');
      const filesCount = await this.db.getData('filesCount');
      const avgSize = filesTotalSize && filesCount? filesTotalSize / filesCount: this.fileMaxSize;
      limit = Math.floor(this.storageDataSize / avgSize) - 1;
      limit < 1 && (limit = 1);
      const collection = await this.getCollection('music');
      collection.limit = limit;
    }

    /**
     * @see NodeStoracle.prototype.getStatusInfo
     */
    async getStatusInfo(pretty = false) {      
      const collection = await this.getCollection('music');
      return _.merge(await super.getStatusInfo(pretty), { collectionLimit: collection.limit });
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

        hashes[doc.fileHash] = doc;
      }
      
      const tree = new SplayTree((a, b) => {
        if(a.priority == b.priority) {
          return a.accessedAt - b.accessedAt;
        }
        
        return a.priority - b.priority;
      });
      await this.iterateFiles((filePath, stat) => {
        const doc = hashes[path.basename(filePath)] || null;

        if(doc || Date.now() - stat.mtimeMs > this.__songSyncDelay) {
          const accessedAt = doc? doc.$accessedAt: 0;
          const priority = doc? doc.priority: -1;
          tree.insert({ accessedAt, priority }, { size: stat.size, path: filePath });
        }        
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
        options = Object.assign({
          priority: 0,
          controlled: false
        }, options);
        this.songPriorityTest(options);
        file = await this.prepareSongFileBeforeAddition(file);
        const timer = this.createRequestTimer(options.timeout);
        const collection = await this.getCollection('music');        
        const tags = await utils.getSongTags(file);
        this.songTitleTest(tags.fullTitle);        
        const fileInfo = await utils.getFileInfo(file);
        const info = { collection: 'music', pkValue: tags.fullTitle, fileInfo };
        const masterRequestTimeout = await this.getRequestMasterTimeout();

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }

        const results = await this.requestNetwork('get-document-addition-info', {
          body: { info },
          timeout: timer(
            [masterRequestTimeout, this.options.request.fileStoringNodeTimeout],
            { min: masterRequestTimeout, grabFree: true }
          ),
          responseSchema: schema.getDocumentAdditionInfoMasterResponse({ 
            networkOptimum: await this.getNetworkOptimum(),
            schema: collection.schema
          })
        });

        const limit = await this.getDocumentDuplicatesCount(info);
        const filterOptions = Object.assign(await this.getDocumentAdditionInfoFilterOptions(info), { limit });
        const candidates = await this.filterCandidatesMatrix(results.map(r => r.candidates), filterOptions);

        if(!candidates.length) {
          throw new errors.WorkError('Not found a suitable server to store the song', 'ERR_MUSERIA_NOT_FOUND_STORAGE');
        }

        const suspicious = candidates.filter(c => !c.existenceInfo)[0];
        suspicious && await this.db.addBehaviorCandidate('addSong', suspicious.address);
        const servers = candidates.map(c => c.address).sort(await this.createAddressComparisonFunction()); 
        const dupOptions = Object.assign({}, options, { timeout: timer() });
        const dupInfo = Object.assign({ title: tags.fullTitle }, fileInfo);  
        const result = await this.duplicateSong(servers, file, dupInfo, dupOptions);
        
        if(!result) {
          throw new errors.WorkError('Not found an available server to store the file', 'ERR_MUSERIA_NOT_FOUND_STORAGE');
        }

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

      let results = await this.requestNetwork('get-song-info', {
        body: { title },
        timeout: options.timeout,
        responseSchema: schema.getSongInfoMasterResponse({ networkOptimum: await this.getNetworkOptimum() })
      });

      const filterOptions = _.merge(await this.getSongInfoFilterOptions());
      let list = await this.filterCandidatesMatrix(results.map(r => r.info), filterOptions);
      list = list.map(c => {
        c.score = utils.getSongSimilarity(title, c.title);
        c.random = Math.random();
        return c;
      });
      return _.orderBy(list, ['score', 'priority', 'random'], ['asc', 'desc', 'asc']).map(c => _.omit(c, ['address']));
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
        return await this[`createSong${_.capitalize(type)}Link`](existent);
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
      const selected = info[0];

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

      const result = await this.requestNetwork('remove-song', {
        body: { title },
        timeout: options.timeout,
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
      const query = qs.stringify({ 
        title: info.title, 
        hash: info.hash,
        controlled: options.controlled? '1': '',
        approvalInfo: options.approvalInfo? JSON.stringify(options.approvalInfo): '',
      });
      options = _.assign({}, { 
        cache: true,
        action: `add-song?${ query }`,
        formData: { 
          exported: options.exported? '1': '', 
          priority: String(options.priority || 0)
        },
        responseSchema: schema.getSongAdditionResponse()
      }, options);
      
      const result = await super.duplicateFile(servers, file, info, options);
      result && options.cache && await this.updateSongCache(result.title, result);
      return result;
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

      const docs = await this.db.getDocuments('music');
      const hashes = {};

      for(let i = 0; i < docs.length; i++) {
        const doc = docs[i];

        if(!doc.fileHash || typeof doc.fileHash != 'string') {
          continue;
        }

        hashes[doc.fileHash] = doc;
      }
  
      await this.iterateFiles(async (filePath) => {
        const fileInfo = await utils.getFileInfo(filePath);
        const doc = hashes[fileInfo.hash];
        
        if(!doc) {
          return;
        }

        const info = Object.assign({ title: doc.title }, fileInfo);
        let file;

        try {
          file = fs.createReadStream(filePath);
          await this.duplicateSong([address], file, info, { 
            exported: true,
            priority: doc.priority,
            timeout: timer() 
          });
          success++;
          file.destroy();
          this.logger.info(`Song "${doc.title}" has been exported`);
        }
        catch(err) {
          file.destroy(); 

          if(options.strict) {
            throw err;
          }
          
          fail++;
          this.logger.warn(err.stack);
          this.logger.info(`Song "${doc.title}" has been failed`);
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
     * @see NodeMetastocle.prototype.getDocumentAdditionInfoFilterOptions
     */
    async getDocumentAdditionInfoFilterOptions() {
      return  _.merge(await super.getDocumentAdditionInfoFilterOptions.apply(this, arguments), {
        uniq: 'address',
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
     * @async
     * @param {object} document
     * @param {object} document.fileHash
     * @returns {string}
     */
    async createSongAudioLink(document) {
      const hash = document.fileHash;
      const info = await utils.getFileInfo(this.getFilePath(hash), { hash: false });
      const code = utils.encodeSongTitle(document.title);
      return `${this.getRequestProtocol()}://${this.address}/audio/${code}${info.ext? '.' + info.ext: ''}?f=${hash}`;
    }

    /**
     * Create the song cover link
     * 
     * @async
     * @param {object} document
     * @param {object} document.fileHash
     * @returns {string}
     */
    async createSongCoverLink(document) {
      const hash = document.fileHash;
      const filePath = this.getFilePath(hash);
      const tags = await utils.getSongTags(filePath);

      if(!tags.APIC) {
        return '';
      }

      const info = await utils.getFileInfo(tags.APIC, { hash: false });
      const code = utils.encodeSongTitle(document.title);
      return `${this.getRequestProtocol()}://${this.address}/cover/${code}${info.ext? '.' + info.ext: ''}?f=${hash}`;
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
      const hashSource = path.basename(filePathSource);
      const hashTarget = path.basename(filePathTarget);

      if(!this.hasFile(hashSource)) {
        return false;
      }

      if(!await fse.exists(filePathTarget)) {
        return true;
      }

      if(hashSource == hashTarget) {
        return true;
      }

      let time = this.options.music.relevanceTime;

      if(time <= 0) {
        return false;
      }

      let mdSource;
      let mdTarget;

      try {
        mdSource = await utils.getSongMetadata(filePathSource);
      }
      catch(err) {
        this.logger.warn(err.stack);
        return false;
      }

      try {
        mdTarget = await utils.getSongMetadata(filePathTarget);
      }
      catch(err) {
        this.logger.warn(err.stack);
        return true;
      }
      
      const criterias = 2;
      const step = Math.round(time / criterias);      
      mdTarget.duration > mdSource.duration && (time -= step);
      mdTarget.sampleRate > mdSource.sampleRate && (time -= step / 2);
      mdTarget.bitrate > mdSource.bitrate && (time -= step / 2);
      return Date.now() - (await fse.stat(filePathSource)).birthtimeMs < time;
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
     * Test the song title
     * 
     * @param {object} info 
     * @param {number} info.priority
     * @param {boolean} info.controlled
     * @param {boolean} [info.exported]
     */
    songPriorityTest({ priority, controlled, exported }) {
      if(typeof priority != 'number' || isNaN(priority) || !Number.isInteger(priority) || priority < -1 || priority > 1) {
        throw new errors.WorkError(`Song priority must be an integer from -1 to 1`, 'ERR_MUSERIA_SONG_WRONG_PRIORITY');
      }

      if(priority > 0 && !controlled && !exported) {
        throw new errors.WorkError(`Priority 1 can be set only if "controlled" is true`, 'ERR_MUSERIA_SONG_WRONG_PRIORITY_CONTROLLED');
      }
    }

    /** 
     * @see NodeStoracle.prototype.calculateTempFileMinSize
     */
    calculateTempFileMinSize(size) {
      return size * 2 + this.fileMaxSize;
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