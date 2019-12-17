const errors = require('../../../../errors');
const utils = require('../../../../utils');

/**
 * Request the song
 */
module.exports.requestSong = node => {
  return async (req, res, next) => {
    try {
      const title = req.query.title;
      node.songTitleTest(title);
      const link = await node.getSongLink(title, req.query.type);

      if(!link) {
        throw new errors.NotFoundError('File not found');
      }

      res.redirect(link);
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Get the song info
 */
module.exports.getSongInfo = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      const info = await node.getSongInfo(title, { timeout: node.createRequestTimeout(req.body) });
      res.send({ info });
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Get the song link
 */
module.exports.getSongLink = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      const link = await node.getSongLink(title, req.body.type, { timeout: node.createRequestTimeout(req.body) });
      res.send({ link });
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Add the song
 */
module.exports.addSong = node => {
  return async (req, res, next) => {
    try {
      const file = req.body.file;

      if(!utils.isFileReadStream(file)) {
        throw new errors.WorkError('"file" field is invalid', 'ERR_MUSERIA_INVALID_FILE_FIELD');
      }

      const result = await node.addSong(file, { timeout: node.createRequestTimeout(req.body) });
      res.send(result);
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Remove the song
 */
module.exports.removeSong = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      const result = await node.removeSong(title, { timeout: node.createRequestTimeout(req.body) });
      res.send(result);
    }
    catch(err) {
      next(err);
    }
  }
};