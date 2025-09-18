// src/entities/index.ts
import Usuario from './Usuario.entity';
import Estabelecimento from './Estabelecimento.entity';
import Proprietario from './Proprietario.entity';
import Avaliacao from './Avaliacao.entity';
import ImagemProduto from './ImagemProduto.entity';

// Relacionamento 1-para-1: Proprietario e Estabelecimento
Proprietario.hasOne(Estabelecimento, { foreignKey: 'estabelecimentoId' });
Estabelecimento.belongsTo(Proprietario, { foreignKey: 'estabelecimentoId' });

// Relacionamento 1-para-Muitos: Usuario e Avaliacao
Usuario.hasMany(Avaliacao, { foreignKey: 'usuarioId', as: 'avaliacoes' });
Avaliacao.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// --- CORREÇÃO PRINCIPAL AQUI ---
// Relacionamento 1-para-Muitos: Estabelecimento e Avaliacao
// Definimos explicitamente o nome da relação em AMBAS as direções.
Estabelecimento.hasMany(Avaliacao, { 
    foreignKey: 'estabelecimentoId',
    as: 'avaliacoes' // Nome para quando puxamos as avaliações a partir de um Estabelecimento
});
Avaliacao.belongsTo(Estabelecimento, { 
    foreignKey: 'estabelecimentoId',
    as: 'estabelecimento' // Nome para quando puxamos o estabelecimento a partir de uma Avaliação
});
// --- FIM DA CORREÇÃO ---

// Relacionamento 1-para-Muitos: Estabelecimento e ImagemProduto
Estabelecimento.hasMany(ImagemProduto, { 
    foreignKey: 'estabelecimentoId',
    as: 'produtosImg' 
});
ImagemProduto.belongsTo(Estabelecimento, { foreignKey: 'estabelecimentoId' });


// Exportar todos os modelos
export {
    Usuario,
    Estabelecimento,
    Proprietario,
    Avaliacao,
    ImagemProduto
};