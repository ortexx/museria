import * as controllers from "./controllers.js";
import midds from "../midds.js";

export default [
  /**
   * Request the song
   *
   * @api {get} /client/request-song/
   * @apiParam {string} title
   * @apiParam {string} type
   */
  {
    name: 'requestSong',
    method: 'get',
    url: '/request-song',
    fn: [
      midds.requestQueueClient,
      controllers.requestSong
    ]
  },
  /**
   * Get the song info
   *
   * @api {post} /client/get-song-info
   * @apiParam {string} title - song title
   * @apiSuccess {object} - { info: [{...}] }
   */
  {
    name: 'getSongInfo',
    method: 'post',
    url: '/get-song-info',
    fn: [
      midds.requestQueueClient,
      controllers.getSongInfo
    ]
  },
  /**
   * Find songs
   *
   * @api {post} /client/find-songs
   * @apiParam {string} str
   * @apiSuccess {object} - { songs: [{...}] }
   */
  {
    name: 'findSongs',
    method: 'post',
    url: '/find-songs',
    fn: [
      midds.requestQueueClient,
      controllers.findSongs
    ]
  },
  /**
   * Find artist songs
   *
   * @api {post} /client/find-artist-songs
   * @apiParam {string} artist
   * @apiSuccess {object} - { songs: [{...}] }
   */
  {
    name: 'findArtistSongs',
    method: 'post',
    url: '/find-artist-songs',
    fn: [
      midds.requestQueueClient,
      controllers.findArtistSongs
    ]
  },
  /**
   * Get the song link
   *
   * @api {post} /client/get-song-link
   * @apiParam {string} title - song title
   * @apiParam {string} type - file type
   * @apiSuccess {object} - { link: '' }
   */
  {
    name: 'getSongLink',
    method: 'post',
    url: '/get-song-link',
    fn: [
      midds.requestQueueClient,
      controllers.getSongLink
    ]
  },
  /**
   * Add the song
   *
   * @api {post} /client/add-song/
   * @apiParam {fs.ReadStream|string} file
   * @apiSuccess {object} - { title: '', audioLink: '', coverLink: '', tags: {...} }
   */
  {
    name: 'addSong',
    method: 'post',
    url: '/add-song',
    fn: (node) => [
      midds.requestQueueClient(node, { limit: node.options.request.clientStoringConcurrency }),
      midds.filesFormData(node),
      controllers.addSong(node)
    ]
  },
  /**
   * Remove the song
   *
   * @api {post} /client/remove-song
   * @apiParam {string} title - song title
   * @apiSuccess {object} - { removed: 0 }
   */
  {
    name: 'removeSong',
    method: 'post',
    url: '/remove-song',
    fn: [
      midds.requestQueueClient,
      controllers.removeSong
    ]
  }
];
