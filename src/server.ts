import app from './app';
import sequelize from './config/database';


const PORT = process.env.PORT || 3306;


sequelize.sync() 
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