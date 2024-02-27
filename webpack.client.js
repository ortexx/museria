import path from "path";
import merge from "lodash-es/merge.js";
import stWebpackConfig from "storacle/webpack.client.js";
import mtWebpackConfig from "metastocle/webpack.client.js";

const __dirname = new URL('.', import.meta.url).pathname;

export default (options = {}, wp) => {
  options = merge({
    include: [],
    mock: {
      'music-metadata': true,
      'base64url': true
    }
  }, options);
  options.include.push([path.resolve(__dirname, 'src/browser/client')]);
  return wp? mtWebpackConfig(stWebpackConfig(options), wp): options;
};
