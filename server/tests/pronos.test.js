'use strict';
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestDb } = require('./helpers/db');

const USER_ID = 'test-player';

describe('pronos', { concurrency: false }, () => {
  let db, app, futureMatchId, pastMatchId, upsertMatchId, token;

  before(() => {
    db = createTestDb();

    // Injecter la BDD in-memory
    const dbPath = require.resolve('../database');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };

    // Charger la route fraîchement
    delete require.cache[require.resolve('../routes/pronos')];
    delete require.cache[require.resolve('../middleware/auth')];
    delete require.cache[require.resolve('../config/jwt')];

    // Générer un token JWT de test
    const { JWT_SECRET } = require('../config/jwt');
    token = jwt.sign({ userId: USER_ID }, JWT_SECRET, { expiresIn: '1h' });

    app = express();
    app.use(express.json());
    app.use('/api/pronos', require('../routes/pronos'));

    // Seed : un user + trois matchs
    db.prepare('INSERT INTO users (id, pseudo, avatar_seed) VALUES (?,?,?)').run(USER_ID, 'testplayer', 'seed');

    futureMatchId = db.prepare(
      'INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, journee) VALUES (?,?,?,?)'
    ).run('A', 'B', '2099-01-01 12:00:00', 1).lastInsertRowid;

    pastMatchId = db.prepare(
      'INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, journee) VALUES (?,?,?,?)'
    ).run('C', 'D', '2020-01-01 12:00:00', 2).lastInsertRowid;

    // Match dédié pour l'upsert, avec un prono initial déjà inséré
    upsertMatchId = db.prepare(
      'INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, journee) VALUES (?,?,?,?)'
    ).run('E', 'F', '2099-01-02 12:00:00', 3).lastInsertRowid;

    db.prepare('INSERT INTO pronos (user_id, match_id, score_predit_a, score_predit_b) VALUES (?,?,?,?)')
      .run(USER_ID, upsertMatchId, 1, 0);
  });

  after(() => {
    db.close();
    delete require.cache[require.resolve('../database')];
    delete require.cache[require.resolve('../routes/pronos')];
    delete require.cache[require.resolve('../middleware/auth')];
    delete require.cache[require.resolve('../config/jwt')];
  });

  // ── POST /api/pronos ──────────────────────────────────────────────────────

  test('prono valide → 201', async () => {
    const res = await request(app).post('/api/pronos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        match_id: futureMatchId,
        score_predit_a: 2,
        score_predit_b: 1,
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.score_predit_a, 2);
    assert.equal(res.body.score_predit_b, 1);
  });

  test('upsert (deuxième POST même user+match) → 201 avec nouvelles valeurs', async () => {
    const res = await request(app).post('/api/pronos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        match_id: upsertMatchId,
        score_predit_a: 3,
        score_predit_b: 2,
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.score_predit_a, 3);
    assert.equal(res.body.score_predit_b, 2);
  });

  test('score négatif → 400', async () => {
    const res = await request(app).post('/api/pronos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        match_id: futureMatchId,
        score_predit_a: -1,
        score_predit_b: 0,
      });
    assert.equal(res.status, 400);
  });

  test('score > 99 → 400', async () => {
    const res = await request(app).post('/api/pronos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        match_id: futureMatchId,
        score_predit_a: 100,
        score_predit_b: 0,
      });
    assert.equal(res.status, 400);
  });

  test('score non-entier ("abc") → 400', async () => {
    const res = await request(app).post('/api/pronos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        match_id: futureMatchId,
        score_predit_a: 'abc',
        score_predit_b: 0,
      });
    assert.equal(res.status, 400);
  });

  test("match verrouillé (coup d'envoi passé) → 403", async () => {
    const res = await request(app).post('/api/pronos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        match_id: pastMatchId,
        score_predit_a: 1,
        score_predit_b: 0,
      });
    assert.equal(res.status, 403);
  });

  test('match inexistant → 404', async () => {
    const res = await request(app).post('/api/pronos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        match_id: 999999,
        score_predit_a: 1,
        score_predit_b: 0,
      });
    assert.equal(res.status, 404);
  });

  test('sans token → 401', async () => {
    const res = await request(app).post('/api/pronos').send({
      match_id: futureMatchId,
      score_predit_a: 1,
      score_predit_b: 0,
    });
    assert.equal(res.status, 401);
  });
});
