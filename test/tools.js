import toolsMetastocle from "metastocle/test/tools.js";
import toolsStoracle from "storacle/test/tools.js";

const _tools = Object.assign({}, toolsMetastocle, toolsStoracle);
const tools = Object.assign({}, _tools);

/**
 * Create the node options
 *
 * @async
 * @param {object} [options]
 * @returns {object}
 */
tools.createNodeOptions = async function (options = {}) {
    options = await _tools.createNodeOptions(options);
    options.storage.dataSize = '90%';
    options.storage.tempSize = '5%';
    options.file = { minSize: 0 };
    return options;
};
export default tools;
