const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser') // Necesario para leer datos POST
const mongoose = require('mongoose') // Necesario para MongoDB
require('dotenv').config() 

// ======================================================================
// CONFIGURACIÓN INICIAL Y DB
// ======================================================================

const port = process.env.PORT || 3000

// Conexión a MongoDB (Lee MONGO_URI desde Railway o .env)
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
});

// Middlewares
app.use(cors())
// Configuración de body-parser para leer datos del formulario
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static('public')) 
app.get('/', (req, res) => {
  // Ruta original que sirve el index.html
  res.sendFile(__dirname + '/views/index.html') 
});

// ======================================================================
// DEFINICIÓN DE ESQUEMAS Y MODELOS
// ======================================================================

const exerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: new Date() }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
});

const Exercise = mongoose.model('Exercise', exerciseSchema);
const User = mongoose.model('User', userSchema);


// ======================================================================
// RUTAS DE LA API
// ======================================================================

// 1. POST /api/users: Crear un nuevo usuario (Cumple tests #2, #3)
app.post('/api/users', async (req, res) => {
  const username = req.body.username;
  
  const newUser = new User({ username });
  try {
    const savedUser = await newUser.save();
    res.json({
      username: savedUser.username,
      _id: savedUser._id
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ error: "Username already taken" });
    }
    res.status(500).json({ error: "Could not save user" });
  }
});

// 2. GET /api/users: Obtener todos los usuarios (Cumple tests #4, #5, #6)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('_id username');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Could not retrieve users" });
  }
});

// 3. POST /api/users/:_id/exercises: Añadir un ejercicio (Cumple tests #7, #8)
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration } = req.body;
  // Manejo de fecha opcional
  let date = req.body.date ? new Date(req.body.date) : new Date();

  // Validación básica
  if (!description || !duration || isNaN(Number(duration)) || (req.body.date && isNaN(date.getTime()))) {
    return res.json({ error: "Invalid input." });
  }
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: "User not found" });
    }

    const newExercise = new Exercise({
      userId: userId,
      description: description,
      duration: Number(duration),
      date: date
    });
    const savedExercise = await newExercise.save();

    // Formato de respuesta: Ejercicio (Usando toDateString() para el formato estricto)
    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.date.toDateString(), // <-- CLAVE para el test #15
      duration: savedExercise.duration,
      description: savedExercise.description
    });

  } catch (err) {
    res.status(500).json({ error: "Could not add exercise" });
  }
});

// 4. GET /api/users/:_id/logs: Obtener el log de ejercicios (Cumple tests #9 al #16)
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  // Parámetros opcionales para filtrado
  const { from, to, limit } = req.query; 

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: "User not found" });
    }

    let dateFilter = { userId: userId };
    let dateQuery = {};

    // Construir filtros de fecha (yyyy-mm-dd)
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) dateQuery['$gte'] = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) dateQuery['$lte'] = toDate;
    }

    if (Object.keys(dateQuery).length > 0) {
      dateFilter.date = dateQuery;
    }

    // Consulta con filtros, limitación y selección de campos
    let query = Exercise.find(dateFilter).select('description duration date');

    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum)) query = query.limit(limitNum); // <-- Cumple test #16 (limit)
    }
    
    const exercises = await query.sort('date').exec();

    // Mapear al formato de log
    const log = exercises.map(ex => ({
      description: ex.description, // <-- Cumple test #13
      duration: ex.duration,       // <-- Cumple test #14
      date: ex.date.toDateString() // <-- CLAVE para el test #15
    }));

    // Formato de respuesta: Log
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length, // <-- Cumple test #10
      log: log           // <-- Cumple test #11, #12
    });

  } catch (err) {
    res.status(500).json({ error: "Could not retrieve log" });
  }
});


const listener = app.listen(port, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
