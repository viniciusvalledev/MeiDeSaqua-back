// src/entities/Avaliacao.entity.ts
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Avaliacao extends Model {
  public avaliacoesId!: number;
  public comentario!: string;
  public nota!: number;

  public usuarioId!: number;
  public estabelecimentoId!: number;
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
    allowNull: false
  }
  // As colunas 'usuarioId' e 'estabelecimentoId' são adicionadas automaticamente
  // pelo Sequelize quando definimos os relacionamentos no index.ts
}, {
  sequelize,
  tableName: 'avaliacoes',
  timestamps: false
});

export default Avaliacao;