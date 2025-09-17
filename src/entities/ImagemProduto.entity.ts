// src/entities/ImagemProduto.entity.ts
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class ImagemProduto extends Model {
  public id!: number;
  public url!: string;

  // Chave estrangeira para Estabelecimento será adicionada depois
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
  }
}, {
  sequelize,
  tableName: 'imagens_produto',
  timestamps: false
});

export default ImagemProduto;