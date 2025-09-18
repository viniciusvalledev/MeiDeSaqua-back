// src/entities/Proprietario.entity.ts
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Proprietario extends Model {
  public proprietarioId!: number;
  public nomeCompleto!: string;
  public cpf!: string;
  public contatoProprietario!: string;
  public emailProprietario!: string;
  public estabelecimentoId!: number;
}

Proprietario.init({
  proprietarioId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'proprietario_id'
  },
  nomeCompleto: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'nome_completo'
  },
  cpf: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  contatoProprietario: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'contato_proprietario'
  },
  emailProprietario: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'email_proprietario'
  },
  // --- CORREÇÃO AQUI ---
  estabelecimentoId: {
    type: DataTypes.INTEGER,
    field: 'estabelecimento_id' // Mapeia para a coluna 'estabelecimento_id' no MySQL
  }
}, {
  sequelize,
  tableName: 'proprietario',
  timestamps: false
});

export default Proprietario;