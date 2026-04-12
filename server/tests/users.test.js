'use strict';
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { createTestDb } = require('./helpers/db');

// UUIDs v4 de test (S8: les routes valident maintenant le format UUID)
const UUID_EXISTING = 'a0000000-0000-4000-8000-000000000001';
const UUID_NEW      = 'a0000000-0000-4000-8000-000000000002';
const UUID_DUP      = 'a0000000-0000-4000-8000-000000000003';
const UUID_NOPE     = 'a0000000-0000-4000-8000-ffffffffffff';

describe('users', { concurrency: false }, () => {
  let db, app;

  before(() => {
    db = createTestDb();

    // Injecter la BDD in-memory
    const dbPath = require.resolve('../database');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };

    // Injecter un logger silencieux
    const loggerPath = require.resolve('../logger');
    const silent = { info() {}, warn() {}, error() {}, debug() {}, child() { return silent } };
    require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true, exports: silent };

    // Remplacer express-rate-limit par un middleware passthrough
    // (sans ça, les 8 POST dépassent la limite de 5 req/15min)
    const rlPath = require.resolve('express-rate-limit');
    require.cache[rlPath] = { id: rlPath, filename: rlPath, loaded: true, exports: () => (req, res, next) => next() };

    // Charger la route fraîchement (après les mocks)
    delete require.cache[require.resolve('../config/jwt')];
    delete require.cache[require.resolve('../middleware/auth')];
    delete require.cache[require.resolve('../middleware/validate')];
    delete require.cache[require.resolve('../routes/users')];

    app = express();
    app.use(express.json());
    app.use('/api/users', require('../routes/users'));

    // Seed : un user déjà existant pour les tests GET et doublon
    db.prepare('INSERT INTO users (id, pseudo, avatar_seed) VALUES (?,?,?)')
      .run(UUID_EXISTING, 'existant', 'seed');
  });

  after(() => {
    db.close();
    delete require.cache[require.resolve('../database')];
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../config/jwt')];
    delete require.cache[require.resolve('../middleware/auth')];
    delete require.cache[require.resolve('../middleware/validate')];
    delete require.cache[require.resolve('../routes/users')];
    delete require.cache[require.resolve('express-rate-limit')];
  });

  // ── POST /api/users ───────────────────────────────────────────────────────

  test('POST — création valide → 201 + token JWT', async () => {
    const res = await request(app).post('/api/users').send({
      id: UUID_NEW,
      pseudo: 'nouveau',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.pseudo, 'nouveau');
    assert.ok('id' in res.body && 'avatar_seed' in res.body);
    assert.ok(res.body.token, 'doit retourner un token JWT');
  });

  test('POST — pseudo déjà pris → 409', async () => {
    const res = await request(app).post('/api/users').send({
      id: UUID_DUP,
      pseudo: 'existant',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 409);
  });

  test('POST — pseudo vide → 400', async () => {
    const res = await request(app).post('/api/users').send({
      id: crypto.randomUUID(),
      pseudo: '',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 400);
  });

  test('POST — pseudo trop long (21 chars) → 400', async () => {
    const res = await request(app).post('/api/users').send({
      id: crypto.randomUUID(),
      pseudo: 'a'.repeat(21),
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 400);
  });

  test('POST — pseudo avec espace → 400', async () => {
    const res = await request(app).post('/api/users').send({
      id: crypto.randomUUID(),
      pseudo: 'mon pseudo',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 400);
  });

  test('POST — pseudo avec accent → 400', async () => {
    const res = await request(app).post('/api/users').send({
      id: crypto.randomUUID(),
      pseudo: 'héros',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 400);
  });

  test('POST — pseudo avec @ → 400', async () => {
    const res = await request(app).post('/api/users').send({
      id: crypto.randomUUID(),
      pseudo: 'user@test',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 400);
  });

  test('POST — champs manquants (sans id) → 400', async () => {
    const res = await request(app).post('/api/users').send({
      pseudo: 'joueur2',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 400);
  });

  // ── GET /api/users/:id ────────────────────────────────────────────────────

  test('GET /:id — user existant → 200 + stats', async () => {
    const res = await request(app).get(`/api/users/${UUID_EXISTING}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.pseudo, 'existant');
    assert.ok(res.body.stats !== undefined);
  });

  test('GET /:id — user inexistant → 404', async () => {
    const res = await request(app).get(`/api/users/${UUID_NOPE}`);
    assert.equal(res.status, 404);
  });

  test('GET /:id — id non-UUID → 400 (S8)', async () => {
    const res = await request(app).get('/api/users/not-a-uuid');
    assert.equal(res.status, 400);
  });

  test('POST — id non-UUID → 400 (S8)', async () => {
    const res = await request(app).post('/api/users').send({
      id: 'not-a-uuid',
      pseudo: 'testuser',
      avatar_seed: 'abc',
    });
    assert.equal(res.status, 400);
  });
});
