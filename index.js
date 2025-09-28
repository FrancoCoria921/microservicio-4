const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser') // Agregado para leer datos POST
const mongoose = require('mongoose') // Agregado para la base de datos
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

// 1. POST /api/users: Crear un nuevo usuario
app.post('/api/users', async (req, res) => {
  const username = req.body.username;
  
  const newUser = new User({ username });
  try {
    const savedUser = await newUser.save();
    // Formato de respuesta: Usuario
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

// 2. GET /api/users: Obtener todos los usuarios
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('_id username');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Could not retrieve users" });
  }
});

// 3. POST /api/users/:_id/exercises: Añadir un ejercicio
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration } = req.body;
  // Si no se provee fecha, usa la fecha actual
  let date = req.body.date ? new Date(req.body.date) : new Date();

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

    // Formato de respuesta: Ejercicio (Usando toDateString())
    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.date.toDateString(), 
      duration: savedExercise.duration,
      description: savedExercise.description
    });

  } catch (err) {
    res.status(500).json({ error: "Could not add exercise" });
  }
});

// 4. GET /api/users/:_id/logs: Obtener el log de ejercicios
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query; 

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: "User not found" });
    }

    let dateFilter = { userId: userId };
    let dateQuery = {};

    // Construir filtros de fecha (from/to)
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

    // Consulta con filtros y límites
    let query = Exercise.find(dateFilter).select('description duration date');

    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum)) query = query.limit(limitNum);
    }
    
    const exercises = await query.sort('date').exec();

    // Mapear al formato de log (Usando toDateString())
    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString() 
    }));

    // Formato de respuesta: Log
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log: log
    });

  } catch (err) {
    res.status(500).json({ error: "Could not retrieve log" });
  }
});


const listener = app.listen(port, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
