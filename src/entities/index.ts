// src/entities/index.ts
import Usuario from './Usuario.entity';
import Estabelecimento from './Estabelecimento.entity';
import Proprietario from './Proprietario.entity';
import Avaliacao from './Avaliacao.entity';
import ImagemProduto from './ImagemProduto.entity';

// Relacionamento 1-para-1: Proprietario e Estabelecimento
// Um Proprietario tem um Estabelecimento
Proprietario.hasOne(Estabelecimento, { foreignKey: 'estabelecimento_id' });
// Um Estabelecimento pertence a um Proprietario
Estabelecimento.belongsTo(Proprietario, { foreignKey: 'estabelecimento_id' });


// Um Usuario pode ter várias Avaliações
Usuario.hasMany(Avaliacao, { foreignKey: 'usuario_id' });
// Uma Avaliação pertence a um único Usuario
Avaliacao.belongsTo(Usuario, { foreignKey: 'usuario_id' });


// Um Estabelecimento pode ter várias Avaliações
Estabelecimento.hasMany(Avaliacao, { foreignKey: 'estabelecimento_id' });
// Uma Avaliação pertence a um único Estabelecimento
Avaliacao.belongsTo(Estabelecimento, { foreignKey: 'estabelecimento_id' });


// Um Estabelecimento pode ter várias Imagens de Produto
Estabelecimento.hasMany(ImagemProduto, { foreignKey: 'estabelecimento_id' });
// Uma Imagem de Produto pertence a um único Estabelecimento
ImagemProduto.belongsTo(Estabelecimento, { foreignKey: 'estabelecimento_id' });


// Exportar todos os modelos para serem usados em outros lugares da aplicação
export {
    Usuario,
    Estabelecimento,
    Proprietario,
    Avaliacao,
    ImagemProduto
};