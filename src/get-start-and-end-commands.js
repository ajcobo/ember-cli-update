'use strict';

const co = require('co');
const path = require('path');
const utils = require('./utils');
const downloadBlueprint = require('./download-blueprint');

module.exports = function getStartAndEndCommands({
  packageJson: { name: projectName },
  projectOptions,
  startVersion,
  endVersion,
  blueprint
}) {
  let options = '-sn -sg';

  if (projectOptions.includes('yarn')) {
    options += ' --yarn';
  }

  if (!projectOptions.includes('welcome')) {
    options += ' --no-welcome';
  }

  let command;
  if (projectOptions.includes('app') || projectOptions.includes('blueprint')) {
    command = `new ${projectName} ${options}`;
  } else if (projectOptions.includes('addon')) {
    command = `addon ${projectName} ${options}`;
  } else if (projectOptions.includes('glimmer')) {
    // ember-cli doesn't have a way to use non-latest blueprint versions
    throw 'cannot checkout older versions of glimmer blueprint';
  }

  return {
    projectName,
    projectOptions,
    packageName: 'ember-cli',
    commandName: 'ember',
    blueprint,
    // `createProjectFromCache` no longer works with blueprints.
    // It will look for an `ember-cli` version with the same
    // version as the blueprint.
    createProjectFromCache: createProjectFromCache(command),
    createProjectFromRemote: createProjectFromRemote(command),
    startOptions: {
      packageVersion: startVersion
    },
    endOptions: {
      packageVersion: endVersion
    }
  };
};

function createProjectFromCache(command) {
  return function createProjectFromCache({
    packageRoot,
    options
  }) {
    return function createProject(cwd) {
      return utils.spawn('node', [
        path.join(packageRoot, 'bin/ember'),
        ...command.split(' ')
      ], {
        cwd
      }).then(() => {
        return postCreateProject({
          cwd,
          options
        });
      });
    };
  };
}

function createProjectFromRemote(command) {
  return function createProjectFromRemote({
    options
  }) {
    return co.wrap(function* createProject(cwd) {
      let npxCommand;
      if (options.blueprint) {
        let blueprintName = options.blueprint.name;
        let blueprintLocation = options.blueprint.location;

        let blueprintPath = yield downloadBlueprint(blueprintName, blueprintLocation, options.packageVersion);

        npxCommand = `ember-cli ${command} -b ${blueprintPath}`;
        // npxCommand = `-p github:ember-cli/ember-cli#cfb9780 ember ${command} -b ${blueprintName}@${options.packageVersion}`;
      } else {
        npxCommand = `-p ember-cli@${options.packageVersion} ember ${command}`;
      }

      yield utils.npx(npxCommand, { cwd });

      return yield postCreateProject({
        cwd,
        options
      });
    });
  };
}

function postCreateProject({
  cwd,
  options: {
    projectName
  }
}) {
  return Promise.resolve(path.join(cwd, projectName));
}
