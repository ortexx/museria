import path from "path";
import _ from "lodash";
import stWebpackConfig from "storacle-ms/webpack.client.js";
import mtWebpackConfig from "metastocle-ms/webpack.client.js";

const __dirname = new URL('.', import.meta.url).pathname;

export default (options = {}, wp) => {
    options = _.merge({
        include: [],
        mock: {
            'music-metadata': true,
            'base64url': true
        }
    }, options);
    options.include.push([path.resolve(__dirname, 'src/browser/client')]);
    return wp ? mtWebpackConfig(stWebpackConfig(options), wp) : options;
};
