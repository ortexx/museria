const schema = require('../../../../../schema');

/**
 * Get the song info
 */
module.exports.getSongInfo = node => {
  return async (req, res, next) => {
    try {      
      const title = req.body.title;
      node.songTitleTest(title);      
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getSongInfoSlaveResponse()
      });
      const results = await node.requestNetwork('get-song-info', options);
      const info = await node.filterCandidates(results, await node.getSongInfoFilterOptions());
      return res.send({ info });
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
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getSongRemovalSlaveResponse()
      });
      const results = await node.requestNetwork('remove-song', options);
      const removed = results.reduce((p, c) => p + c.removed, 0);
      return res.send({ removed });
    }
    catch(err) {
      next(err);
    } 
  }   
};