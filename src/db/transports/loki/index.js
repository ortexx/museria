import database from "../database/index.js";
import lokiSpreadable from "spreadable/src/db/transports/loki/index.js";
import lokiMetastocle from "metastocle/src/db/transports/loki/index.js";
import lokiStoracle from "storacle/src/db/transports/loki/index.js";
import utils from "../../../utils.js";

const DatabaseMuseria = database();
const DatabaseLoki = lokiSpreadable(DatabaseMuseria);
const DatabaseLokiMetastocle = lokiMetastocle(DatabaseLoki);
const DatabaseLokiStoracle = lokiStoracle(DatabaseLokiMetastocle);

export default (Parent) => {
  /**
   * Lokijs database transport
   */
  return class DatabaseLokiMuseria extends (Parent || DatabaseLokiStoracle) {
    /**
     * @see DatabaseMuseria.prototype.getMusicByPk
     */
    async getMusicByPk(title, options = {}) {
      title = utils.prepareComparisonSongTitle(title);
      options = Object.assign({
          similarity: this.node.options.music.similarity
      }, options);
      const fullName = this.createCollectionName('music');
      const documents = this.col[fullName].find();
      let max = null;
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        let score = doc.compTitle === title? 1: 0;

        if (!score) {
          score = utils.getSongSimilarity(doc.compTitle, title, {
              beautify: false,
              min: options.similarity
          });
        }

        if (score === 1) {
          max = { score, doc };
          break;
        }

        if (!max || score > max.score) {
          max = { score, doc };
          continue;
        }

        if (score == max.score && Math.random() > 0.5) {
          max = { score, doc };
        }
      }

      if (max && max.score >= options.similarity) {
        return this.prepareDocumentToGet(max.doc);
      }

      return null;
    }

    /**
     * Add music document
     *
     * @async
     * @param {object} doc
     * @returns {object}
     */
    async addMusicDocument(doc, options = {}) {
      options.beautify !== false && (doc.title = utils.beautifySongTitle(doc.title));
      doc.compTitle = utils.prepareComparisonSongTitle(doc.title, { beautify: options.beautify });
      return await this.addDocument('music', doc);
    }

    /**
     * Add music document
     *
     * @async
     * @param {object} doc
     * @param {object} options
     * @param {object} options.beautify
     * @returns {object}
     */
    async updateMusicDocument(doc, options = {}) {
      options.beautify !== false && (doc.title = utils.beautifySongTitle(doc.title));
      doc.compTitle = utils.prepareComparisonSongTitle(doc.title, { beautify: options.beautify });
      return await this.updateDocument(doc);
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
  };
};
