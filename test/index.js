import fse from "fs-extra";
import path from "path";
import tools from "./tools.js";
import { createRequire } from 'node:module';

import utils from "./utils.js";
import node from "./node.js";
import client from "./client.js";
import services from "./services.js";
import routes from "./routes.js";
import group from "./group.js";

const require = createRequire(import.meta.url);

describe('museria', () => {
    before(async () => {
        await fse.ensureDir(tools.tmpPath);
        await fse.copy(require.resolve('./data/audio.mp3'), path.join(tools.tmpPath, 'audio.mp3'));
        await fse.copy(require.resolve('./data/cover.jpg'), path.join(tools.tmpPath, 'cover.jpg'));
    });
    after(() => fse.remove(tools.tmpPath));

    describe('utils', utils.bind(this));
    describe('node', node.bind(this));
    describe('client', client.bind(this));
    describe('services', services.bind(this));
    describe('routes', routes.bind(this));
    describe('group', group.bind(this));
});
