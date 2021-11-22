require('dotenv').config();
const express = require('express'),
      path = require('path'),
      logger = require('./middleware/logger');

const app = express();

// Use logger middleware function to print logs during runtime
app.use(logger);

app.use('/api/complaints', require('./routes/api/complaints'));

// Set static folder
app.use(express.static(path.join(__dirname, '../', 'frontend')));

app.listen(process.env.PORT, () => console.log(`Server started on port ${process.env.PORT}`));