/**
 * MDX lint: catches syntax that breaks Mintlify's MDX parser.
 *
 * Mintlify parses all .md and .mdx files as MDX, which means:
 * 1. `<foo` is interpreted as a JSX tag (bare angle brackets)
 * 2. `{expr}` is interpreted as a JSX expression (bare curly braces)
 *
 * Both cause deploy failures when used outside fenced code blocks or
 * inline code spans. Fix: use `&lt;` / `&#123;` or wrap in backticks.
 *
 * Files listed in docs/.mintignore are excluded from these checks.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const DOCS_DIR = new URL('../docs/', import.meta.url).pathname;

// Parse .mintignore for excluded files/dirs
const mintignorePath = join(DOCS_DIR, '.mintignore');
const ignored = existsSync(mintignorePath)
  ? readFileSync(mintignorePath, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
  : [];

function isIgnored(filename) {
  return ignored.some(pattern => {
    if (pattern.endsWith('/')) return filename.startsWith(pattern);
    return filename === pattern;
  });
}

function getAllDocs(dir) {
  let results = [];

  const list = readdirSync(dir, { withFileTypes: true });

  for (const file of list) {
    const fullPath = join(dir, file.name);

    if (file.isDirectory()) {
      results = results.concat(getAllDocs(fullPath));
    } else if (
      (file.name.endsWith('.md') || file.name.endsWith('.mdx')) &&
      !isIgnored(fullPath.replace(DOCS_DIR, ''))
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

const docFiles = getAllDocs(DOCS_DIR);

/** Strip fenced code blocks and inline code spans from content. */
function stripCode(content) {
  const lines = content.split('\n');
  let inFence = false;
  const result = [];

  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      result.push('');
      continue;
    }
    if (inFence) {
      result.push('');
      continue;
    }
    // Strip inline code spans
    result.push(line.replace(/`[^`]+`/g, ''));
  }
  return result;
}

/** Find bare angle brackets: < followed by digit or hyphen. */
function findBareAngleBrackets(lines) {
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/<[\d-]/);
    if (match) {
      issues.push({ line: i + 1, text: lines[i].trim(), type: 'angle bracket' });
    }
  }
  return issues;
}

/** Find bare curly braces interpreted as JSX expressions. */
function findBareCurlyBraces(lines) {
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match {word} patterns that MDX will try to evaluate as JS
    // Skip empty braces {} and braces with spaces only (table alignment etc.)
    if (/\{[a-zA-Z_$]/.test(line)) {
      issues.push({ line: i + 1, text: line.trim(), type: 'curly brace' });
    }
  }
  return issues;
}

describe('MDX files have no bare angle brackets', () => {
  for (const file of docFiles) {
    const name = file.split('/').pop();
    it(`${name} has no bare <digit or <hyphen outside code`, () => {
      const content = readFileSync(file, 'utf8');
      const lines = stripCode(content);
      const issues = findBareAngleBrackets(lines);
      if (issues.length > 0) {
        const details = issues.map(i => `  line ${i.line}: ${i.text}`).join('\n');
        assert.fail(
          `Bare angle brackets will break Mintlify MDX parsing:\n${details}\n\nFix: replace < with &lt; or wrap in a code fence`
        );
      }
    });
  }
});

describe('MDX files have no bare curly braces', () => {
  for (const file of docFiles) {
    const name = file.split('/').pop();
    it(`${name} has no bare {expression} outside code`, () => {
      const content = readFileSync(file, 'utf8');
      const lines = stripCode(content);
      const issues = findBareCurlyBraces(lines);
      if (issues.length > 0) {
        const details = issues.map(i => `  line ${i.line}: ${i.text}`).join('\n');
        assert.fail(
          `Bare curly braces will break Mintlify MDX parsing (interpreted as JSX):\n${details}\n\nFix: escape with &#123; or wrap in a code fence / backticks`
        );
      }
    });
  }
});
