// Copie e cole TUDO isto no seu arquivo: src/entities/index.ts

import Usuario from "./Usuario.entity";
import Estabelecimento from "./Estabelecimento.entity";
import Avaliacao from "./Avaliacao.entity";
import ImagemProduto from "./ImagemProduto.entity";

// Usuário <-> Avaliação
Usuario.hasMany(Avaliacao, { foreignKey: "usuarioId", as: "avaliacoes" });
Avaliacao.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

// Estabelecimento <-> Avaliação
Estabelecimento.hasMany(Avaliacao, {
  foreignKey: "estabelecimentoId",
  as: "avaliacoes",
});
Avaliacao.belongsTo(Estabelecimento, {
  foreignKey: "estabelecimentoId",
  as: "estabelecimento",
});

// Estabelecimento <-> ImagemProduto
Estabelecimento.hasMany(ImagemProduto, {
  foreignKey: "estabelecimentoId",
  as: "produtosImg",
});
ImagemProduto.belongsTo(Estabelecimento, { foreignKey: "estabelecimentoId" });

// --- CORREÇÃO AQUI ---
// Avaliação <-> Avaliação (para respostas)
// Um comentário PAI (parent_id: null) pode ter várias RESPOSTAS
Avaliacao.hasMany(Avaliacao, {
  foreignKey: "parentId", // A chave estrangeira que aponta para 'avaliacoes_id'
  as: "respostas",       // O alias que você usa no service!
  onDelete: "CASCADE",   // Se o comentário pai for deletado, deleta as respostas
});

// Uma RESPOSTA (parent_id: 123) pertence a um comentário PAI
Avaliacao.belongsTo(Avaliacao, {
  foreignKey: "parentId",
  as: "pai", // Alias para a associação inversa (boa prática)
});
// --- FIM DA CORREÇÃO ---

export { Usuario, Estabelecimento, Avaliacao, ImagemProduto };