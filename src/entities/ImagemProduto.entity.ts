// src/entities/ImagemProduto.entity.ts
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class ImagemProduto extends Model {
  public id!: number;
  public url!: string;
  public estabelecimentoId!: number;
}

ImagemProduto.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // --- CORREÇÃO AQUI ---
  estabelecimentoId: {
    type: DataTypes.INTEGER,
    field: 'estabelecimento_id' // Mapeia para a coluna 'estabelecimento_id' no MySQL
  }
}, {
  sequelize,
  tableName: 'imagens_produto',
  timestamps: false
});

export default ImagemProduto;