const utils = require('../../../../../utils');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const _ = require('lodash');

/**
 * Add the song
 */
module.exports.addSong = node => {  
  return async (req, res, next) => {
    let file;
    let dupFile;
    let dupFileInfo;
    let filePath = '';    

    const cleanUp = async () => {
      utils.isFileReadStream(file) && file.destroy();

      if(!filePath) {
        return;
      }

      try {
        await fse.remove(filePath);
      }
      catch(err) {
        if(err.code != 'ENOENT') {
          throw err;
        }
      }
    };

    const cleanUpDuplicate = async () => {
      if(!dupFile) {
        return;
      }

      dupFile.destroy();      

      try {
        await fse.remove(dupFile.path);
      }
      catch(err) {
        if(err.code != 'ENOENT') {
          throw err;
        }
      }

      dupFile = null;
    };

    try {      
      file = req.body.file;
      filePath = file.path;   
      const dublicates = req.body.dublicates || [];
      const controlled = !!req.body.controlled;
      const priority = parseInt(req.body.priority || 0);
      node.songPriorityTest({ priority, controlled });
      let tags = await utils.getSongTags(file);
      node.songTitleTest(tags.fullTitle);           
      let fileInfo = await utils.getFileInfo(file);
      dupFileInfo = fileInfo;
      await node.fileAvailabilityTest(fileInfo);
      let existent = await node.db.getMusicByPk(tags.fullTitle);      
      let fileHashToRemove = '';
      
      HANDLE_MUSIC_DOCUMENT: if(existent) {
        if(typeof existent.fileHash != 'string' || !await node.hasFile(existent.fileHash)) {
          await node.db.deleteDocument(existent);
          existent = null;
          break HANDLE_MUSIC_DOCUMENT;
        }

        existent = Object.assign({}, existent);
        let currentFilePath = node.getFilePath(existent.fileHash);
        let newFilePath = file.path;
        const currentPriority = existent.priority || 0;
        
        if(
          controlled ||
          priority > currentPriority || 
          (priority == currentPriority && !await node.checkSongRelevance(currentFilePath, newFilePath))
        ) {  
          filePath = newFilePath;
          tags = utils.mergeSongTags(await utils.getSongTags(currentFilePath), tags);
        }
        else {
          filePath = path.join(node.tempPath, crypto.randomBytes(22).toString('hex'));
          await fse.copy(currentFilePath, filePath);
          tags = utils.mergeSongTags(tags, await utils.getSongTags(filePath));
        }

        filePath = await utils.setSongTags(filePath, tags);
        fileInfo = await utils.getFileInfo(filePath); 
        await node.fileAvailabilityTest(fileInfo); 
        existent.title = tags.fullTitle;
        existent.priority = priority;

        if(existent.fileHash != fileInfo.hash) {
          fileHashToRemove = existent.fileHash;
          existent.fileHash = fileInfo.hash; 
        }   
        else {
          filePath = '';
        }
      }
      
      if(filePath) {
        await node.addFileToStorage(filePath, fileInfo.hash, { copy: true });
      }

      if(!existent) {
        await node.db.addDocument('music', { 
          title: tags.fullTitle,
          fileHash: fileInfo.hash,
          priority
        });
      }
      else {
        await node.db.updateDocument(existent);
      }

      if(fileHashToRemove) {
        await node.removeFileFromStorage(fileHashToRemove);
      }
      
      const audioLink = await node.createSongAudioLink(fileInfo.hash);
      const coverLink = await node.createSongCoverLink(fileInfo.hash);      
      
      if(dublicates.length) {       
        const dupPath = path.join(node.tempPath, crypto.randomBytes(21).toString('hex'));
        await fse.copy(file.path, dupPath);
        dupFile = await fs.createReadStream(dupPath);     
        node.duplicateSong(dublicates, dupFile, dupFileInfo, { controlled, priority })
        .then(cleanUpDuplicate)
        .catch(err => {          
          node.logger.error(err.stack);
          return cleanUpDuplicate();
        })
        .catch(err => {
          node.logger.error(err.stack);
        });
      }

      await cleanUp();
      res.send({ audioLink, coverLink, title: tags.fullTitle, tags: _.omit(tags, 'APIC') });
    }
    catch(err) {
      await cleanUp();      
      next(err);
    }    
  }
};