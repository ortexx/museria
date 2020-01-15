const chalk = require('chalk');
const argv = require('optimist').argv;
const fetch = require('node-fetch');
const fs = require('fs');
const utils = require('./utils');

/**
 * Clean up the music
 */
module.exports.cleanUpMusic = async node => {
  await node.cleanUpMusic();
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('The music has been cleaned up'));
};

/**
 * Export songs to another node
 */
module.exports.exportSongs = async node => {
  await node.exportSongs(argv.address || argv.n);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('The songs have been exported'));
};

/**
 * Add the song
 */
module.exports.addSong = async node => {
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const result = await node.addSong(filePath);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${ result.title }" has been added`));
};

/**
 * Get the song audio link
 */
module.exports.getSongAudioLink = async node => {
  const title = argv.t || argv.title;
  const link = await node.getSongAudioLink(title);

  if(!link) {
    throw new Error(`There is no song with the title ${title}`);
  }

  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song audio link is "${link}"`));
};

/**
 * Get the song cover link
 */
module.exports.getSongCoverLink = async node => {
  const title = argv.t || argv.title;
  const link = await node.getSongCoverLink(title);

  if(!link) {
    throw new Error(`There is no song with the title ${title}`);
  }

  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song cover link is "${link}"`));
};

/**
 * Get the song audio to the path
 */
module.exports.getSongAudioToPath = async node => {
  const title = argv.title || argv.t;
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const link = await node.getSongAudioLink(title);

  if(!link) {
    throw new Error(`There is no song with the title ${title}`);
  }

  await new Promise(async (resolve, reject) => {
    try { 
      (await fetch(link, node.createDefaultRequestOptions({ method: 'GET' }))).body
      .on('error', reject)
      .pipe(fs.createWriteStream(filePath))
      .on('error', reject)
      .on('finish', resolve);
    }   
    catch(err) {
      reject(err);
    }  
  });

  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${title}" has been saved to "${filePath}"`));
};

/**
 * Get the song cover to the path
 */
module.exports.getSongCoverToPath = async node => {
  const title = argv.title || argv.t;
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const link = await node.getSongCoverLink(title);

  if(!link) {
    throw new Error(`There is no song with the title ${title}`);
  }

  await new Promise(async (resolve, reject) => {
    try { 
      (await fetch(link, node.createDefaultRequestOptions({ method: 'GET' }))).body
      .on('error', reject)
      .pipe(fs.createWriteStream(filePath))
      .on('error', reject)
      .on('finish', resolve);
    }   
    catch(err) {
      reject(err);
    }  
  });

  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${title}" has been saved to "${filePath}"`));
};

/**
 * Remove the song
 */
module.exports.removeSong = async node => {
  const title = argv.title || argv.t;
  await node.removeSong(title);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${title}" has been removed`));
};