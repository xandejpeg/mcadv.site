const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

// Feeds do Radar e relatórios são consumidos por outros projetos: liberar CORS.
app.use(['/public/api', '/content'], (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Servir arquivos estáticos do diretório raiz (LP única)
app.use(express.static(__dirname));

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

