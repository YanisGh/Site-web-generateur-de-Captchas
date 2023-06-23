const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const crypto = require('crypto');
const cors = require('cors'); // Added

const app = express();
app.use(express.static('public'));
app.use(cors()); // Added

function MD5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

// Middleware pour parser les requêtes JSON
app.use(bodyParser.json());

// Configuration de la connexion à la base de données
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'capchat',
};

// Créer une connexion à la base de données
const connection = mysql.createConnection(dbConfig);

// Connecter à la base de données
connection.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err);
  } else {
    console.log('Connexion à la base de données réussie');
  }
});

// Route d'inscription
app.post('/register', (req, res) => {
  // Récupérer les informations d'inscription depuis le corps de la requête
  const username = req.query.username; 
  const password = req.query.password;
  const hashedPassword = MD5(password);

  // Vérifier si l'utilisateur existe déjà dans la base de données
  const checkUserQuery = 'SELECT * FROM utilisateurs WHERE identifiant = ?';
  connection.query(checkUserQuery, [username], (err, results) => {
    if (err) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', err);
      res.status(500).json({ message: 'Une erreur s\'est produite' });
    } else if (results.length > 0) {
      res.status(409).json({ message: 'Cet utilisateur existe déjà' });
    } else {
      // Insérer le nouvel utilisateur dans la base de données
      const insertUserQuery = 'INSERT INTO utilisateurs (identifiant, MotDePasse, Rang) VALUES (?, ?, 1)';
      connection.query(insertUserQuery, [username, hashedPassword], (err, results) => {
        if (err) {
          console.error('Erreur lors de l\'inscription de l\'utilisateur:', err);
          res.status(500).json({ message: 'Une erreur s\'est produite' });
        } else {
          res.status(200).json('Inscription réussie, vous pouvez maintenant utilisez vos identifiants pour vous connecter'); // Return 200 for success
        }
      });
    }
  });
});

// Route d'authentification
app.get('/login', (req, res) => {
  const username = req.query.username;
  const password = req.query.password;
  const hashedPassword = MD5(password);

  const query = `SELECT * FROM utilisateurs WHERE identifiant = ? AND MotDePasse = ?`;
  connection.query(query, [username, hashedPassword], (err, results) => {
    if (err) {
      console.error('Error executing SQL query:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    // Check if the login credentials are valid
    if (results.length > 0) {
      const token = jwt.sign({ username }, 'audir8');
      const userId = results[0].idUtilisateur; // Assuming the user ID field is named 'id'
      
      // Update the token field in the database for the logged-in user
      const updateQuery = 'UPDATE utilisateurs SET token = ? WHERE idUtilisateur = ?';
      connection.query(updateQuery, [token, userId], (updateErr, updateResult) => {
        if (updateErr) {
          console.error('Error updating token:', updateErr);
          res.status(500).send('Internal Server Error');
          return;
        }
        
        res.json({ token }); // Send the token as JSON response
      });
    } else {
      console.log("login mauvais");
      res.send('Invalid login credentials!');
    }
  });
});


// Routes pour les fonctionnalités protégées par l'authentification

//Route pour voir les themes, artistes, jeux d'images.
app.get('/getAll', (req, res) => {
  const categorie = req.query.categorie;

  if (categorie === 'theme') {
    const query = 'SELECT idTheme, Nom FROM themes';
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error executing SQL query:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      res.send(results);
    });
  } else if (categorie === 'artistes') {
    const query = 'SELECT idUtilisateur, Identifiant FROM Utilisateurs';
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error executing SQL query:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      res.send(results);
    });
  } else if (categorie === 'jeux d\'image') {
    const query = 'SELECT idJeu, Nom FROM jeux';
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error executing SQL query:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      res.send(results);
    });
  } else {
    res.status(400).send('Invalid categorie');
  }
});

app.patch('/getAllModify', (req, res) => {
  const { categorie, id, newName } = req.body;

  if (categorie === 'artistes') {
    // Handle artiste modification based on the provided id
    const updateQuery = 'UPDATE Utilisateurs SET Identifiant = ? WHERE idUtilisateur = ?';
    connection.query(updateQuery, [newName, id], (err, result) => {
      if (err) {
        console.error('Error executing SQL query:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      res.send('Artiste modified successfully');
    });
  } else {
    res.status(400).send('Invalid categorie');
  }
});

app.delete('/deleteAll', (req, res) => {
  const { categorie, id } = req.query;

  if (categorie === 'artistes') {
    const deleteQuery = 'DELETE FROM Utilisateurs WHERE idUtilisateur = ?';
    connection.query(deleteQuery, [id], (err, result) => {
      if (err) {
        console.error('Error executing SQL query:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      res.send('Artiste deleted successfully');
    });
  } else {
    res.status(400).send('Invalid categorie');
  }
});


// Middleware pour vérifier le token d'authentification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    
    req.user = user;
    next();
  });
}

// Démarrer le serveur
app.listen(3000, () => {
  console.log('Serveur démarré');
});
