const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('YOUniversity Backend API');
});

// Stub routes
app.use('/auth', require('./routes/auth'));
app.use('/locations', require('./routes/locations'));
app.use('/devices', require('./routes/devices'));
app.use('/applications', require('./routes/applications'));
app.use('/loans', require('./routes/loans'));
app.use('/btl', require('./routes/btl'));
app.use('/reports', require('./routes/reports'));
app.use('/gdpr', require('./routes/gdpr'));
app.use('/imports', require('./routes/imports'));

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
