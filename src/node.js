const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fse = require('fs-extra');
const qs = require('querystring');
const SplayTree = require('splaytree');
const DatabaseLokiMuseria = require('./db/transports/loki')();
const ServerExpressMuseria = require('./server/transports/express')();
const MusicCollection = require('./collection/transports/music')();
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
    static get codename () { return pack.name }
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
            maxSize: '200mb',
            queue: true,
            loki: {
              unique: ['title', 'fileHash'],
            },            
            limitationOrder: ['priority', '$accessedAt'],
            duplicationKey: 'fileHash',
            schema: schema.getMusicCollection()
          }
        },
        music: {
          audioHeadersMaxSize: '180kb',
          coverHeadersMaxSize: '5kb',
          findingStringMinLength: 4,
          findingLimit: 200,
          similarity: 0.91,
          relevanceTime: '14d',
          prepareTitle: true,
          prepareCover: true,
          coverQuality: 80,
          coverMinSize: 200,
          coverMaxSize: 500,
          coverMaxFileSize: '110kb'
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
          cleanUpMusicInterval: '1m'
        }
      }, options);

      super(options);
      this.__addingFiles = {};
    }

    /**
    * @see NodeStoracle.prototype.initBeforeSync
    */
    async initBeforeSync() {
      await super.initBeforeSync.apply(this, arguments);      
      await this.normalizeSongTitles();
      await this.cleanUpMusic();
    } 

    /**
     * @see NodeStoracle.prototype.prepareServices
     */
    async prepareServices() {
      await super.prepareServices.apply(this, arguments);
      await this.addApproval('addSong', new ApprovalCaptcha({ period: this.options.request.fileStoringNodeTimeout })); 
      await this.addCollection('music', new MusicCollection(this.options.collections.music));
    }

    /**
     * Prepare the task service
     * 
     * @async
     */
    async prepareTask() {   
      await super.prepareTask.apply(this, arguments);

      if(!this.task) {
        return;
      }

      if(this.options.task.cleanUpMusicInterval) {
        await this.task.add('cleanUpMusic', this.options.task.cleanUpMusicInterval, () => this.cleanUpMusic());
      }
    }

    /** 
     * Normalize the song titles
     * 
     * @async
     */
    async normalizeSongTitles() {
      const docs = await this.db.getDocuments('music');
      const titles = {};

      for(let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const title = utils.beautifySongTitle(doc.title);

        if(titles[title] && titles[title] != doc.$loki) {
          await this.db.deleteDocument(doc);
          continue;
        }

        doc.title = title;
        titles[title] = doc.$loki;
        await this.db.updateMusicDocument(doc, { beautify: false });
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
            !this.isFileAdding(doc.fileHash) &&            
            !await this.hasFile(doc.fileHash) &&
            await this.db.getMusicByFileHash(doc.fileHash)
          )
        ) {
          await this.db.deleteDocument(doc);
          continue;
        }

        hashes[doc.fileHash] = true;
      }

      await this.iterateFiles(async filePath => {
        try {
          const hash = path.basename(filePath);

          if(!hashes[hash] && !this.isFileAdding(hash) && !await this.db.getMusicByFileHash(hash)) {
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
      await this.iterateFiles(async (filePath, stat) => {
        const hash = path.basename(filePath);
        const doc = hashes[hash] || await this.db.getMusicByFileHash(hash);
        
        if(!this.isFileAdding(hash)) {
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
        const servers = candidates.map(c => c.address); 
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
      const maxFileSize = this.options.music.coverMaxFileSize;
      const metadata = await image.metadata();
      let width = metadata.width;
      let height = metadata.height;
      
      if(minSize && (width < minSize || height < minSize )) {
        throw new errors.WorkError(`Minimum size of a cover width or height is ${minSize}px`, 'ERR_MUSERIA_COVER_MIN_SIZE');
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
      let buff = await image
        .jpeg({ quality: this.options.music.coverQuality })
        .resize(width, height)
        .extract({ 
          left: Math.floor((width - size) / 2),
          top: Math.floor((height - size) / 2),
          width: size,
          height: size
        })
        .toBuffer();

      if(buff.byteLength > metadata.size) {
        buff = buffer;
      }        
     
      if(buff.byteLength > maxFileSize) {
        throw new errors.WorkError(`Maximum size of a cover file is ${maxFileSize} byte(s)`, 'ERR_MUSERIA_COVER_MAX_FILE_SIZE');
      }  

      return buff;
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
     * @returns {object[]}
     */
     async getSongInfo(title, options = {}) {  
      title = utils.prepareComparisonSongTitle(title);
      const collection = await this.getCollection('music');
      const actions = utils.prepareDocumentGettingActions({ 
        offset: 0,
        limit: 0,
        removeDuplicates: false,
        filter: { 
          compTitle: {
            $mus: {
              value: title,
              similarity: this.options.music.similarity,
              beautify: false
            }
          }
        },
        sort: this.getFindingSongsSort()
      });        
      await collection.actionsGettingTest(actions);
      const results = await this.requestNetwork('get-documents', {
        body: { actions, collection: 'music' },
        timeout: options.timeout,
        responseSchema: schema.getDocumentsMasterResponse({ schema: collection.schema })
      });      
      results.forEach((result) => {
        result.documents.forEach(doc => {
          doc.main = 1;
          doc.score = utils.getSongSimilarity(title, doc.compTitle, { beautify: false });
          doc.intScore = parseInt(doc.score * 100);
          doc.random = Math.random();
        });
      })
      const result = await this.handleDocumentsGettingForClient(collection, results, actions);
      const documents = result.documents.map(doc => _.omit(doc, ['main', 'address', 'random', 'intScore', 'compTitle']));
      return documents;
    }

    /**
     * Find songs
     * 
     * @async
     * @param {string} str
     * @param {object} [options]
     * @returns {object[]}
     */
     async findSongs(str, options = {}) {
      const title = utils.prepareComparisonSongTitle(str);
      str = utils.prepareSongFindingString(str);

      if(str.length < this.options.music.findingStringMinLength) {
        const msg = `You have to pass at least "${ this.options.music.findingStringMinLength }" symbol(s)`;
        throw new errors.WorkError(msg, 'ERR_MUSERIA_FINDING_SONGS_STRING_LENGTH');
      }
      
      if(!str) {
        return [];
      }
      
      const collection = await this.getCollection('music');
      let limit = options.limit === undefined? this.options.music.findingLimit: options.limit;
      limit > this.options.music.findingLimit && (limit = this.options.music.findingLimit);
      limit < 0 && (limit = 0);      
      const actions = utils.prepareDocumentGettingActions({ 
        offset: 0,
        limit,
        removeDuplicates: true,
        filter: { 
          compTitle: {
            $or: [
              { $milk: str },
              { 
                $mus: {
                  value: title,
                  similarity: this.options.music.similarity,
                  beautify: false
                } 
              }
            ]
          }
        },
        sort: this.getFindingSongsSort()
      });
      const results = await this.requestNetwork('get-documents', {
        body: { actions, collection: 'music' },
        timeout: options.timeout,
        responseSchema: schema.getDocumentsMasterResponse({ schema: collection.schema })
      }); 
      
      const titles = {};
      let documents = results.reduce((p, c) => p.concat(c.documents), []); 
      documents = this.uniqDocuments(collection, documents);
      documents.forEach((doc) => {
        doc.main = 0;
        doc.score = utils.getStringSimilarity(str, doc.compTitle, { ignoreOrder: true });
        doc.intScore = parseInt(doc.score * 100);
        doc.random = Math.random();
        titles[doc.title]? titles[doc.title].push(doc): titles[doc.title] = [doc];
      });
      
      for(let key in titles) {
        const docs = titles[key];
        docs[_.random(0, docs.length - 1)].main = 1;
      }

      actions.removeDuplicates = false;
      const result = await this.handleDocumentsGettingForClient(collection, [{ documents }], actions);
      documents = result.documents.map(doc => _.omit(doc, ['main', 'address', 'random', 'intScore', 'compTitle']));
      return documents;
    }

    /**
     * Find the artist songs
     * 
     * @async
     * @param {string} artist
     * @param {object} [options]
     * @returns {object[]}
     */
      async findArtistSongs(artist, options = {}) { 
        if(!artist || typeof artist != 'string') {
          return [];
        }
        
        artist = utils.prepareSongFindingString(artist);
        const collection = await this.getCollection('music');     
        const actions = utils.prepareDocumentGettingActions({ 
          offset: 0,
          limit: 0,
          removeDuplicates: true,
          filter: { 
            compTitle: {
              $art: artist
            }
          },
          sort: this.getFindingSongsSort()
        });
        const results = await this.requestNetwork('get-documents', {
          body: { actions, collection: 'music' },
          timeout: options.timeout,
          responseSchema: schema.getDocumentsMasterResponse({ schema: collection.schema })
        });        
        const titles = {};
        let documents = results.reduce((p, c) => p.concat(c.documents), []); 
        documents = this.uniqDocuments(collection, documents);  
        documents.forEach((doc) => {
          doc.main = 0;
          titles[doc.title]? titles[doc.title].push(doc): titles[doc.title] = [doc];
        });
        
        for(let key in titles) {
          const docs = titles[key];
          docs[_.random(0, docs.length - 1)].main = 1;
        }

        actions.removeDuplicates = false;
        const result = await this.handleDocumentsGettingForClient(collection, [{ documents }], actions);
        documents = result.documents.map(doc => _.omit(doc, ['main', 'address']));
        return documents;
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
        body: { title, approvalInfo: options.approvalInfo },
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
      !utils.isValidSongAudioLink(obj.audioLink) && delete obj.audioLink;
      !utils.isValidSongCoverLink(obj.coverLink) && delete obj.coverLink;
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
      const query = qs.stringify({ title: info.title });
      options = _.assign({}, { 
        cache: true,
        action: `add-song?${ query }`,
        formData: { 
          exported: options.exported? '1': '', 
          controlled: options.controlled? '1': '',
          priority: String(options.priority || 0),         
          approvalInfo: options.approvalInfo? JSON.stringify(options.approvalInfo): ''
        },
        responseSchema: schema.getSongAdditionResponse()
      }, options);

      const result = await super.duplicateFile(servers, file, info, _.omit(options, ['priority']));
      result && options.cache && await this.updateSongCache(result.title, result);
      return result;
    }

    /**
     * Export all songs to another server
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
        this.logger.info(`There haven't been songs to export`);
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
      const code = utils.encodeSongTitle(document.title);
      return `${this.getRequestProtocol()}://${this.address}/audio/${code}.mp3?f=${hash}`;
    }

    /**
     * Create the song cover link
     * 
     * @async
     * @param {object} document
     * @param {object} document.fileHash
     * @param {object} [tags]
     * @param {Buffer} [tags.APIC]
     * @returns {string}
     */
    async createSongCoverLink(document, tags = null) {
      const hash = document.fileHash;
      const filePath = this.getFilePath(hash);
      tags = tags || await utils.getSongTags(filePath);

      if(!tags.APIC) {
        return '';
      }

      const buff = await this.getSongCoverHeadersBuffer(tags.APIC);
      const info = await utils.getFileInfo(buff, { hash: false });
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
     * @see NodeStoracle.prototype.emptyStorage
     */
    async emptyStorage() {
      await super.emptyStorage.apply(this, arguments);
      await this.db.emptyCollection('music');
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

      if(!await fse.pathExists(filePathTarget)) {
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
     * Run the function adding the file
     *
     * @async
     * @param {string} hash
     * @param {function} fn
     * @returns {*}
     */
    async withAddingFile(hash, fn) {
      let res;
      let isError = false;
      this.__addingFiles[hash] = true;

      try {
        res = await fn();
      }
      catch(err) {
        isError = true;
      }

      delete this.__addingFiles[hash];

      if(isError) {
        throw res;
      }

      return res;
    }

    /**
     * Get the song audio file headers buffer
     * 
     * @see NodeMuseria.prototype.getSongHeadersBuffer
     */
    async getSongAudioHeadersBuffer(content) {
      return this.getSongHeadersBuffer(content, this.options.music.audioHeadersMaxSize);
    }
    
    /**
     * Get the song cover file headers buffer
     * 
     * @see NodeMuseria.prototype.getSongHeadersBuffer
     */
    async getSongCoverHeadersBuffer(content) {
      return this.getSongHeadersBuffer(content, this.options.music.coverHeadersMaxSize);
    }

    /**
     * Get the song file headers buffer
     * 
     * @async
     * @param {string|Buffer} content 
     * @param {number} limit 
     * @returns {Buffer}
     */
    async getSongHeadersBuffer(content, limit) {
      if(typeof content == 'string') {
        return new Promise((resolve, reject) => {
          const chunks = [];
          fs.createReadStream(content, { start: 0, end: limit })
            .on('error', reject)
            .on('data', data => chunks.push(data))
            .on('end', () => resolve(Buffer.concat(chunks)));
        });
      }

      return content.slice(0, limit);
    }

    /**
     * Get finding songs sort
     * 
     * @returns {array}
     */
    getFindingSongsSort() {
      return [['main', 'desc'],['intScore', 'desc'], ['priority', 'desc'], ['random', 'asc']];
    }

    /**
     * Check the file is adding
     * 
     * @param {string} hash 
     * @returns {boolean}
     */
    isFileAdding(hash) {
      return !!this.__addingFiles[hash];
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
      if(!utils.isValidSongPriority(priority)) {
        const msg = 'Song priority must be an integer from -1 to 1';
        throw new errors.WorkError(msg, 'ERR_MUSERIA_SONG_WRONG_PRIORITY');
      }

      if(priority > 0 && !controlled && !exported) {
        const msg = 'Priority 1 is possible only if "controlled" is true';
        throw new errors.WorkError(msg, 'ERR_MUSERIA_SONG_WRONG_PRIORITY_CONTROLLED');
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
      this.options.music.audioHeadersMaxSize = utils.getBytes(this.options.music.audioHeadersMaxSize);
      this.options.music.coverHeadersMaxSize = utils.getBytes(this.options.music.coverHeadersMaxSize);
      this.options.music.coverMaxFileSize = utils.getBytes(this.options.music.coverMaxFileSize);      
    }
  }
};