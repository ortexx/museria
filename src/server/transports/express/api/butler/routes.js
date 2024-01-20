import * as controllers from "./controllers.js";
export default [
    /**
     * Remove the song
     *
     * @api {post} /api/butler/remove-song
     * @apiParam {string} title - song title
     */
    {
        name: 'removeSong',
        method: 'post',
        url: '/remove-song',
        fn: controllers.removeSong
    }
];
