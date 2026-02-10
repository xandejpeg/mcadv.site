const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

// Servir arquivos estáticos do diretório raiz
app.use(express.static(__dirname));

// Rota para o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para o inner-page.html
app.get('/inner-page.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'inner-page.html'));
});

// Rota para o portfolio-details.html
app.get('/portfolio-details.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'portfolio-details.html'));
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

