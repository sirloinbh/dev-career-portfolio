import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

type Skill = { id: number; name: string; category: string; proficiency: number; memo: unknown };

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test('skills are stored, listed by category, updated and deleted', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM skills');

  await withApi(pool, async (call) => {
    const add = async (body: Record<string, unknown>) => {
      const response = await call('/api/skills', { method: 'POST', body });
      assert.equal(response.status, 201);
      return response.data.skill as Skill;
    };

    // Spaces around the name go, a blank memo is stored as NULL.
    const typescript = await add({
      name: '  TypeScript  ',
      category: 'language',
      proficiency: 4,
      memo: '  ',
    });
    assert.deepEqual(typescript, {
      id: typescript.id,
      name: 'TypeScript',
      category: 'language',
      proficiency: 4,
      memo: null,
    });
    // Added out of order on purpose: the list must sort them, not keep the insert order.
    await add({ name: 'Docker', category: 'tool', proficiency: 3 });
    await add({ name: 'go', category: 'language', proficiency: 4 });
    await add({ name: 'PostgreSQL', category: 'database', proficiency: 3, memo: '쿼리 튜닝' });
    await add({ name: '한글 형태소 분석', category: 'other', proficiency: 1 });
    await add({ name: 'React', category: 'framework', proficiency: 5 });
    await add({ name: 'AWS', category: 'infrastructure', proficiency: 2 });
    await add({ name: 'Python', category: 'language', proficiency: 5 });
    await add({ name: 'Bash', category: 'language', proficiency: 4 });

    const list = await call('/api/skills');
    assert.equal(list.status, 200);
    const order = (list.data.skills as Skill[]).map((skill) => skill.name);
    // Category order, then the strongest first, then the name with letter case ignored.
    assert.deepEqual(order, [
      'Python',
      'Bash',
      'go',
      'TypeScript',
      'React',
      'PostgreSQL',
      'AWS',
      'Docker',
      '한글 형태소 분석',
    ]);

    // The same name in another case or category is still the same skill.
    for (const body of [
      { name: 'typescript', category: 'language', proficiency: 1 },
      { name: ' TYPESCRIPT ', category: 'other', proficiency: 3 },
    ]) {
      const duplicate = await call('/api/skills', { method: 'POST', body });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.data.error, '이미 등록된 스킬입니다');
    }

    // Renaming another skill to a taken name is refused too, and that row stays as it was.
    const docker = (list.data.skills as Skill[]).find((skill) => skill.name === 'Docker');
    assert.ok(docker);
    const taken = await call(`/api/skills/${String(docker.id)}`, {
      method: 'PUT',
      body: { name: 'react', category: 'framework', proficiency: 1, memo: '바뀌면 안 됨' },
    });
    assert.equal(taken.status, 409);
    assert.equal(taken.data.error, '이미 등록된 스킬입니다');
    const kept = await call('/api/skills');
    assert.deepEqual(
      (kept.data.skills as Skill[]).find((skill) => skill.id === docker.id),
      docker,
    );

    // A skill may change the case of its own name, and every column changes.
    const updated = await call(`/api/skills/${String(typescript.id)}`, {
      method: 'PUT',
      body: { name: 'typescript', category: 'framework', proficiency: 2, memo: '타입 설계' },
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.data.skill, {
      id: typescript.id,
      name: 'typescript',
      category: 'framework',
      proficiency: 2,
      memo: '타입 설계',
    });

    const removed = await call(`/api/skills/${String(typescript.id)}`, { method: 'DELETE' });
    assert.equal(removed.status, 204);
    const after = await call('/api/skills');
    const names = (after.data.skills as Skill[]).map((skill) => skill.name);
    assert.equal(names.length, 8);
    assert.ok(!names.includes('typescript'));
    // The name is free again once the skill is gone.
    await add({ name: 'TypeScript', category: 'language', proficiency: 4 });

    for (const request of [
      { method: 'PUT', body: { name: 'Rust', category: 'language', proficiency: 1 } },
      { method: 'DELETE' },
    ]) {
      const missing = await call(`/api/skills/${String(typescript.id)}`, request);
      assert.equal(missing.status, 404);
      assert.equal(missing.data.error, '스킬을 찾을 수 없습니다');
    }
  });
});

test('the database itself refuses rows the API would refuse', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM skills');
  const insert = (name: string, category: string, proficiency: number) =>
    pool.query('INSERT INTO skills (name, category, proficiency) VALUES ($1, $2, $3)', [
      name,
      category,
      proficiency,
    ]);
  await assert.rejects(insert('', 'tool', 3), /skills_name_check/);
  await assert.rejects(insert('Git', 'frontend', 3), /skills_category_check/);
  await assert.rejects(insert('Git', 'tool', 0), /skills_proficiency_check/);
  await assert.rejects(insert('Git', 'tool', 6), /skills_proficiency_check/);
  await insert('Git', 'tool', 3);
  await assert.rejects(insert('GIT', 'other', 2), /skills_name_unique/);
});
