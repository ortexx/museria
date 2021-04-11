/**
 * Remove the song
 */
module.exports.removeSong = node => {
  return async (req, res, next) => {
    try {
      let removed = false;

      if(req.document && req.document.fileHash && await node.hasFile(req.document.fileHash)) {
        await node.removeFileFromStorage(req.document.fileHash);
        removed = true;
      }

      res.send({ removed: +removed });
    }
    catch(err) {
      next(err);
    } 
  }   
};