import { Op } from 'sequelize';
import { Estabelecimento, ImagemProduto, Avaliacao } from '../entities';
import FileStorageService from '../utils/FileStorageService';
import sequelize from '../config/database';

class EstabelecimentoService {

    public async cadastrarEstabelecimentoComImagens(dto: any) {
        if (dto.cnpj && dto.cnpj.trim() !== '') {
            const cnpjExists = await Estabelecimento.findOne({ where: { cnpj: dto.cnpj } });
            if (cnpjExists) {
                throw new Error("CNPJ já cadastrado no sistema.");
            }
        }
        
        const logoUrl = dto.logoBase64 ? await FileStorageService.saveBase64(dto.logoBase64) : null;

        const novoEstabelecimento = await Estabelecimento.create({
            ...dto,
            logoUrl: logoUrl,
        });

        if (dto.produtosImgBase64 && dto.produtosImgBase64.length > 0) {
            const imagensPromises = dto.produtosImgBase64.map(async (base64Image: string) => {
                const imgUrl = await FileStorageService.saveBase64(base64Image);
                if (imgUrl) {
                    return ImagemProduto.create({
                        url: imgUrl,
                        estabelecimentoId: novoEstabelecimento.estabelecimentoId
                    });
                }
            });
            await Promise.all(imagensPromises);
        }
        
        return novoEstabelecimento;
    }


    /**
     * Lista todos os estabelecimentos.
     */
  public async listarTodos() {
        return Estabelecimento.findAll({
            include: [
                {
                    model: ImagemProduto,
                    as: 'produtosImg',
                    attributes: [], // Não selecionamos nenhuma coluna individual de imagem aqui
                },
                {
                    model: Avaliacao,
                    as: 'avaliacoes', 
                    attributes: [],
                }
            ],
            attributes: {
                // Incluímos todas as colunas da tabela Estabelecimento
                include: [
                    [sequelize.fn('AVG', sequelize.col('avaliacoes.nota')), 'media'],
                    
                    [sequelize.fn('GROUP_CONCAT', sequelize.col('produtosImg.url')), 'produtosImgUrls']
                ],
            },
            group: ['Estabelecimento.estabelecimento_id'],
            order: [['estabelecimento_id', 'DESC']]
        });
    }

    /**
     * Busca um estabelecimento pelo seu ID, incluindo imagens e média.
     */
 public async buscarPorId(id: number) {
        return Estabelecimento.findOne({
            where: { estabelecimentoId: id },
            include: [
                {
                    model: ImagemProduto,
                    as: 'produtosImg',
                    attributes: [],
                },
                {
                    model: Avaliacao,
                    as: 'avaliacoes', 
                    attributes: [],
                }
            ],
            attributes: {
                include: [
                    // Adiciona o cálculo da média
                    [sequelize.fn('AVG', sequelize.col('avaliacoes.nota')), 'media'],
                    // Adiciona a concatenação das imagens
                    [sequelize.fn('GROUP_CONCAT', sequelize.col('produtosImg.url')), 'produtosImgUrls']
                ],
            },
            group: ['Estabelecimento.estabelecimento_id'] // Agrupa para o cálculo funcionar
        });
    }

    /**
     * Busca estabelecimentos por parte do nome fantasia.
     */
    public async buscarPorNome(nome: string) {
        return Estabelecimento.findAll({
            where: {
                nomeFantasia: {
                    [Op.like]: `%${nome}%`
                }
            },
            include: [{ model: ImagemProduto, as: 'produtosImg' }]
        });
    }
    
    /**
     * Altera o status (ativo/inativo) de um estabelecimento.
     */
    public async alterarStatusAtivo(id: number, novoStatus: boolean) {
        const estabelecimento = await Estabelecimento.findByPk(id);
        if (!estabelecimento) {
            throw new Error(`Estabelecimento não encontrado com o ID: ${id}`);
        }
        estabelecimento.ativo = novoStatus;
        return await estabelecimento.save();
    }
}

export default new EstabelecimentoService();