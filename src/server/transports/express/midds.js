const fs = require('fs');
const errors = require('../../../errors');
const utils = require('../../../utils');
const midds = Object.assign({}, require("metastocle/src/server/transports/express/midds"), require("storacle/src/server/transports/express/midds"));

/**
 * Control file access
 */
midds.fileAccess = node => {
  return async (req, res, next) => {
    try {
      const doc = await node.db.getMusicByFileHash(String(req.params.hash));
      doc && await node.db.accessDocument(doc);
      next();
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Provide audio receiving
 */
midds.audio = node => {
  return async (req, res, next) => {
    try {
      const hash = req.params.hash.split('.')[0];
      
      if(!await node.hasFile(hash)) {
        throw new errors.NotFoundError('File not found');
      }

      const cache = Math.ceil(node.options.file.responseCacheLifetime / 1000);
      const filePath = await node.getFilePath(hash);
      const info = await utils.getFileInfo(filePath, { hash: false });  
      const range = String(req.headers.range);      
      cache && res.set('Cache-Control', `public, max-age=${cache}`);
      info.mime && res.setHeader("Content-Type", info.mime);        

      if (range.match('bytes=')) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1]? parseInt(parts[1], 10): info.size - 1;
        const chunkSize = (end - start) + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        res.setHeader("Content-Range", `bytes ${ start }-${ end }/${ info.size }`);
        res.setHeader("Accept-Ranges", 'bytes');
        res.setHeader("Content-Length", chunkSize);
        res.status(206);
        stream.on('error', next).pipe(res);
        return;
      } 
      
      res.setHeader("Content-Length", info.size);
      const stream = fs.createReadStream(filePath);
      stream.on('error', next).pipe(res);
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Provide covers receiving
 */
midds.cover = node => {
  return async (req, res, next) => {
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
};

/**
 * Control song requests limit by the title and hash
 */
midds.requestQueueSong = (node) => {
  return async (req, res, next) => {
    const options = { limit: 1 };
    let hashes = []

    try {
      const title = req.query.title? String(req.query.title): req.body.title;
      const doc = await node.db.getMusicByPk(title);      
      req.query.hash && (hashes = [String(req.query.hash)]);
      doc && doc.fileHash && doc.fileHash != req.query.hash && hashes.push(doc.fileHash);
    }
    catch(err) {
      return next(err);
    }

    return midds.requestQueue(node, hashes.map(h => `songFile=${h}`), options)(req, res, next);
  }
};

module.exports = midds;