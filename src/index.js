'use strict';

const co = require('co');
const fs = require('fs-extra');
const utils = require('./utils');
const run = require('./run');
const getProjectOptions = require('./get-project-options');
const getPackageName = require('./get-package-name');
const getPackageVersion = require('./get-package-version');
const getProjectVersion = require('./get-project-version');
const _getTagVersion = require('./get-tag-version');
const getRemoteUrl = require('./get-remote-url');
const boilerplateUpdate = require('boilerplate-update');
const getStartAndEndCommands = require('./get-start-and-end-commands');

module.exports = co.wrap(function* emberCliUpdate({
  from,
  to,
  resolveConflicts,
  runCodemods,
  reset,
  compareOnly,
  statsOnly,
  listCodemods,
  createCustomDiff,
  wasRunAsExecutable
}) {
  let blueprint;
  try {
    let dotEmberCliFile = yield fs.readJson('.ember-cli');
    if (dotEmberCliFile['ember-cli-update']) {
      blueprint = dotEmberCliFile['ember-cli-update'].blueprints[0];
    }
  } catch (err) {
    // do nothing
  }

  if (blueprint) {
    createCustomDiff = true;
  }

  let endVersion;

  let result = yield (yield boilerplateUpdate({
    projectOptions: ({ packageJson }) => getProjectOptions(packageJson, blueprint),
    mergeOptions: co.wrap(function* mergeOptions({
      packageJson,
      projectOptions
    }) {
      let packageName;
      let packageVersion;
      let versions;
      let blueprintLocation;

      if (blueprint) {
        packageName = blueprint.name;
        blueprintLocation = blueprint.location;
        packageVersion = blueprint.version;
      } else {
        packageName = getPackageName(projectOptions);
        packageVersion = getPackageVersion(packageJson, packageName);
      }

      if (!blueprintLocation) {
        versions = yield utils.getVersions(packageName);
      }

      let getTagVersion = _getTagVersion(versions, packageName, blueprintLocation);

      let startVersion;
      if (from) {
        startVersion = yield getTagVersion(from);
      } else if (blueprint) {
        startVersion = packageVersion;
      } else {
        startVersion = getProjectVersion(packageVersion, versions, projectOptions);
      }

      endVersion = yield getTagVersion(to);

      let customDiffOptions;
      if (createCustomDiff) {
        customDiffOptions = getStartAndEndCommands({
          packageJson,
          projectOptions,
          startVersion,
          endVersion,
          blueprint
        });
      }

      return {
        startVersion,
        endVersion,
        customDiffOptions
      };
    }),
    remoteUrl: ({ projectOptions }) => getRemoteUrl(projectOptions),
    compareOnly,
    resolveConflicts,
    reset,
    statsOnly,
    listCodemods,
    runCodemods,
    codemodsUrl: 'https://raw.githubusercontent.com/ember-cli/ember-cli-update-codemods-manifest/v3/manifest.json',
    createCustomDiff,
    wasRunAsExecutable
  })).promise;

  if (blueprint) {
    let dotEmberCliFile = yield fs.readJson('.ember-cli');
    blueprint = dotEmberCliFile['ember-cli-update'].blueprints[0];

    if (blueprint.version !== endVersion) {
      blueprint.version = endVersion;
      yield fs.writeJSON('.ember-cli', dotEmberCliFile, {
        spaces: 2,
        EOL: require('os').EOL
      });
      run('git add .ember-cli');
    }
  }

  return result;
});
