#!/usr/bin/env node

const runner = require('./runner');
const Node = require('../src').Node;
const actions = require('./actions');
runner('museria', Node, actions);