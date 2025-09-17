// src/server.ts
import app from './app';
import sequelize from './config/database';

// A porta é lida do ficheiro .env, com um valor padrão de 3001
const PORT = process.env.PORT || 3306;

// Sincroniza com a base de dados e inicia o servidor
sequelize.sync() // O .sync() pode criar as tabelas se não existirem, útil para desenvolvimento
  .then(() => {
    console.log('Conexão com a base de dados estabelecida com sucesso.');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor a rodar na porta ${PORT}`);
      console.log(`✅ A sua API está pronta! Pode aceder em http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Não foi possível conectar à base de dados:', err);
  });