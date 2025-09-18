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
  },
  // --- CORREÇÃO AQUI ---
  // Mapeamos explicitamente as colunas do banco de dados para as propriedades do modelo.
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id' // Mapeia para a coluna 'usuario_id' no MySQL
  },
  estabelecimentoId: {
    type: DataTypes.INTEGER,
    field: 'estabelecimento_id' // Mapeia para a coluna 'estabelecimento_id' no MySQL
  }
}, {
  sequelize,
  tableName: 'avaliacoes',
  timestamps: false
});

export default Avaliacao;