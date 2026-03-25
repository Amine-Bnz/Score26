require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialisation de la base de données au démarrage
require('./database');

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/matchs', require('./routes/matchs'));
app.use('/api/pronos', require('./routes/pronos'));

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
