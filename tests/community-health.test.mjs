import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
/** @param {string} file */
const read = (file) => readFile(path.join(root, file), 'utf8');

test('published community files match the pinned tooling release', async () => {
  const source = JSON.parse(await read('SOURCE.json'));
  assert.equal(source.repository, 'LasVegasForTransit/repository-tooling');
  assert.equal(source.ref, 'v0.2.7');
  assert.equal(source.commit, '6f34bbba529a8ee53badbe6a1696658a0e0411aa');

  for (const [file, expected] of Object.entries(source.files)) {
    const digest = createHash('sha256')
      .update(await read(file))
      .digest('hex');
    assert.equal(digest, expected, file);
  }
});

test('the pull request template contains only the readable organization outline', async () => {
  const template = (await read('.github/pull_request_template.md')).toString();
  assert.equal(
    template,
    `# TL;DR

# Overview of Changes

# Follow-ups
`,
  );
  assert.doesNotMatch(template, /<!--|metadata/i);
});

test('the community-health repository uses the organization toolchain', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const agents = await read('AGENTS.md');
  const workflow = await read('.github/workflows/ci.yml');
  const setup = await read('.github/actions/setup-node-pnpm/action.yml');

  assert.equal(packageJson.packageManager, 'pnpm@11.25.0');
  assert.equal(packageJson.engines.node, '^24.20.0');
  assert.equal(packageJson.scripts.bootstrap, 'lvbt bootstrap');
  assert.match(packageJson.scripts.check, /lvbt check/);
  await access(path.join(root, 'pnpm-lock.yaml'));
  assert.match(agents, /pnpm check/);
  assert.doesNotMatch(agents, /npm run check/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-node-pnpm/);
  assert.match(workflow, /run: pnpm check/);
  assert.match(setup, /pnpm\/action-setup@/);
  assert.match(setup, /pnpm install --frozen-lockfile/);
});
