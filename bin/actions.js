import chalk from "chalk";
import yargs from "yargs";
import srcUtils from "../src/utils.js";
import utils from "./utils.js";
import mtActions from "metastocle/bin/actions.js";
import stActions from "storacle/bin/actions.js";

const argv = yargs(process.argv).argv;
const actions = Object.assign({}, mtActions, stActions);

/**
 * Clean up the music
 */
actions.cleanUpMusic = async (node) => {
  await node.cleanUpMusic();
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('The music has been cleaned up'));
};

/**
 * Export all songs to another node
 */
actions.exportSongs = async (node) => {
  await node.exportSongs(argv.address || argv.n);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('The songs have been exported'));
};

/**
 * Add the song
 */
actions.addSong = async (node) => {
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const result = await node.addSong(filePath);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${result.title}" has been added`));
};

/**
 * Get the song audio link
 */
actions.getSongAudioLink = async (node) => {
  const title = argv.title || argv.t;
  const link = await node.getSongAudioLink(title);
  if (!link) {
      throw new Error(`There is no song with the title ${title}`);
  }
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song audio link is "${link}"`));
};

/**
 * Get the song cover link
 */
actions.getSongCoverLink = async (node) => {
  const title = argv.title || argv.t;
  const link = await node.getSongCoverLink(title);

  if (!link) {
    throw new Error(`There is no song with the title ${title}`);
  }

  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song cover link is "${link}"`));
};

/**
 * Get the song audio to the path
 */
actions.getSongAudioToPath = async (node) => {
  const title = argv.title || argv.t;
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const link = await node.getSongAudioLink(title);
  
  if (!link) {
    throw new Error(`There is no song with the title ${title}`);  
  }

  await srcUtils.fetchFileToPath(filePath, link, node.createDefaultRequestOptions());
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${title}" has been saved to "${filePath}"`));
};

/**
 * Get the song cover to the path
 */
actions.getSongCoverToPath = async (node) => {
  const title = argv.title || argv.t;
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const link = await node.getSongCoverLink(title);

  if (!link) {
      throw new Error(`There is no song with the title ${title}`);
  }
  
  await srcUtils.fetchFileToPath(filePath, link, node.createDefaultRequestOptions());
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${title}" has been saved to "${filePath}"`));
};

/**
 * Remove the song
 */
actions.removeSong = async (node) => {
  const title = argv.title || argv.t;
  await node.removeSong(title);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The song "${title}" has been removed`));
};

export default actions;
