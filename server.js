const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend running at http://localhost:${PORT}`);
    console.log(`Make sure FastAPI backend is running on http://127.0.0.1:8000 (run: python api.py)`);
});
