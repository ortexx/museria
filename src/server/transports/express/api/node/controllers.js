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
      await node.fileAvailabilityTest(fileInfo);
      let existent = await node.db.getMusicByPk(tags.fullTitle);
      let filePathToSave = file.path;
      let fileHashToRemove = '';
      
      HANDLE_MUSIC_DOCUMENT: if(existent) {
        if(typeof existent.fileHash != 'string' || !await node.hasFile(existent.fileHash)) {
          await node.db.deleteDocument(existent);
          existent = null;
          break HANDLE_MUSIC_DOCUMENT;
        }

        let currentFilePath = node.getFilePath(existent.fileHash);
        let newFilePath = file.path;

        if(!await node.checkSongRelevance(currentFilePath, newFilePath)) {  
          filePathToSave = newFilePath;
          tags = utils.mergeSongTags(await utils.getSongTags(currentFilePath), tags);          
        }
        else {
          filePathToSave = currentFilePath; 
          tags = utils.mergeSongTags(tags, await utils.getSongTags(filePathToSave));          
        }

        filePathToSave = await utils.setSongTags(filePathToSave, tags);   
        fileInfo = await utils.getFileInfo(filePathToSave); 
        await node.fileAvailabilityTest(fileInfo); 
       
        if(existent.fileHash != fileInfo.hash) {
          fileHashToRemove = existent.fileHash;
          existent.fileHash = fileInfo.hash; 
        }   
        else {
          filePathToSave = null;
        }
      }

      if(!existent) {
        await node.db.addDocument('music', { title: tags.fullTitle, fileHash: fileInfo.hash });    
      }
      else {
        await node.db.updateDocument(existent);
      }
      
      if(filePathToSave) {
        await node.addFileToStorage(filePathToSave, fileInfo.hash, { copy: true });
      }

      if(fileHashToRemove) {
        await node.removeFileFromStorage(fileHashToRemove);
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