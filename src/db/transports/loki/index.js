const DatabaseMuseria = require('../database')();
const DatabaseLoki = require('spreadable/src/db/transports/loki')(DatabaseMuseria);
const DatabaseLokiMetastocle = require('metastocle/src/db/transports/loki')(DatabaseLoki);
const DatabaseLokiStoracle = require('storacle/src/db/transports/loki')(DatabaseLokiMetastocle);
const ArrayChunkReader = require('array-chunk-reader');
const utils = require('../../../utils');

module.exports = (Parent) => {
  /**
   * Lokijs database transport
   */
  return class DatabaseLokiMuseria extends (Parent || DatabaseLokiStoracle) {
    /**
     * @see DatabaseMuseria.prototype.getMusicByPk
     */
    async getMusicByPk(title, options = {}) {
      title = utils.beautifySongTitle(title);
      options = Object.assign({
        similarity: this.node.options.music.similarity
      }, options);      
      const fullName = this.createCollectionName('music');
      const collection = await this.node.getCollection('music');
      const documents = this.col[fullName].find();
      const reader = new ArrayChunkReader(documents, { limit: 1000, log: false });
      let max = null;

      await reader.start((doc) => {
        let score = doc[collection.pk] === title? 1: 0;

        if(!score) {
          score = utils.getSongSimilarity(doc[collection.pk], title, { 
            beautify: false, 
            min: options.similarity
          });
        }

        if(score === 1) {
          max = { score, doc };
          return reader.stop();
        }

        if(!max || score > max.score) {
          max = { score, doc };
          return;
        }

        if(score == max.score && Math.random() > 0.5) {
          max = { score, doc };
        }
      });

      if(max && max.score >= options.similarity) {
        return this.prepareDocumentToGet(max.doc);
      }

      return null;
    }

    /**
     * @see DatabaseMuseria.prototype.getMusicByFileHash
     */
    async getMusicByFileHash(hash) {
      const fullName = this.createCollectionName('music');
      const document = this.col[fullName].by('fileHash', hash);
      return document? this.prepareDocumentToGet(document): null;
    }

    /**
     * @see DatabaseMuseria.prototype.removeMusicByFileHash
     */
    async removeMusicByFileHash(hash) {
      const fullName = this.createCollectionName('music');
      this.col[fullName].chain().find({ fileHash: hash }).remove();
    }
  }
};