const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('YOUniversity Backend');
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
