'use strict';

const co = require('co');
const _getTagVersion = require('boilerplate-update/src/get-tag-version');
const run = require('./run');
const downloadBlueprint = require('./download-blueprint');

module.exports = function getTagVersion(versions, packageName, blueprintLocation) {
  return co.wrap(function* getTagVersion(range) {
    if (blueprintLocation) {
      let blueprintPath = yield downloadBlueprint(packageName, blueprintLocation, range);
      let result = run('npm version', { cwd: blueprintPath });
      return eval(`(${result})`)[packageName];
    }
    return yield _getTagVersion({
      range,
      versions,
      packageName,
      distTags: [
        'latest',
        'beta'
      ]
    });
  });
};
