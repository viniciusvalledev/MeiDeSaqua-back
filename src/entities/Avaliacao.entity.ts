// ARQUIVO: src/entities/Avaliacao.entity.ts (CORRIGIDO)

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Avaliacao extends Model {
  public avaliacoesId!: number;
  public comentario!: string;
  public nota!: number | null;
  public usuarioId!: number;
  public estabelecimentoId!: number;
  
  // --- ADICIONADO ---
  public parentId!: number | null; 
}

Avaliacao.init({
  avaliacoesId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'avaliacoes_id'
  },
  comentario: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  nota: {
    type: DataTypes.DOUBLE,
    allowNull: false // A nota só é obrigatória para o comentário pai
  },

  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id' 
  },
  estabelecimentoId: {
    type: DataTypes.INTEGER,
    field: 'estabelecimento_id'
  },

  // --- ADICIONADO ---
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Permite nulo (para comentários que NÃO são respostas)
    field: 'parent_id',
    references: {
      model: 'avaliacoes', // Nome da tabela
      key: 'avaliacoes_id' // Chave primária da tabela
    }
  }
}, {
  sequelize,
  tableName: 'avaliacoes',
  timestamps: false
});

export default Avaliacao;