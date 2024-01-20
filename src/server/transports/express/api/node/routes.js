import * as controllers from "./controllers.js";
import midds from "../../midds.js";
export default [
    /**
     * Add the song
     *
     * @api {post} /api/node/add-song/
     * @apiParam {fse.ReadStream|string} file
     */
    {
        name: 'addSong',
        method: 'post',
        url: '/add-song',
        fn: [
            midds.requestQueueSong,
            midds.filesFormData,
            midds.songAdditionControl,
            midds.prepareFileToStore,
            controllers.addSong
        ]
    }
];
