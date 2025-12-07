# @nam088/ci-setup

A CLI tool to automatically verify and setup Semantic Release CI/CD workflow with Trusted Publishing.

## Installation

```bash
npm install -g @nam088/ci-setup
```

## Usage

Navigate to your project root and run:

```bash
nam088-ci-setup
```

### Options

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--owner` | `-o` | GitHub Owner/Organization |
| `--repo` | `-r` | Repository Name |
| `--no-deps` | | Skip manual dependency installation |

### Example

```bash
nam088-ci-setup --owner Nam088 --repo my-project
```

## Features

-   ✅ Checks for git initialization
-   ✅ Installs `semantic-release` and plugins
-   ✅ Creates `.releaserc.json` with `main`, `beta`, `develop` branches support
-   ✅ Creates `.github/workflows/release.yml` configured for Trusted Publishing
-   ✅ Updates `package.json` repository URL
