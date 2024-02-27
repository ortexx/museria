import * as express from "express";
import faviconLib from "serve-favicon";
import path from "path";

const __dirname = new URL('.', import.meta.url).pathname;
const favicon = () => faviconLib(path.resolve(__dirname, '../../../browser/face/favicon.png'));
const stat = () => express.static(path.resolve(__dirname, '../../../../dist/face'));

export const indexPage = () => {
  return (req, res) => res.sendFile(path.resolve(__dirname, '../../../browser/face/index.html'));
};
export { favicon };
export { stat as static };
