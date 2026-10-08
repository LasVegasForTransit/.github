import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
/** @param {string} file */
const read = (file) => readFile(path.join(root, file), 'utf8');

test('published community files match the pinned tooling release', async () => {
  const source = JSON.parse(await read('SOURCE.json'));
  assert.equal(source.repository, 'LasVegasForTransit/repository-tooling');
  const standard = JSON.parse(await read('.lvbt/web-platform.json'));
  assert.equal(source.ref, standard.release);
  assert.equal(source.commit, standard.commit);
  assert.ok(source.files['CONTRIBUTING.md']);

  for (const [file, expected] of Object.entries(source.files)) {
    const digest = createHash('sha256')
      .update(await read(file))
      .digest('hex');
    assert.equal(digest, expected, file);
  }
});

test('the real required graph includes uncached shared security checks at the existing CI threshold', async () => {
  /** @type {{tasks: Array<{taskId: string, command: string, dependencies: string[], resolvedTaskDefinition: {cache: boolean}}>}} */
  const graph = JSON.parse(
    execFileSync(
      'pnpm',
      ['exec', 'turbo', 'run', 'lint', 'check-types', 'test', 'validate', '--dry=json'],
      {
        cwd: root,
        encoding: 'utf8',
      },
    ),
  );
  const validation = graph.tasks.find(({ taskId }) => taskId === '//#test');
  for (const [name, command] of [
    ['security:secrets', 'lvbt check secrets'],
    ['security:dependencies', 'pnpm audit --audit-level=high'],
  ]) {
    const task = graph.tasks.find(({ taskId }) => taskId === `//#${name}`);
    assert.equal(task?.command, command);
    assert.equal(task?.resolvedTaskDefinition.cache, false);
    assert.ok(validation?.dependencies.includes(`//#${name}`));
  }
  const workflow = await read('.github/workflows/ci.yml');
  assert.match(workflow, /fetch-depth: 0/);
  assert.doesNotMatch(
    workflow,
    /run: pnpm audit|docker run|name: Secret scan|name: Dependency audit/,
  );
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
  assert.equal(
    packageJson.scripts.bootstrap,
    'node .lvbt/web-platform/packages/cli/src/cli.mjs bootstrap',
  );
  assert.equal(
    packageJson.scripts['standards:update'],
    'node .lvbt/web-platform/standards/web-platform-cli.ts update',
  );
  assert.equal(
    packageJson.scripts['standards:check'],
    'node .lvbt/web-platform/standards/web-platform-cli.ts check',
  );
  assert.equal(
    packageJson.scripts.check,
    'pnpm format:check && markdownlint-cli2 && lvbt check && turbo run lint check-types test validate',
  );
  assert.match(packageJson.scripts.check, /lvbt check/);
  assert.equal(
    packageJson.devDependencies['@lasvegasfortransit/cli'],
    'file:.lvbt/web-platform/packages/cli',
  );
  await access(path.join(root, 'pnpm-lock.yaml'));
  assert.match(agents, /pnpm check/);
  assert.doesNotMatch(agents, /npm run check/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-node-pnpm/);
  assert.match(workflow, /run: pnpm check/);
  assert.match(setup, /pnpm\/action-setup@/);
  assert.match(setup, /pnpm install --frozen-lockfile/);
});
