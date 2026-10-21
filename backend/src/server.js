import 'dotenv/config';
import app from './app.js';

const express = require('express');

const app = express();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(` HAVIE Backend server is running at http://localhost:${PORT}`);
  console.log(` API base path: http://localhost:${PORT}/api`);
});

