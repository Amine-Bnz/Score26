'use strict';
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./helpers/db');

describe('admin routes', { concurrency: false }, () => {
  let db, router, checkToken;

  before(() => {
    db = createTestDb();

    // Injecter la BDD in-memory
    const dbPath = require.resolve('../database');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };

    // Injecter un logger silencieux
    const loggerPath = require.resolve('../logger');
    const silent = { info() {}, warn() {}, error() {}, debug() {}, child() { return silent } };
    require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true, exports: silent };

    // Charger scoring proprement
    delete require.cache[require.resolve('../scoring')];

    // Configurer le token admin pour les tests
    process.env.ADMIN_TOKEN = 'test-secret';
  });

  after(() => {
    db.close();
    delete require.cache[require.resolve('../database')];
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../scoring')];
    delete process.env.ADMIN_TOKEN;
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  function insertMatch(opts = {}) {
    const {
      equipeA = '🇫🇷 France', equipeB = '🇧🇷 Brésil',
      date = '2026-06-15 18:00:00', statut = 'a_venir',
      scoreA = null, scoreB = null,
    } = opts;
    return db.prepare(`
      INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, statut, score_reel_a, score_reel_b, journee)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(equipeA, equipeB, date, statut, scoreA, scoreB).lastInsertRowid;
  }

  function insertUser(id, pseudo) {
    db.prepare('INSERT INTO users (id, pseudo, avatar_seed) VALUES (?, ?, ?)').run(id, pseudo, 'seed');
  }

  function insertProno(userId, matchId, a, b) {
    db.prepare('INSERT INTO pronos (user_id, match_id, score_predit_a, score_predit_b) VALUES (?, ?, ?, ?)').run(userId, matchId, a, b);
  }

  // Simule une requête Express minimale
  function mockReq({ params = {}, body = {}, query = {}, headers = {} } = {}) {
    return { params, body, query, headers, ip: '127.0.0.1' };
  }
  function mockRes() {
    const res = { _status: 200, _json: null };
    res.status = (code) => { res._status = code; return res; };
    res.json = (data) => { res._json = data; return res; };
    return res;
  }

  // ── checkToken ───────────────────────────────────────────────────────

  describe('checkToken middleware', () => {
    test('rejette sans token', () => {
      // Charger le routeur pour obtenir checkToken indirectement
      // On teste via une requête sans token
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');

      // Le routeur est un middleware Express — on simule via les couches
      const req = mockReq({ query: {} });
      const res = mockRes();
      let nextCalled = false;

      // Extraire le checkToken du premier layer du routeur
      const layers = adminRouter.stack.filter(l => l.route);
      // GET /matchs est la première route, son premier handler est checkToken
      const getMatchsRoute = layers.find(l => l.route.path === '/matchs' && l.route.methods.get);
      const middleware = getMatchsRoute.route.stack[0].handle;

      middleware(req, res, () => { nextCalled = true; });
      assert.equal(res._status, 401);
      assert.equal(nextCalled, false);
    });

    test('rejette avec mauvais token', () => {
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const getMatchsRoute = adminRouter.stack.find(l => l.route?.path === '/matchs' && l.route?.methods?.get);
      const middleware = getMatchsRoute.route.stack[0].handle;

      const req = mockReq({ query: { token: 'wrong' } });
      const res = mockRes();
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });
      assert.equal(res._status, 401);
      assert.equal(nextCalled, false);
    });

    test('rejette si ADMIN_TOKEN vaut change_this_before_deploy', () => {
      const original = process.env.ADMIN_TOKEN;
      process.env.ADMIN_TOKEN = 'change_this_before_deploy';

      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const getMatchsRoute = adminRouter.stack.find(l => l.route?.path === '/matchs' && l.route?.methods?.get);
      const middleware = getMatchsRoute.route.stack[0].handle;

      const req = mockReq({ query: { token: 'change_this_before_deploy' } });
      const res = mockRes();
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });
      assert.equal(res._status, 401);
      assert.equal(nextCalled, false);

      process.env.ADMIN_TOKEN = original;
    });

    test('accepte avec bon token en query', () => {
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const getMatchsRoute = adminRouter.stack.find(l => l.route?.path === '/matchs' && l.route?.methods?.get);
      const middleware = getMatchsRoute.route.stack[0].handle;

      const req = mockReq({ query: { token: 'test-secret' } });
      const res = mockRes();
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });

    test('accepte avec bon token en header', () => {
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const getMatchsRoute = adminRouter.stack.find(l => l.route?.path === '/matchs' && l.route?.methods?.get);
      const middleware = getMatchsRoute.route.stack[0].handle;

      const req = mockReq({ headers: { 'x-admin-token': 'test-secret' } });
      const res = mockRes();
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });
  });

  // ── PATCH /matchs/:id — validation ──────────────────────────────────

  describe('PATCH validation', () => {
    test('rejette scores invalides (lettres)', () => {
      const matchId = insertMatch();
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handlers = patchRoute.route.stack.map(l => l.handle);
      // Skip checkToken (index 0), exécuter le handler (index 1)
      const handler = handlers[1];

      const req = mockReq({ params: { id: matchId }, body: { score_reel_a: 'abc', score_reel_b: '1' } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._status, 400);
      assert.match(res._json.error, /invalides/i);
    });

    test('rejette scores négatifs', () => {
      const matchId = insertMatch();
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handler = patchRoute.route.stack[1].handle;

      const req = mockReq({ params: { id: matchId }, body: { score_reel_a: -1, score_reel_b: 2 } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._status, 400);
    });

    test('rejette scores > 99', () => {
      const matchId = insertMatch();
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handler = patchRoute.route.stack[1].handle;

      const req = mockReq({ params: { id: matchId }, body: { score_reel_a: 100, score_reel_b: 0 } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._status, 400);
    });

    test('rejette statut invalide', () => {
      const matchId = insertMatch();
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handler = patchRoute.route.stack[1].handle;

      const req = mockReq({ params: { id: matchId }, body: { statut: 'invalid_status' } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._status, 400);
      assert.match(res._json.error, /invalide/i);
    });

    test('retourne 404 pour match inexistant', () => {
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handler = patchRoute.route.stack[1].handle;

      const req = mockReq({ params: { id: 99999 }, body: { statut: 'en_cours' } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._status, 404);
    });
  });

  // ── PATCH /matchs/:id — opérations ──────────────────────────────────

  describe('PATCH opérations', () => {
    test('change le statut en en_cours', () => {
      const matchId = insertMatch();
      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handler = patchRoute.route.stack[1].handle;

      const req = mockReq({ params: { id: matchId }, body: { statut: 'en_cours' } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._status, 200);
      assert.equal(res._json.statut, 'en_cours');
    });

    test('saisie score → statut termine + points calculés', () => {
      const matchId = insertMatch();
      insertUser('u1', 'user1');
      insertProno('u1', matchId, 2, 1);

      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handler = patchRoute.route.stack[1].handle;

      const req = mockReq({ params: { id: matchId }, body: { score_reel_a: 2, score_reel_b: 1 } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._json.statut, 'termine');
      assert.equal(res._json.score_reel_a, 2);
      assert.equal(res._json.score_reel_b, 1);

      // Vérifier que les points ont été calculés
      const prono = db.prepare('SELECT points_obtenus FROM pronos WHERE user_id = ? AND match_id = ?').get('u1', matchId);
      assert.ok(prono.points_obtenus != null, 'points_obtenus doit être renseigné');
    });

    test('reset remet score et statut à zéro', () => {
      const matchId = insertMatch({ statut: 'termine', scoreA: 3, scoreB: 0 });

      delete require.cache[require.resolve('../routes/admin')];
      const adminRouter = require('../routes/admin');
      const patchRoute = adminRouter.stack.find(l => l.route?.path === '/matchs/:id' && l.route?.methods?.patch);
      const handler = patchRoute.route.stack[1].handle;

      const req = mockReq({ params: { id: matchId }, body: { reset: true } });
      const res = mockRes();
      handler(req, res);
      assert.equal(res._json.statut, 'a_venir');
      assert.equal(res._json.score_reel_a, null);
      assert.equal(res._json.score_reel_b, null);
    });
  });
});
