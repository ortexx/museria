#!/usr/bin/env node

const runner = require('./runner');
const Node = require('../src').Node;
const actions = Object.assign({}, require('metastocle/bin/actions'), require('storacle/bin/actions'), require('./actions'));
runner('museria', Node, actions);