import Usuario from './Usuario.entity';
import Estabelecimento from './Estabelecimento.entity';
import Proprietario from './Proprietario.entity';
import Avaliacao from './Avaliacao.entity';
import ImagemProduto from './ImagemProduto.entity';


Proprietario.hasOne(Estabelecimento, { foreignKey: 'estabelecimentoId' });
Estabelecimento.belongsTo(Proprietario, { foreignKey: 'estabelecimentoId' });


Usuario.hasMany(Avaliacao, { foreignKey: 'usuarioId', as: 'avaliacoes' });
Avaliacao.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });


Estabelecimento.hasMany(Avaliacao, { 
    foreignKey: 'estabelecimentoId',
    as: 'avaliacoes' 
});
Avaliacao.belongsTo(Estabelecimento, { 
    foreignKey: 'estabelecimentoId',
    as: 'estabelecimento' 
});

Estabelecimento.hasMany(ImagemProduto, { 
    foreignKey: 'estabelecimentoId',
    as: 'produtosImg' 
});
ImagemProduto.belongsTo(Estabelecimento, { foreignKey: 'estabelecimentoId' });

export {
    Usuario,
    Estabelecimento,
    Proprietario,
    Avaliacao,
    ImagemProduto
};