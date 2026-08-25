const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

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

