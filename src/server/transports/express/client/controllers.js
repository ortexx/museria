import errors from "../../../../errors.js";
import utils from "../../../../utils.js";

export const requestSong = node => {
  return async (req, res, next) => {
    try {
      const title = req.query.title;
      node.songTitleTest(title);
      const link = await node.getSongLink(title, req.query.type);

      if (!link) {
        throw new errors.NotFoundError('File not found');
      }

      res.redirect(link);
    }
    catch (err) {
      next(err);
    }
  };
};

export const getSongInfo = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      const info = await node.getSongInfo(title, node.prepareClientMessageOptions(req.body));
      res.send({ info });
    }
    catch (err) {
      next(err);
    }
  };
};

export const findSongs = node => {
  return async (req, res, next) => {
    try {
      const str = req.body.str;
      const limit = req.body.limit;
      const songs = await node.findSongs(str, node.prepareClientMessageOptions(req.body, {
        limit
      }));
      res.send({ songs });
    }
    catch (err) {
      next(err);
    }
  };
};

export const findArtistSongs = node => {
  return async (req, res, next) => {
    try {
      const artist = req.body.artist;
      const songs = await node.findArtistSongs(artist, node.prepareClientMessageOptions(req.body));
      res.send({ songs });
    }
    catch (err) {
      next(err);
    }
  };
};

export const getSongLink = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      const link = await node.getSongLink(title, req.body.type, node.prepareClientMessageOptions(req.body));
      res.send({ link });
    }
    catch (err) {
      next(err);
    }
  };
};

export const addSong = node => {
  return async (req, res, next) => {
    try {
      const file = req.body.file;
      
      if (!utils.isFileReadStream(file)) {
        throw new errors.WorkError('"file" field is invalid', 'ERR_MUSERIA_INVALID_FILE_FIELD');
      }

      const result = await node.addSong(file, node.prepareClientMessageOptions(req.body, {
        controlled: !!req.body.controlled,
        priority: parseInt(req.body.priority || 0)
      }));
      res.send(result);
    }
    catch (err) {
      next(err);
    }
  };
};

export const removeSong = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      const result = await node.removeSong(title, node.prepareClientMessageOptions(req.body));
      res.send(result);
    }
    catch (err) {
      next(err);
    }
  };
};
