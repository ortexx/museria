import _ from "lodash";
import collection from "metastocle-ms/src/collection/transports/collection/index.js";
import utils from "../../../utils.js";
import schema from "../../../schema.js";
const Collection = collection();
export default (Parent) => {
    /**
     * Music collection transport
     */
    return class MusicCollection extends (Parent || Collection) {
        static get DocumentsHandler() { return utils.MusicDocumentsHandler; }
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
            if (!doc.fileHash) {
                return null;
            }
            try {
                const filePath = this.node.getFilePath(doc.fileHash);
                const buff = await this.node.getSongAudioHeadersBuffer(filePath);
                try {
                    doc.tags = await utils.getSongTags(buff);
                }
                catch (err) {
                    this.node.logger.warn(err.stack);
                    doc.tags = {};
                }
                doc.audioLink = await this.node.createSongAudioLink(doc);
                doc.coverLink = await this.node.createSongCoverLink(doc, doc.tags);
                doc.tags = _.omit(doc.tags, ['APIC']);
                doc.priority = doc.priority || 0;
            }
            catch (err) {
                this.node.logger.warn(err.stack);
                return null;
            }
            return doc;
        }
    };
};
