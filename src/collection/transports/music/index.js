const _ = require('lodash');
const Collection = require('metastocle/src/collection/transports/collection')();
const utils = require('../../../utils');
const schema = require('../../../schema');

module.exports = (Parent) => {
  /**
   * Music collection transport
   */
  return class MusicCollection extends (Parent || Collection) {
    static get DocumentsHandler () { return utils.MusicDocumentsHandler }

    /**
     * @see Collection.prototype.actionsGettingTest
     */
    async actionsGettingTest(actions) {
      const findingStringMinLength = this.node.options.music.findingStringMinLength;
      utils.validateSchema(schema.getMusicCollectionGetting({ findingStringMinLength }), actions);
    }

    /**
     * @see Collection.prototype.prepareDocumentFromSlave
     */
    async prepareDocumentFromSlave(doc) {
      doc.tags = {};
      doc.audioLink = '';
      doc.coverLink = '';
      doc.priority = doc.priority || 0;

      if(doc.fileHash && await this.node.hasFile(doc.fileHash)) {        
        doc.audioLink = await this.node.createSongAudioLink(doc);
        doc.coverLink = await this.node.createSongCoverLink(doc);
        doc.tags = _.omit(await utils.getSongTags(this.node.getFilePath(doc.fileHash)), ['APIC']);
      }

      return doc;
    }
  }
};