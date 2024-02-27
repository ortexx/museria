import schema from "../../../../../schema.js";

export const removeSong = node => {
  return async (req, res, next) => {
    try {
      const title = req.body.title;
      node.songTitleTest(title);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getSongRemovalButlerResponse()
      });
      const results = await node.requestNetwork('remove-song', options);
      const removed = results.reduce((p, c) => p + c.removed, 0);
      return res.send({ removed });
    }
    catch (err) {
      next(err);
    }
  };
};
