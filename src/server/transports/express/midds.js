const errors = require('../../../errors');
const utils = require('../../../utils');
const midds = Object.assign({}, require("metastocle/src/server/transports/express/midds"), require("storacle/src/server/transports/express/midds"));

/**
 * Provide audio receiving
 */
midds.audio = node => {
  return midds.file(node);
};

/**
 * Provide covers receiving
 */
midds.cover = node => {
  return [
    midds.requestQueueFileHash(node, false),
    async (req, res, next) => {
      try {        
        const hash = req.params.hash.split('.')[0];

        if(!await node.hasFile(hash)) {
          throw new errors.NotFoundError('File not found');
        }

        const filePath = await node.getFilePath(hash);        
        const tags = await utils.getSongTags(filePath);
        
        if(!tags.APIC) {
          throw new errors.NotFoundError('File not found');
        }        

        const cache = Math.ceil(node.options.file.responseCacheLifetime / 1000);        
        const info = await utils.getFileInfo(tags.APIC, { hash: false });        
        info.mime && res.setHeader("Content-Type", info.mime);
        cache && res.set('Cache-Control', `public, max-age=${cache}`);
        res.setHeader("Content-Length", info.size);
        res.end(tags.APIC, 'binary');
      }
      catch(err) {
        next(err);
      }
    }
  ]
};

/**
 * Control song requests limit by the title and hash
 */
midds.requestQueueSong = (node, active = true) => {
  return async (req, res, next) => {
    const doc = await node.db.getMusicByPk(String(req.query.title));
    const hashes = [String(req.query.hash)];
    doc && hashes.push(doc.fileHash);

    const options = {
      limit: 1,
      active
    };

    return midds.requestQueue(node, hashes.map(h => `songFile=${h}`), options)(req, res, next);
  }
};

module.exports = midds;