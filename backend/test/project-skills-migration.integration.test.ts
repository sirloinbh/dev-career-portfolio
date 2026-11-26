import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { testDatabaseUrl } from './helpers.js';

const url = testDatabaseUrl();
const migration = (name: string) =>
  readFile(fileURLToPath(new URL(`../../database/migrations/${name}`, import.meta.url)), 'utf8');

// Runs the migrations in a scratch schema, so the shared test tables are never touched. Requires career_test
// (any state); skipped, not passed, without it.
test(
  'migration 013 moves project technologies into skill links without losing a name and can run again (#225)',
  { skip: !url },
  async (t) => {
    const client = new Client({ connectionString: url });
    await client.connect();
    const schema = 'migration_014_test';
    t.after(async () => {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    });
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);

    // The tables as they were before 013.
    for (const name of [
      '003_careers.sql',
      '004_projects.sql',
      '005_skills.sql',
      '011_project_technologies_items.sql',
      '012_projects_career_link.sql',
    ]) {
      await client.query(await migration(name));
    }
    await client.query(
      "INSERT INTO skills (name, category, proficiency) VALUES ('TypeScript', 'language', 4)",
    );
    const sample: [string, string[]][] = [
      ['first', ['typescript', ' PostgreSQL ', 'Go']],
      ['second', ['go', 'TYPESCRIPT', 'Rust']],
      ['third', []],
    ];
    for (const [name, technologies] of sample) {
      await client.query(
        "INSERT INTO projects (name, start_date, technologies) VALUES ($1, '2024-01-02', $2)",
        [name, technologies],
      );
    }

    const sql = await migration('014_project_skills.sql');
    await client.query(sql);

    const skills = await client.query<{ name: string; category: string; proficiency: number }>(
      'SELECT name, category, proficiency FROM skills ORDER BY lower(name)',
    );
    // An existing skill keeps its own spelling and level; the others are created once, in the first spelling seen.
    assert.deepEqual(skills.rows, [
      { name: 'Go', category: 'other', proficiency: 1 },
      { name: 'PostgreSQL', category: 'other', proficiency: 1 },
      { name: 'Rust', category: 'other', proficiency: 1 },
      { name: 'TypeScript', category: 'language', proficiency: 4 },
    ]);

    const links = await client.query<{ project: string; skills: string[] }>(
      `SELECT p.name AS project, COALESCE(array_agg(s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '{}') AS skills
       FROM projects p
       LEFT JOIN project_skills ps ON ps.project_id = p.id
       LEFT JOIN skills s ON s.id = ps.skill_id
       GROUP BY p.name ORDER BY p.name`,
    );
    assert.deepEqual(links.rows, [
      { project: 'first', skills: ['Go', 'PostgreSQL', 'TypeScript'] },
      { project: 'second', skills: ['Go', 'Rust', 'TypeScript'] },
      { project: 'third', skills: [] },
    ]);

    // The names are cleared from the column, so running the file again moves nothing and brings nothing back.
    const left = await client.query(
      'SELECT count(*)::int AS n FROM projects WHERE cardinality(technologies) > 0',
    );
    assert.equal(left.rows[0]?.n, 0);
    await client.query(
      'DELETE FROM project_skills WHERE project_id = (SELECT id FROM projects WHERE name = $1)',
      ['third'],
    );
    await client.query(
      "DELETE FROM project_skills WHERE skill_id = (SELECT id FROM skills WHERE name = 'Rust')",
    );
    await client.query("DELETE FROM skills WHERE name = 'Rust'");
    await client.query(sql);
    const again = await client.query('SELECT count(*)::int AS n FROM project_skills');
    assert.equal(again.rows[0]?.n, 5);
    const rust = await client.query("SELECT 1 FROM skills WHERE name = 'Rust'");
    assert.equal(rust.rowCount, 0);
  },
);
