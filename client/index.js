const path = require('path');
const express = require('express');

const port = 8080;
const app = express();

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/src/index.html');
});
app.use("/dist", express.static(path.resolve(__dirname, 'dist')));
app.use("/assets", express.static(path.resolve(__dirname, 'assets')));

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});