const express = require('express');
const favicon = require('serve-favicon');
const path = require('path');

/**
 * Server index page handler
 */
module.exports.indexPage = () => {
  return (req, res) => res.sendFile(path.resolve(__dirname, '../../../browser/face/index.html'));
};

/**
 * Server favicon handler
 */
module.exports.favicon = () => {
  return favicon(path.resolve(__dirname, '../../../browser/face/favicon.png'));
};

/**
 * Server static handler
 */
module.exports.static = () => {
  return express.static(path.resolve(__dirname, '../../../../dist/face'));
};