const _ = require('lodash');
const DatabaseMuseria = require('../database')();
const DatabaseLoki = require('spreadable/src/db/transports/loki')(DatabaseMuseria);
const DatabaseLokiMetastocle = require('metastocle/src/db/transports/loki')(DatabaseLoki);
const DatabaseLokiStoracle = require('storacle/src/db/transports/loki')(DatabaseLokiMetastocle);
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
      options = Object.assign({
        similarity: this.node.options.music.similarity
      }, options);
      const fullName = this.createCollectionName('music');
      const collection = await this.node.getCollection('music');
      const documents = this.col[fullName].find();
      let filtered = [];

      for(let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const score = utils.getSongSimilarity(doc[collection.pk], title);

        if(score >= options.similarity) {
          doc._score = score;
          doc._random = Math.random();
          filtered.push(doc);
        }
      }

      filtered = _.orderBy(filtered, ['_score', '_random'], ['desc', 'asc']); 
      const document = filtered[0];
      filtered.forEach(it => (delete it._score, delete it._random));
      return document? this.prepareDocumentToGet(document): null;
    }

    /**
     * @see DatabaseMuseria.prototype.getMusicByFileHash
     */
    async getMusicByFileHash(hash) {
      const fullName = this.createCollectionName('music');
      const document = this.col[fullName].findOne({ fileHash: hash });
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