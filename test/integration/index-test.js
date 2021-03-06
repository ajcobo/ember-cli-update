'use strict';

const path = require('path');
const { describe, it } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const sinon = require('sinon');
const co = require('co');
const {
  buildTmp,
  processExit,
  fixtureCompare: _fixtureCompare
} = require('git-fixtures');
const { isGitClean } = require('git-diff-apply');
const emberCliUpdate = require('../../src');
const utils = require('boilerplate-update/src/utils');
const {
  assertNoUnstaged,
  assertNoStaged
} = require('../helpers/assertions');

describe(function() {
  this.timeout(30 * 1000);

  let cwd;
  let sandbox;
  let tmpPath;

  before(function() {
    cwd = process.cwd();
  });

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();

    process.chdir(cwd);
  });

  let merge = co.wrap(function* merge({
    fixturesPath,
    dirty,
    from,
    to = '3.2.0-beta.1',
    reset,
    compareOnly,
    statsOnly,
    runCodemods,
    listCodemods,
    createCustomDiff,
    commitMessage
  }) {
    tmpPath = yield buildTmp({
      fixturesPath,
      commitMessage,
      dirty
    });

    process.chdir(tmpPath);

    let promise = emberCliUpdate({
      from,
      to,
      reset,
      compareOnly,
      statsOnly,
      runCodemods,
      listCodemods,
      createCustomDiff
    });

    return processExit({
      promise,
      cwd: tmpPath,
      commitMessage,
      expect
    });
  });

  function fixtureCompare({
    mergeFixtures
  }) {
    let actual = tmpPath;
    let expected = path.join(cwd, mergeFixtures);

    _fixtureCompare({
      expect,
      actual,
      expected
    });
  }

  it('handles dirty', function() {
    return merge({
      fixturesPath: 'test/fixtures/app/local',
      commitMessage: 'my-app',
      dirty: true
    }).then(({
      status,
      stderr
    }) => {
      expect(status).to.equal(`?? a-random-new-file
`);

      expect(stderr).to.contain('You must start with a clean working directory');
      expect(stderr).to.not.contain('UnhandledPromiseRejectionWarning');
    });
  });

  it('handles non-ember-cli app', function() {
    return merge({
      fixturesPath: 'test/fixtures/package-json/non-ember-cli',
      commitMessage: 'my-app'
    }).then(({
      stderr
    }) => {
      expect(isGitClean({ cwd: tmpPath })).to.be.ok;

      expect(stderr).to.contain('Ember CLI project type could not be determined');
    });
  });

  it('handles non-npm dir', function() {
    return merge({
      fixturesPath: 'test/fixtures/package-json/missing',
      commitMessage: 'my-app'
    }).then(({
      stderr
    }) => {
      expect(isGitClean({ cwd: tmpPath })).to.be.ok;

      expect(stderr).to.contain('No package.json was found in this directory');
    });
  });

  it('handles malformed package.json', function() {
    return merge({
      fixturesPath: 'test/fixtures/package-json/malformed',
      commitMessage: 'my-app'
    }).then(({
      stderr
    }) => {
      expect(isGitClean({ cwd: tmpPath })).to.be.ok;

      expect(stderr).to.contain('The package.json is malformed');
    });
  });

  it('updates glimmer app', function() {
    return merge({
      fixturesPath: 'test/fixtures/glimmer/local',
      commitMessage: 'glimmer-app',
      from: '0.5.0',
      to: '0.6.1'
    }).then(({
      status
    }) => {
      fixtureCompare({
        mergeFixtures: 'test/fixtures/glimmer/merge/glimmer-app'
      });

      expect(status).to.match(/^M {2}src\/index\.ts$/m);

      assertNoUnstaged(status);
    });
  });

  it('needs --from if glimmer app before 0.6.3', function() {
    return merge({
      fixturesPath: 'test/fixtures/glimmer/local',
      commitMessage: 'glimmer-app',
      to: '0.6.1'
    }).then(({
      stderr
    }) => {
      expect(isGitClean({ cwd: tmpPath })).to.be.ok;

      expect(stderr).to.contain('version cannot be determined');
    });
  });

  it('resets app', function() {
    return merge({
      fixturesPath: 'test/fixtures/app/local',
      commitMessage: 'my-app',
      reset: true
    }).then(({
      status
    }) => {
      fixtureCompare({
        mergeFixtures: 'test/fixtures/app/reset/my-app'
      });

      expect(status).to.match(/^ D app\/controllers\/application\.js$/m);

      assertNoStaged(status);
    });
  });

  it('opens compare url', function() {
    let opn = sandbox.stub(utils, 'opn');

    return merge({
      fixturesPath: 'test/fixtures/app/local',
      commitMessage: 'my-app',
      compareOnly: true
    }).then(({
      result,
      status
    }) => {
      assertNoUnstaged(status);

      expect(result, 'don\'t accidentally print anything to the console').to.be.undefined;

      expect(opn.calledOnce).to.be.ok;
      expect(opn.args[0][0]).to.equal('https://github.com/ember-cli/ember-new-output/compare/v2.11.1...v3.2.0-beta.1');
    });
  });

  it('resolves semver ranges', function() {
    return merge({
      fixturesPath: 'test/fixtures/app/local',
      commitMessage: 'my-app',
      from: '1.13',
      to: '^2',
      statsOnly: true
    }).then(({
      result
    }) => {
      expect(result).to.equal(`project options: app, welcome
from version: 1.13.15
to version: 2.18.2
output repo: https://github.com/ember-cli/ember-new-output
applicable codemods: `);
    });
  });

  it('shows stats only', function() {
    return merge({
      fixturesPath: 'test/fixtures/app/merge',
      commitMessage: 'my-app',
      to: '3.3.0',
      statsOnly: true
    }).then(({
      result,
      status
    }) => {
      assertNoStaged(status);

      expect(result).to.equal(`project options: app, welcome
from version: 3.2.0-beta.1
to version: 3.3.0
output repo: https://github.com/ember-cli/ember-new-output
applicable codemods: ember-modules-codemod, ember-qunit-codemod, ember-test-helpers-codemod, es5-getter-ember-codemod, qunit-dom-codemod`);
    });
  });

  it('lists codemods', function() {
    return merge({
      fixturesPath: 'test/fixtures/app/local',
      commitMessage: 'my-app',
      listCodemods: true
    }).then(({
      result,
      status
    }) => {
      assertNoStaged(status);

      expect(JSON.parse(result)).to.have.own.property('ember-modules-codemod');
    });
  });

  it('can create a personal diff instead of using an output repo', function() {
    this.timeout(2 * 60 * 1000);

    return merge({
      fixturesPath: 'test/fixtures/custom/local',
      commitMessage: 'my-custom-app',
      createCustomDiff: true
    }).then(({
      status
    }) => {
      fixtureCompare({
        mergeFixtures: 'test/fixtures/custom/merge/my-custom-app'
      });

      assertNoUnstaged(status);
    });
  });
});
