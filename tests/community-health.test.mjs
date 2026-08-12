import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFile(path.join(root, file));

test('published community files match the pinned tooling release', async () => {
  const source = JSON.parse(await read('SOURCE.json'));
  assert.equal(source.repository, 'LasVegasForTransit/repository-tooling');
  assert.equal(source.ref, 'v0.1.3');
  assert.equal(source.commit, 'd74383bc14738153114aa0b00f5278470da3fc26');

  for (const [file, expected] of Object.entries(source.files)) {
    const digest = createHash('sha256').update(await read(file)).digest('hex');
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

test('the published-template repository uses TransitMapper’s pnpm contract', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const agents = (await read('AGENTS.md')).toString();
  const workflow = (await read('.github/workflows/ci.yml')).toString();
  const setup = (await read('.github/actions/setup-node-pnpm/action.yml')).toString();

  assert.equal(packageJson.packageManager, 'pnpm@11.15.1');
  assert.equal(packageJson.scripts.check, 'node --test --test-concurrency=1');
  await access(path.join(root, 'pnpm-lock.yaml'));
  assert.match(agents, /pnpm check/);
  assert.doesNotMatch(agents, /npm run check/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-node-pnpm/);
  assert.match(workflow, /run: pnpm check/);
  assert.match(setup, /pnpm\/action-setup@/);
  assert.match(setup, /pnpm install --frozen-lockfile/);
});
