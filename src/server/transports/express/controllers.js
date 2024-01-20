import * as express from "express";
import favicon from "serve-favicon";
import path from "path";

const __dirname = new URL('.', import.meta.url).pathname;

export const indexPage = () => {
    return (req, res) => res.sendFile(path.resolve(__dirname, '../../../browser/face/index.html'));
};
const favicon$0 = () => {
    return favicon(path.resolve(__dirname, '../../../browser/face/favicon.png'));
};
const static$0 = () => {
    return express.static(path.resolve(__dirname, '../../../../dist/face'));
};
export { favicon$0 as favicon };
export { static$0 as static };
