'use strict';
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./helpers/db');

describe('sync routes', { concurrency: false }, () => {
  let db;

  before(() => {
    db = createTestDb();

    // Injecter la BDD in-memory
    const dbPath = require.resolve('../database');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };

    // Injecter un logger silencieux
    const loggerPath = require.resolve('../logger');
    const silent = { info() {}, warn() {}, error() {}, debug() {}, child() { return silent } };
    require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true, exports: silent };

    // Injecter un mock footballData (évite les appels réseau)
    const fdPath = require.resolve('../services/footballData');
    require.cache[fdPath] = {
      id: fdPath, filename: fdPath, loaded: true,
      exports: {
        syncCalendrier: async () => 5,
        syncResultats: async () => 2,
      },
    };

    // Injecter un mock scoring
    delete require.cache[require.resolve('../scoring')];
    const scoringPath = require.resolve('../scoring');
    require.cache[scoringPath] = {
      id: scoringPath, filename: scoringPath, loaded: true,
      exports: { calculerPoints: () => {}, calculerPointsBase: () => {} },
    };

    // Configurer le token admin
    process.env.ADMIN_TOKEN = 'test-secret';
  });

  after(() => {
    db.close();
    delete require.cache[require.resolve('../database')];
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../services/footballData')];
    delete require.cache[require.resolve('../scoring')];
    delete process.env.ADMIN_TOKEN;
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  function mockReq({ params = {}, body = {}, query = {}, headers = {} } = {}) {
    return { params, body, query, headers, ip: '127.0.0.1' };
  }
  function mockRes() {
    const res = { _status: 200, _json: null };
    res.status = (code) => { res._status = code; return res; };
    res.json = (data) => { res._json = data; return res; };
    return res;
  }

  function getMiddleware(router, path, method) {
    const route = router.stack.find(l => l.route?.path === path && l.route?.methods?.[method]);
    return route.route.stack.map(l => l.handle);
  }

  // ── adminOnly middleware ─────────────────────────────────────────────

  describe('adminOnly middleware', () => {
    test('rejette sans token', () => {
      delete require.cache[require.resolve('../routes/sync')];
      const syncRouter = require('../routes/sync');
      const [middleware] = getMiddleware(syncRouter, '/status', 'get');

      const req = mockReq();
      const res = mockRes();
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });
      assert.equal(res._status, 401);
      assert.equal(nextCalled, false);
    });

    test('rejette avec token par défaut', () => {
      const original = process.env.ADMIN_TOKEN;
      process.env.ADMIN_TOKEN = 'change_this_before_deploy';

      delete require.cache[require.resolve('../routes/sync')];
      const syncRouter = require('../routes/sync');
      const [middleware] = getMiddleware(syncRouter, '/status', 'get');

      const req = mockReq({ query: { token: 'change_this_before_deploy' } });
      const res = mockRes();
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });
      assert.equal(res._status, 401);
      assert.equal(nextCalled, false);

      process.env.ADMIN_TOKEN = original;
    });

    test('accepte avec bon token', () => {
      delete require.cache[require.resolve('../routes/sync')];
      const syncRouter = require('../routes/sync');
      const [middleware] = getMiddleware(syncRouter, '/status', 'get');

      const req = mockReq({ query: { token: 'test-secret' } });
      const res = mockRes();
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });
  });

  // ── GET /status ─────────────────────────────────────────────────────

  describe('GET /status', () => {
    test('retourne les compteurs de synchro', () => {
      // Insérer des matchs pour avoir des données
      db.prepare(`INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, journee, statut)
        VALUES ('A', 'B', '2026-06-15 18:00:00', 1, 'a_venir')`).run();
      db.prepare(`INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, journee, statut, api_match_id)
        VALUES ('C', 'D', '2026-06-16 18:00:00', 1, 'termine', 12345)`).run();

      delete require.cache[require.resolve('../routes/sync')];
      const syncRouter = require('../routes/sync');
      const handlers = getMiddleware(syncRouter, '/status', 'get');
      // handlers[0] = adminOnly, handlers[1] = route handler
      const handler = handlers[1];

      const req = mockReq();
      const res = mockRes();
      handler(req, res);

      assert.equal(res._json.total, 2);
      assert.equal(res._json.sans_api_id, 1);  // Premier match sans api_match_id
    });
  });

  // ── POST /calendrier ────────────────────────────────────────────────

  describe('POST /calendrier', () => {
    test('appelle syncCalendrier et retourne ok', async () => {
      delete require.cache[require.resolve('../routes/sync')];
      const syncRouter = require('../routes/sync');
      const handlers = getMiddleware(syncRouter, '/calendrier', 'post');
      const handler = handlers[1];

      const req = mockReq();
      const res = mockRes();
      await handler(req, res);

      assert.equal(res._json.ok, true);
      assert.equal(res._json.mis_a_jour, 5);
    });
  });

  // ── POST /resultats ─────────────────────────────────────────────────

  describe('POST /resultats', () => {
    test('appelle syncResultats et retourne ok', async () => {
      delete require.cache[require.resolve('../routes/sync')];
      const syncRouter = require('../routes/sync');
      const handlers = getMiddleware(syncRouter, '/resultats', 'post');
      const handler = handlers[1];

      const req = mockReq();
      const res = mockRes();
      await handler(req, res);

      assert.equal(res._json.ok, true);
      assert.equal(res._json.mis_a_jour, 2);
    });
  });
});
