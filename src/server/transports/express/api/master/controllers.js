const schema = require('../../../../../schema');

/**
 * Get the song info
 */
module.exports.getSongInfo = node => {
  return async (req, res, next) => {
    try {      
      const title = req.body.title;
      node.songTitleTest(title);      
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer(),
        responseSchema: schema.getSongInfoSlaveResponse()
      });
      const results = await node.requestSlaves('get-song-info', options);
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
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer(),
        responseSchema: schema.getSongRemovalSlaveResponse()
      });
      const results = await node.requestSlaves('remove-song', options);
      return res.send({ removed: results.filter(item => item.removed).length });
    }
    catch(err) {
      next(err);
    } 
  }   
};