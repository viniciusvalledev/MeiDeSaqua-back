// src/entities/Estabelecimento.entity.ts
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Estabelecimento extends Model {
  public estabelecimentoId!: number;
  public categoria!: string;
  public contatoEstabelecimento!: string;
  public cnpj!: string;
  public nomeFantasia!: string;
  public emailEstabelecimento!: string;
  public endereco!: string;
  public descricao!: string;
  public descricaoDiferencial!: string;
  public especialidade!: string;
  public tagsInvisiveis!: string;
  public coordenadas!: string;
  public website!: string;
  public instagram!: string;
  public ativo!: boolean;
  public logoUrl!: string;
}

Estabelecimento.init({
  estabelecimentoId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'estabelecimento_id'
  },
  categoria: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contatoEstabelecimento: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'contato_estabelecimento'
  },
  cnpj: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  nomeFantasia: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'nome_fantasia'
  },
  emailEstabelecimento: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'email_estabelecimento'
  },
  endereco: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  descricaoDiferencial: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'descricao_diferencial'
  },
  especialidade: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tagsInvisiveis: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'tags_invisiveis'
  },
  coordenadas: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  instagram: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  logoUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'logoUrl'
  }
}, {
  sequelize,
  tableName: 'estabelecimentos',
  timestamps: false
});

export default Estabelecimento;