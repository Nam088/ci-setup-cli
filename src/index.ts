#!/usr/bin/env node
/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import * as shell from 'shelljs';

const program = new Command();

program
    .version('1.0.0')
    .description('Setup Semantic Release CI/CD for your project')
    .option('-o, --owner <owner>', 'GitHub Owner/Organization')
    .option('-r, --repo <name>', 'Repository Name')
    .option('--no-deps', 'Skip dependency installation')
    .action(async (options) => {
        console.log(chalk.blue('🚀 Starting CI/CD Setup...'));

        // Check if git is initialized
        if (!shell.which('git')) {
            console.warn(chalk.yellow('Warning: git is not installed. some automatic detection might fail.'));
        }

        const questions = [];
        if (!options.owner) {
            questions.push({
                name: 'repoOwner',
                type: 'input',
                message: 'What is your GitHub username/organization?',
                validate: (input: string) => input.length > 0,
            });
        }

        if (!options.repo) {
            questions.push({
                name: 'repoName',
                type: 'input',
                default: path.basename(process.cwd()),
                message: 'What is your repository name?',
                validate: (input: string) => input.length > 0,
            });
        }

        if (options.deps === undefined) {
             questions.push({
                name: 'installDeps',
                type: 'confirm',
                default: true,
                message: 'Do you want to install semantic-release dependencies now?',
            });
        }

        const answers = await inquirer.prompt(questions);
        
        // Merge options and answers
        const repoOwner = options.owner || answers.repoOwner;
        const repoName = options.repo || answers.repoName;
        const installDeps = options.deps !== false && (options.deps || answers.installDeps);

        // 1. Install Dependencies
        if (installDeps) {
            console.log(chalk.yellow('\nInstalling dependencies...'));
            shell.exec(
                'npm install -D semantic-release @semantic-release/changelog @semantic-release/git @semantic-release/github @semantic-release/npm',
            );
        }

        // 2. Create .releaserc.json
        console.log(chalk.yellow('\nCreating .releaserc.json...'));
        const releasercConfig = {
            branches: ['main', { name: 'beta', prerelease: true }, { name: 'develop', prerelease: 'dev' }],
            plugins: [
                '@semantic-release/commit-analyzer',
                '@semantic-release/release-notes-generator',
                ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
                '@semantic-release/npm',
                [
                    '@semantic-release/git',
                    {
                        assets: ['package.json', 'CHANGELOG.md'],
                        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
                    },
                ],
                '@semantic-release/github',
            ],
        };

        fs.writeFileSync('.releaserc.json', JSON.stringify(releasercConfig, null, 2));

        // 3. Create Workflow
        console.log(chalk.yellow('\nCreating .github/workflows/release.yml...'));
        const workflowDir = '.github/workflows';

        if (!fs.existsSync(workflowDir)) {
            shell.mkdir('-p', workflowDir);
        }

        const workflowContent = `name: Release

on:
  push:
    branches:
      - main
      - beta
      - develop
    paths-ignore:
      - '**.md'
      - '.gitignore'

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm run test --if-present

      - name: Build
        run: npm run build --if-present

  release:
    name: Release
    needs: test
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/beta' || github.ref == 'refs/heads/develop')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install Dependencies
        run: npm ci

      - name: Build
        run: npm run build --if-present

      - name: Semantic Release
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: npx semantic-release
`;

        fs.writeFileSync(path.join(workflowDir, 'release.yml'), workflowContent);

        // 4. Update package.json repository
        console.log(chalk.yellow('\nUpdating package.json repository URL...'));
        const packageJsonPath = 'package.json';

        if (fs.existsSync(packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

            pkg.repository = {
                type: 'git',
                url: `https://github.com/${repoOwner}/${repoName}.git`,
            };
            fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));

            // 5. Check and create Git Tag
            const currentVersion = pkg.version;
            if (currentVersion) {
                const tagName = `v${currentVersion}`;
                if (shell.exec(`git rev-parse ${tagName}`, { silent: true }).code !== 0) {
                    console.log(chalk.yellow(`\nCreating git tag ${tagName}...`));
                    shell.exec(`git tag ${tagName}`);
                    console.log(chalk.green(`Tag ${tagName} created.`));
                } else {
                    console.log(chalk.dim(`\nTag ${tagName} already exists.`));
                }
            }
        }

        console.log(chalk.green('\nSetup Complete!'));
        console.log(chalk.cyan('\nNext Steps:'));
        console.log('1. Go to npmjs.com -> Your Package -> Settings -> Trusted Publishing');
        console.log('2. Connect GitHub Actions:');
        console.log(`   - Owner: ${chalk.bold(repoOwner)}`);
        console.log(`   - Repo: ${chalk.bold(repoName)}`);
        console.log(`   - Workflow: ${chalk.bold('release.yml')}`);
        console.log('3. Push changes:');
        console.log(chalk.white('   git add .'));
        console.log(chalk.white('   git commit -m "ci: setup"'));
        console.log(chalk.white('   git push --follow-tags'));
    });

program.parse(process.argv);
