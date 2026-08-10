import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFile(path.join(root, file));

test('published community files match the pinned tooling release', async () => {
  const source = JSON.parse(await read('SOURCE.json'));
  assert.equal(source.repository, 'LasVegasForTransit/repository-tooling');
  assert.equal(source.ref, 'v0.1.0');

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

## [subheading if needed]

## [more subheadings if needed]

# Follow-ups

- [ ] Future issue title if needed
`,
  );
  assert.doesNotMatch(template, /<!--|metadata/i);
});
