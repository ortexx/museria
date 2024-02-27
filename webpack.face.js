import path from "path";
import merge from "lodash-es/merge.js";
import spWebpackConfig from "spreadable/webpack.common.js";

const __dirname = new URL('.', import.meta.url).pathname;

export default (options = {}, wp) => {
  options = merge({
    name: 'face',
    include: []
  }, options);
  options.include.push([
    path.resolve(__dirname, 'src/browser/face'),
    path.resolve(__dirname, 'node_modules/akili')
  ]);
  return wp? spWebpackConfig(options, wp): options;
};
