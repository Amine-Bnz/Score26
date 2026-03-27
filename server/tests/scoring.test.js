'use strict';
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./helpers/db');

describe('scoring', { concurrency: false }, () => {
  let db, calculerPointsBase, calculerPoints;

  before(() => {
    db = createTestDb();

    // Injecter la BDD in-memory avant de charger scoring.js
    // (scoring.js fait const db = require('./database') au chargement)
    const dbPath = require.resolve('../database');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    delete require.cache[require.resolve('../scoring')];

    ({ calculerPointsBase, calculerPoints } = require('../scoring'));
  });

  after(() => {
    db.close();
    delete require.cache[require.resolve('../database')];
    delete require.cache[require.resolve('../scoring')];
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function insertUser(id) {
    db.prepare('INSERT INTO users (id, pseudo, avatar_seed) VALUES (?, ?, ?)').run(id, id, 'seed');
  }

  function insertMatch(rA, rB) {
    return db.prepare(
      'INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, score_reel_a, score_reel_b, journee) VALUES (?,?,?,?,?,?)'
    ).run('A', 'B', '2020-01-01 12:00:00', rA, rB, 1).lastInsertRowid;
  }

  function insertProno(userId, matchId, a, b) {
    db.prepare('INSERT INTO pronos (user_id, match_id, score_predit_a, score_predit_b) VALUES (?,?,?,?)')
      .run(userId, matchId, a, b);
  }

  function getPoints(userId, matchId) {
    return db.prepare('SELECT points_obtenus FROM pronos WHERE user_id=? AND match_id=?')
      .get(userId, matchId).points_obtenus;
  }

  // ── Partie 1 : logique pure (calculerPointsBase, sans BDD) ─────────────────

  test('score exact → 50 pts', () => {
    assert.equal(
      calculerPointsBase({ score_predit_a: 2, score_predit_b: 1 }, { score_reel_a: 2, score_reel_b: 1 }),
      50
    );
  });

  test('victoire A correcte, mauvais score → 20 pts', () => {
    assert.equal(
      calculerPointsBase({ score_predit_a: 2, score_predit_b: 0 }, { score_reel_a: 3, score_reel_b: 0 }),
      20
    );
  });

  test('victoire B correcte, mauvais score → 20 pts', () => {
    assert.equal(
      calculerPointsBase({ score_predit_a: 0, score_predit_b: 1 }, { score_reel_a: 0, score_reel_b: 2 }),
      20
    );
  });

  test('nul prédit + nul réel, scores différents → 20 pts', () => {
    assert.equal(
      calculerPointsBase({ score_predit_a: 1, score_predit_b: 1 }, { score_reel_a: 0, score_reel_b: 0 }),
      20
    );
  });

  test('nul prédit mais réel pas nul → 0 pts', () => {
    assert.equal(
      calculerPointsBase({ score_predit_a: 1, score_predit_b: 1 }, { score_reel_a: 2, score_reel_b: 0 }),
      0
    );
  });

  test('victoire A prédite mais B gagne → 0 pts', () => {
    assert.equal(
      calculerPointsBase({ score_predit_a: 2, score_predit_b: 0 }, { score_reel_a: 0, score_reel_b: 1 }),
      0
    );
  });

  // ── Partie 2 : cote cachée (calculerPoints, avec BDD) ─────────────────────

  test('seul prono, score exact → 50 pts (cote ×1)', () => {
    insertUser('u7');
    const mId = insertMatch(2, 1);
    insertProno('u7', mId, 2, 1);
    calculerPoints(mId);
    assert.equal(getPoints('u7', mId), 50);
  });

  test('1 prono sur 2 avec le même score exact → 100 pts (cote ×2)', () => {
    insertUser('u8a');
    insertUser('u8b');
    const mId = insertMatch(2, 1);
    insertProno('u8a', mId, 2, 1); // score exact
    insertProno('u8b', mId, 3, 0); // score différent
    calculerPoints(mId);
    assert.equal(getPoints('u8a', mId), 100);
  });

  test('cote plafonnée ×5 → 250 pts (1 prono sur 6 avec ce score)', () => {
    // ratio = 1/6 → cote = 6, plafonnée à 5 → 50 × 5 = 250
    ['u9a', 'u9b', 'u9c', 'u9d', 'u9e', 'u9f'].forEach(id => insertUser(id));
    const mId = insertMatch(2, 1);
    insertProno('u9a', mId, 2, 1); // seul avec ce score exact
    ['u9b', 'u9c', 'u9d', 'u9e', 'u9f'].forEach(id => insertProno(id, mId, 3, 0));
    calculerPoints(mId);
    assert.equal(getPoints('u9a', mId), 250);
  });

  test('mauvaise issue → 0 pts quelle que soit la cote', () => {
    insertUser('u10');
    const mId = insertMatch(0, 1);
    insertProno('u10', mId, 1, 0); // A gagne prédit, B gagne réel
    calculerPoints(mId);
    assert.equal(getPoints('u10', mId), 0);
  });

  test('aucun prono sur le match → ne plante pas', () => {
    const mId = insertMatch(1, 0);
    assert.doesNotThrow(() => calculerPoints(mId));
  });
});
