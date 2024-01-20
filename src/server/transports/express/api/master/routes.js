import * as controllers from "./controllers.js";
export default [
    /**
     * Remove the song
     *
     * @api {post} /api/master/remove-song
     * @apiParam {string} title - song title
     */
    {
        name: 'removeSong',
        method: 'post',
        url: '/remove-song',
        fn: controllers.removeSong
    }
];
