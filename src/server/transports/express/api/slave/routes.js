import * as controllers from "./controllers.js";
import midds from "../../midds.js";

export default [
  /**
   * Remove the song
   *
   * @api {post} /api/slave/remove-song
   * @apiParam {string} title - song title
   */
  {
    name: 'removeSong',
    method: 'post',
    url: '/remove-song',
    fn: [
      midds.requestQueueSong,
      midds.songRemovalControl,
      controllers.removeSong
    ]
  }
];
