// S8: Validation de format UUID sur les paramètres de route
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Express router.param() callback — valide qu'un paramètre est un UUID v4
function validateUUIDParam(req, res, next, value) {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }
  next();
}

module.exports = { validateUUIDParam, UUID_REGEX };
