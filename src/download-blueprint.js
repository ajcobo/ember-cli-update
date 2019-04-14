'use strict';

const co = require('co');
const path = require('path');
const fs = require('fs-extra');
const denodeify = require('denodeify');
const tmpDir = denodeify(require('tmp').dir);
const run = require('./run');

const downloadBlueprint = co.wrap(function* downloadBlueprint(blueprintName, blueprintLocation, range) {
  let blueprintUrl;
  if (blueprintLocation) {
    let blueprintPath = path.resolve(process.cwd(), blueprintLocation);
    if (yield fs.pathExists(blueprintPath)) {
      let posixBlueprintPath = blueprintPath.replace(/\\/g, '/').replace(/^(.+):/, function() {
        return arguments[1].toLowerCase();
      });
      if (!posixBlueprintPath.startsWith('/')) {
        posixBlueprintPath = `/${posixBlueprintPath}`;
      }
      blueprintUrl = `git+file://${posixBlueprintPath}`;
    } else {
      blueprintUrl = blueprintLocation;
    }
    blueprintUrl += `#semver:${range}`;
  } else {
    blueprintUrl = `${blueprintName}@${range}`;
  }
  let newTmpDir = yield tmpDir();
  run(`npm install ${blueprintUrl}`, { cwd: newTmpDir });
  let tmpBlueprintPath = path.join(newTmpDir, 'node_modules', blueprintName);
  return tmpBlueprintPath;
});

module.exports = downloadBlueprint;
