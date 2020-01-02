const utils = require('../../../../../utils');
const fs = require('fs');
const _ = require('lodash');

/**
 * Add the song
 */
module.exports.addSong = node => {  
  return async (req, res, next) => {
    let file;

    try {      
      file = req.body.file;       
      const dublicates = req.body.dublicates || []; 
      let tags = await utils.getSongTags(file);
      node.songTitleTest(tags.fullTitle);           
      let fileInfo = await utils.getFileInfo(file);
      let existent = await node.db.getMusicByPk(tags.fullTitle);
      let hasFile = false;
      
      HANDLE_MUSIC_DOCUMENT: if(existent) {
        if(typeof existent.fileHash != 'string' || !await node.hasFile(existent.fileHash)) {
          await node.db.deleteDocument(existent);
          existent = null;
          break HANDLE_MUSIC_DOCUMENT;
        }

        const filePath = node.getFilePath(existent.fileHash); 

        if(existent.title == tags.fullTitle || !await node.checkSongRelevance(existent.fileHash)) {  
          tags = utils.mergeSongTags(await utils.getSongTags(filePath), tags);
          file = await utils.setSongTags(file, tags);   
          fileInfo = await utils.getFileInfo(file);          

          if(existent.fileHash != fileInfo.hash) {
            await node.removeFileFromStorage(existent.fileHash);
            await node.db.deleteDocument(existent);
            existent = null;
          }   
          else {
            hasFile = true;
          }
          
          break HANDLE_MUSIC_DOCUMENT;
        }

        tags = utils.mergeSongTags(tags,await utils.getSongTags(filePath));
        await utils.setSongTags(filePath, tags);
        fileInfo = await utils.getFileInfo(filePath);

        if(fileInfo.hash != existent.fileHash) {
          await node.addFileToStorage(filePath, fileInfo.hash, { copy: true });
          await node.removeFileFromStorage(existent.fileHash);
          existent = null; 
        }
       
        hasFile = true;
      }

      await node.fileAvailabilityTest(fileInfo);      

      if(!existent) {
        await node.db.addDocument('music', { title: tags.fullTitle, fileHash: fileInfo.hash });    
      }
      else {
        await node.db.accessDocument(existent);
      }
      
      if(!hasFile) {
        await node.addFileToStorage(file, fileInfo.hash);
      }
      
      file.destroy();      
      const audioLink = await node.createSongAudioLink(fileInfo.hash);
      const coverLink = await node.createSongCoverLink(fileInfo.hash);
      
      if(dublicates.length) {
        file = fs.createReadStream(node.getFilePath(fileInfo.hash));        
        node.duplicateSong(dublicates, file, fileInfo)
        .then(() => {
          file.destroy();
        })
        .catch((err) => {
          file.destroy();
          node.logger.error(err.stack);
        });
      }

      res.send({ audioLink, coverLink, title: tags.fullTitle, tags: _.omit(tags, 'APIC') });
    }
    catch(err) {
      utils.isFileReadStream(file) && file.destroy();
      next(err);
    }    
  }
};