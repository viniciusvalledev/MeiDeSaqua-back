// src/services/EstabelecimentoService.ts
import { Op } from 'sequelize';
import { Estabelecimento, ImagemProduto, Avaliacao } from '../entities';
import FileStorageService from '../utils/FileStorageService';
import sequelize from '../config/database'; // <--- Importação necessária

class EstabelecimentoService {
    public async cadastrarEstabelecimentoComImagens(dto: any) {
        if (dto.cnpj && dto.cnpj.trim() !== '') {
            const cnpjExists = await Estabelecimento.findOne({ where: { cnpj: dto.cnpj } });
            if (cnpjExists) {
                throw new Error("CNPJ já cadastrado no sistema.");
            }
        }
        
        const logoUrl = dto.logoBase64 ? await FileStorageService.saveBase64(dto.logoBase64) : null;

        const novoEstabelecimento = await Estabelecimento.create({ ...dto, logoUrl });

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

    public async listarTodos() {
        return Estabelecimento.findAll({
            include: [
                { model: ImagemProduto, as: 'produtosImg' },
                { model: Avaliacao, attributes: [] }
            ],
            attributes: {
                include: [
                    // Usamos a instância 'sequelize' importada para chamar as funções 'fn' e 'col'.
                    [sequelize.fn('AVG', sequelize.col('avaliacoes.nota')), 'media']
                ]
            },
            group: ['Estabelecimento.estabelecimento_id', 'produtosImg.id']
        });
    }

    public async buscarPorId(id: number) {
        return Estabelecimento.findByPk(id, {
            include: [{ model: ImagemProduto, as: 'produtosImg' }]
        });
    }

    public async buscarPorNome(nome: string) {
        return Estabelecimento.findAll({
            where: {
                nomeFantasia: { [Op.like]: `%${nome}%` }
            },
            include: [{ model: ImagemProduto, as: 'produtosImg' }]
        });
    }
    
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