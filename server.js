
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Neon Space Racer running on ' + PORT));
