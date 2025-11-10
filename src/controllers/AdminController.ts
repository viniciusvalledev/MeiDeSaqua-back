import { Request, Response } from "express";
import Estabelecimento, {
  StatusEstabelecimento,
} from "../entities/Estabelecimento.entity"; // Alterado de Projeto para Estabelecimento
import *as jwt from "jsonwebtoken";
import ImagemProduto from "../entities/ImagemProduto.entity"; // Alterado de ImagemProjeto para ImagemProduto
import sequelize from "../config/database";
import fs from "fs/promises";
import path from "path";
import EmailService from "../utils/EmailService";
import EstabelecimentoService from "../services/EstabelecimentoService"; // Alterado de ProjetoService para EstabelecimentoService
import Avaliacao from "../entities/Avaliacao.entity";
import Usuario from "../entities/Usuario.entity";
import { ICreateUpdateEstabelecimentoRequest } from "../interfaces/requests"; // Importa a interface correta

// --- ADICIONADO: Validação de variáveis de ambiente ---
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET;

if (!ADMIN_USER || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.error("ERRO CRÍTICO: Variáveis de ambiente do Admin não definidas.");
  console.error(
    "Por favor, defina ADMIN_USER, ADMIN_PASSWORD, e ADMIN_JWT_SECRET"
  );
  console.error(
    "no seu ficheiro .env (ou .env.local) antes de iniciar o servidor."
  );
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  throw new Error(
    "Credenciais de administrador ou segredo JWT não configurados."
  );
}
// --- FIM DA ADIÇÃO ---

export class AdminController {
  // --- FUNÇÃO AUXILIAR DE LIMPEZA DE DADOS (PARA CORRIGIR BUG DO FRONTEND) ---
  /**
   * Limpa o req.body que pode vir com arrays (ex: ["antigo", "novo"])
   * e retorna um objeto com apenas os valores mais recentes (o último do array).
   */
  private static cleanRequestBody(body: any): { [key: string]: any } {
    const cleanedData: { [key: string]: any } = {};
    if (!body) return cleanedData;

    for (const key in body) {
      const value = body[key];
      if (Array.isArray(value)) {
        // Pega o último item (o valor novo/editado)
        cleanedData[key] = value[value.length - 1];
      } else {
        // Se não for array, apenas copia
        cleanedData[key] = value;
      }
    }
    return cleanedData;
  }

  static async login(req: Request, res: Response) {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { username, role: "admin" },
        JWT_SECRET as string,
        {
          expiresIn: "8h",
        }
      );
      return res.json({ success: true, token });
    }

    return res
      .status(401)
      .json({ success: false, message: "Credenciais inválidas" });
  }

  // Mantida a versão do MeiDeSaquá (baseada em Service)
  static async getPending(req: Request, res: Response) {
    try {
      const pendingData = await EstabelecimentoService.listarPendentes();
      return res.json(pendingData);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar solicitações pendentes." });
    }
  }

  // Mantida a versão do MeiDeSaquá (lógica de aprovação já estava correta)
  static async approveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const transaction = await sequelize.transaction();
    let pathsToDeleteApprove: string[] = []; // Array para guardar caminhos de arquivos a deletar

    try {
      let responseMessage = "Solicitação aprovada com sucesso.";

      const estabelecimento = await Estabelecimento.findByPk(id, {
        transaction,
        include: [{ model: ImagemProduto, as: "produtosImg" }],
      });
      if (!estabelecimento) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }
      let emailInfo: { subject: string; html: string } | null = null;

      switch (estabelecimento.status) {
        case StatusEstabelecimento.PENDENTE_APROVACAO:
          estabelecimento.status = StatusEstabelecimento.ATIVO;
          estabelecimento.ativo = true;
          await estabelecimento.save({ transaction });

          emailInfo = {
            subject: "Seu cadastro no MeideSaquá foi Aprovado!",
            html: `
              <h1>Olá, ${estabelecimento.nomeResponsavel}!</h1>
              <p>Temos uma ótima notícia: o seu estabelecimento, <strong>${estabelecimento.nomeFantasia}</strong>, foi aprovado e já está visível na nossa plataforma!</p>
              <p>A partir de agora, clientes podem encontrar o seu negócio e deixar avaliações.</p>
              <p>Agradecemos por fazer parte da comunidade de empreendedores de Saquarema.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe MeideSaquá.</strong></p>
            `,
          };
          break;

        case StatusEstabelecimento.PENDENTE_ATUALIZACAO:
          if (estabelecimento.dados_atualizacao) {
            const dadosRecebidos = estabelecimento.dados_atualizacao as any;
            const dadosParaAtualizar: Partial<Estabelecimento> & {
              [key: string]: any;
            } = {};

            // Lista de campos permitidos (adaptada do "Projeto ODS")
            const camposPermitidos: (keyof ICreateUpdateEstabelecimentoRequest | 'nomeResponsavel' | 'cpfResponsavel' | 'cnae' | 'areasAtuacao')[] = [
                'categoria', 'contatoEstabelecimento',
                'nomeFantasia', 'emailEstabelecimento', 'endereco', 'descricao',
                'descricaoDiferencial', 'tagsInvisiveis', 'website', 'instagram',
                'nomeResponsavel', 'cpfResponsavel',
                'cnae',
                'areasAtuacao'
            ];

            for (const key of camposPermitidos) {
              if (
                dadosRecebidos.hasOwnProperty(key) &&
                dadosRecebidos[key] != null
              ) {
                (dadosParaAtualizar as any)[key] = dadosRecebidos[key];
              }
            }

            // Lógica para LOGO
            if (dadosRecebidos.logo) {
              if (estabelecimento.logoUrl) pathsToDeleteApprove.push(estabelecimento.logoUrl); // Marca logo antiga para deletar
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
            }

            // Lógica para CCMEI
            if (dadosRecebidos.ccmei) {
              if (estabelecimento.ccmeiUrl) pathsToDeleteApprove.push(estabelecimento.ccmeiUrl); // Marca ccmei antigo para deletar
              dadosParaAtualizar.ccmeiUrl = dadosRecebidos.ccmei;
            }

            // Lógica para IMAGENS
            if (
              dadosRecebidos.produtos &&
              Array.isArray(dadosRecebidos.produtos) &&
              dadosRecebidos.produtos.length > 0
            ) {
              const imagensAntigas = await ImagemProduto.findAll({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              imagensAntigas.forEach(img => pathsToDeleteApprove.push(img.url)); // Marca imagens antigas para deletar

              await ImagemProduto.destroy({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              const novasImagens = dadosRecebidos.produtos.map(
                (url: string) => ({
                  url,
                  estabelecimentoId: estabelecimento.estabelecimentoId,
                })
              );
              await ImagemProduto.bulkCreate(novasImagens, { transaction });
            }

            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusEstabelecimento.ATIVO;
            dadosParaAtualizar.ativo = true;

            await estabelecimento.update(dadosParaAtualizar, { transaction });
          } else {
            // Caso não haja dados, apenas reativa
            estabelecimento.dados_atualizacao = null;
            estabelecimento.status = StatusEstabelecimento.ATIVO;
            estabelecimento.ativo = true;
            await estabelecimento.save({ transaction });
          }

          emailInfo = {
            subject: "Sua solicitação de atualização no MeideSaquá foi Aprovada!",
            html: `
              <h1>Olá, ${estabelecimento.nomeResponsavel}!</h1>
              <p>A sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> foi aprovada.</p>
              <p>As novas informações já estão visíveis para todos na plataforma.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe MeideSaquá</strong></p>
            `,
          };
          break;

        case StatusEstabelecimento.PENDENTE_EXCLUSAO:
          emailInfo = {
            subject: "Seu estabelecimento foi removido da plataforma MeideSaquá",
            html: `
              <h1>Olá, ${estabelecimento.nomeResponsavel}.</h1>
              <p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> da nossa plataforma foi concluída com sucesso.</p>
              <p>Lamentamos a sua partida e esperamos poder colaborar com você novamente no futuro.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe MeideSaquá</strong></p>
            `,
          };

          // Coleta todos os arquivos para deletar
          if (estabelecimento.logoUrl) pathsToDeleteApprove.push(estabelecimento.logoUrl);
          if (estabelecimento.ccmeiUrl) pathsToDeleteApprove.push(estabelecimento.ccmeiUrl);
          const imagensExclusao = await ImagemProduto.findAll({
            where: { estabelecimentoId: estabelecimento.estabelecimentoId },
            transaction,
          });
          imagensExclusao.forEach((img) => pathsToDeleteApprove.push(img.url));

          // Deleta associações (Imagens, Avaliações)
          await ImagemProduto.destroy({
            where: { estabelecimentoId: estabelecimento.estabelecimentoId },
            transaction,
          });
          await Avaliacao.destroy({
            where: { estabelecimentoId: estabelecimento.estabelecimentoId },
            transaction,
          });

          // Deleta o estabelecimento
          await estabelecimento.destroy({ transaction });
          responseMessage = "Estabelecimento excluído com sucesso.";
          
          // O break não é necessário se dermos commit e return aqui,
          // mas para manter a lógica de arquivos pós-commit, vamos apenas dar o break.
          break;
      }

      await transaction.commit();

      // --- Deleta arquivos físicos APÓS o commit ---
      for (const relativePath of pathsToDeleteApprove) {
        try {
          if (relativePath) {
            const fullPath = path.resolve(process.cwd(), relativePath);
            await fs.unlink(fullPath);
            console.log(`Arquivo deletado (aprovação): ${fullPath}`);
          }
        } catch (err: any) {
          if (err.code !== 'ENOENT') { // Ignora erro "Arquivo não encontrado"
            console.warn(`AVISO: Falha ao deletar arquivo do disco (aprovação): ${relativePath}`, err);
          }
        }
      }
      
      // Envio de e-mail após o commit
      if (emailInfo && estabelecimento.emailEstabelecimento) {
        try {
          await EmailService.sendGenericEmail({
            to: estabelecimento.emailEstabelecimento,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(
            `Email de notificação enviado com sucesso para ${estabelecimento.emailEstabelecimento}`
          );
        } catch (error) {
          console.error(
            `Falha ao enviar email de notificação para ${estabelecimento.emailEstabelecimento}:`,
            error
          );
        }
      } else if (emailInfo) {
        console.warn(
          `Tentativa de enviar email para estabelecimento ID ${estabelecimento.estabelecimentoId} sem emailEstabelecimento definido.`
        );
      }

      return res.status(200).json({ message: responseMessage });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A APROVAÇÃO:", error);
      return res
        .status(500)
        .json({ message: "Erro ao aprovar a solicitação." });
    }
  }

  // --- MÉTODO REFATORADO (JUNSÃO DE CORREÇÕES + LÓGICA DO 'PROJETO ODS') ---
  static async editAndApproveRequest(req: Request, res: Response) {
    const { id } = req.params;
    
    // --- CORREÇÃO: Limpa o req.body ---
    const cleanedData = AdminController.cleanRequestBody(req.body);
    // --- FIM DA CORREÇÃO ---

    // --- ADICIONADO: Lógica de exclusão de imagens ---
    const { urlsParaExcluir } = cleanedData; // Pega do body limpo
    let pathsToDeleteEditApprove: string[] = [];
    // --- FIM DA ADIÇÃO ---

    const transaction = await sequelize.transaction();

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, {
        transaction,
        include: [{ model: ImagemProduto, as: "produtosImg" }],
      });

      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }
       if (estabelecimento.status === StatusEstabelecimento.PENDENTE_EXCLUSAO) {
        await transaction.rollback();
        return res.status(400).json({ message: "Não é possível editar e aprovar uma solicitação de exclusão." });
      }

      let emailInfo: { subject: string; html: string } | null = null;
      const statusOriginal = estabelecimento.status;
      let dadosPendentes: any = {};

      if (
        statusOriginal === StatusEstabelecimento.PENDENTE_ATUALIZACAO &&
        estabelecimento.dados_atualizacao
      ) {
        dadosPendentes = estabelecimento.dados_atualizacao as any;
      }

      // 1. LÓGICA DE MANIPULAÇÃO DE ARQUIVOS (Refatorada com 'urlsParaExcluir')
      
      // Lógica para LOGO
      // Cenário 1: Admin marcou a logo para DELEÇÃO
      if (
        cleanedData.hasOwnProperty("logoUrl") &&
        cleanedData.logoUrl === null
      ) {
        const logoParaDeletar = estabelecimento.logoUrl || dadosPendentes.logo;
        if (logoParaDeletar) pathsToDeleteEditApprove.push(logoParaDeletar);
        // 'cleanedData.logoUrl' já é null e será salvo
      }
      // Cenário 2: Admin APROVOU uma nova logo (e não a deletou)
      else if (dadosPendentes.logo) {
        if (estabelecimento.logoUrl) pathsToDeleteEditApprove.push(estabelecimento.logoUrl); // Deleta a antiga
        cleanedData.logoUrl = dadosPendentes.logo; // Define a nova
      }

      // Lógica para CCMEI (similar à logo)
      if (
        cleanedData.hasOwnProperty("ccmeiUrl") &&
        cleanedData.ccmeiUrl === null
      ) {
        const ccmeiParaDeletar = estabelecimento.ccmeiUrl || dadosPendentes.ccmei;
        if (ccmeiParaDeletar) pathsToDeleteEditApprove.push(ccmeiParaDeletar);
      }
      else if (dadosPendentes.ccmei) {
        if (estabelecimento.ccmeiUrl) pathsToDeleteEditApprove.push(estabelecimento.ccmeiUrl);
        cleanedData.ccmeiUrl = dadosPendentes.ccmei;
      }

      // Lógica para IMAGENS
      const novasImagensProduto = dadosPendentes.produtos;
      // Cenário 1: Admin APROVOU novas imagens (de dados_atualizacao)
      if (
        novasImagensProduto &&
        Array.isArray(novasImagensProduto) &&
        novasImagensProduto.length > 0
      ) {
        const imagensAntigas = await ImagemProduto.findAll({
          where: { estabelecimentoId: estabelecimento.estabelecimentoId },
          transaction,
        });
        imagensAntigas.forEach(img => pathsToDeleteEditApprove.push(img.url)); // Marca antigas para deletar

        await ImagemProduto.destroy({
          where: { estabelecimentoId: estabelecimento.estabelecimentoId },
          transaction,
        });

        // --- ADICIONADO: Filtra as imagens que o admin marcou para deletar ---
        const imagensParaCriar = novasImagensProduto.filter(
          (url: string) => !(urlsParaExcluir && urlsParaExcluir.includes(url))
        );

        const imagensFormatadas = imagensParaCriar.map((url: string) => ({
          url,
          estabelecimentoId: estabelecimento.estabelecimentoId,
        }));
        await ImagemProduto.bulkCreate(imagensFormatadas, { transaction });
      }
      // Cenário 2: NÃO havia imagens novas, mas admin deletou imagens ANTIGAS
      else if (
        urlsParaExcluir &&
        Array.isArray(urlsParaExcluir) &&
        urlsParaExcluir.length > 0
      ) {
        const imagensParaDeletar = await ImagemProduto.findAll({
          where: {
            url: urlsParaExcluir,
            estabelecimentoId: estabelecimento.estabelecimentoId,
          },
          transaction,
        });

        imagensParaDeletar.forEach(img => pathsToDeleteEditApprove.push(img.url));

        await ImagemProduto.destroy({
          where: {
            id: imagensParaDeletar.map((img) => img.id),
          },
          transaction,
        });
      }
      
      // --- ADICIONADO: Remove a chave 'urlsParaExcluir' ---
      delete cleanedData.urlsParaExcluir;
      // --- FIM DA ADIÇÃO ---

      // 2. APLICA AS ALTERAÇÕES FINAIS (com dados limpos e URLs de arquivos atualizadas)
      await estabelecimento.update(
        {
          ...cleanedData, // Aplica dados editados pelo admin (LIMPOS)
          status: StatusEstabelecimento.ATIVO,
          ativo: true,
          dados_atualizacao: null, // Limpa JSON de pendências
          // Garante que logo/ccmei sejam salvos (seja null, novo ou o antigo)
          logoUrl: cleanedData.logoUrl ?? estabelecimento.logoUrl,
          ccmeiUrl: cleanedData.ccmeiUrl ?? estabelecimento.ccmeiUrl,
        },
        { transaction }
      );

      // 3. LÓGICA DE E-MAIL (adaptada do "Projeto ODS")
      if (statusOriginal === StatusEstabelecimento.PENDENTE_APROVACAO) {
        emailInfo = { 
            subject: "Seu cadastro no MeideSaquá foi Aprovado!", 
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}!</h1> <p>Temos uma ótima notícia: o seu estabelecimento, <strong>${estabelecimento.nomeFantasia}</strong>, foi aprovado (com algumas edições do administrador) e já está visível na nossa plataforma!</p><p>Agradecemos por fazer parte da comunidade de empreendedores de Saquarema.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá.</strong></p>` 
        };
      } else { // PENDENTE_ATUALIZACAO ou ATIVO (caso de edit direto)
        emailInfo = { 
            subject: "Sua solicitação de atualização no MeideSaquá foi Aprovada!", 
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}!</h1><p>A sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> foi aprovada (com algumas edições do administrador).</p><p>As novas informações já estão visíveis para todos na plataforma.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>` 
        };
      }

      await transaction.commit(); // Comita tudo

      // 4. Deleta arquivos antigos APÓS o commit
      for (const relativePath of pathsToDeleteEditApprove) {
         try {
            if (relativePath) {
              const fullPath = path.resolve(process.cwd(), relativePath);
              await fs.unlink(fullPath);
              console.log(`Arquivo deletado (edit/approve): ${fullPath}`);
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
              console.warn(`AVISO: Falha ao deletar arquivo do disco (edit/approve): ${relativePath}`, err);
            }
        }
      }

      if (emailInfo && estabelecimento.emailEstabelecimento) {
        try {
          await EmailService.sendGenericEmail({
            to: estabelecimento.emailEstabelecimento,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
        } catch (error) {
          console.error(
            `Falha ao enviar email de notificação para ${estabelecimento.emailEstabelecimento}:`,
            error
          );
        }
      }

      return res
        .status(200)
        .json({ message: "Estabelecimento editado e aprovado com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A EDIÇÃO E APROVAÇÃO:", error);
      return res
        .status(500)
        .json({ message: "Erro ao editar e aprovar a solicitação." });
    }
  }

  // Mantida a versão do MeiDeSaquá (baseada em Service)
  static async getAllActiveEstabelecimentos(req: Request, res: Response) {
    try {
      const estabelecimentos = await EstabelecimentoService.listarTodos();
      return res.json(estabelecimentos);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar estabelecimentos ativos." });
    }
  }

  // --- MÉTODO REFATORADO (JUNSÃO DE CORREÇÕES + LÓGICA DO 'PROJETO ODS') ---
  static async adminUpdateEstabelecimento(req: Request, res: Response) {
    const { id } = req.params;
    
    // --- CORREÇÃO: Limpa o req.body ---
    const cleanedData = AdminController.cleanRequestBody(req.body);
    // --- FIM DA CORREÇÃO ---

    // --- ADICIONADO: Lógica de exclusão de imagens ---
    const { urlsParaExcluir } = cleanedData;
    let pathsToDeleteUpdate: string[] = [];
    // --- FIM DA ADIÇÃO ---

    const transaction = await sequelize.transaction();

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, { transaction });

      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      // 1. Lógica para Excluir LOGO
      if (
        cleanedData.hasOwnProperty("logoUrl") &&
        cleanedData.logoUrl === null &&
        estabelecimento.logoUrl
      ) {
        pathsToDeleteUpdate.push(estabelecimento.logoUrl);
      }
      
      // 2. Lógica para Excluir CCMEI
      if (
        cleanedData.hasOwnProperty("ccmeiUrl") &&
        cleanedData.ccmeiUrl === null &&
        estabelecimento.ccmeiUrl
      ) {
        pathsToDeleteUpdate.push(estabelecimento.ccmeiUrl);
      }

      // 3. Lógica para Excluir Imagens de Produto
      if (
        urlsParaExcluir &&
        Array.isArray(urlsParaExcluir) &&
        urlsParaExcluir.length > 0
      ) {
        const imagensParaDeletar = await ImagemProduto.findAll({
          where: {
            url: urlsParaExcluir,
            estabelecimentoId: estabelecimento.estabelecimentoId,
          },
          transaction,
        });

        imagensParaDeletar.forEach(img => pathsToDeleteUpdate.push(img.url));

        await ImagemProduto.destroy({
          where: {
            id: imagensParaDeletar.map((img) => img.id),
          },
          transaction,
        });
      }

      // --- REFATORADO: Lista de campos editáveis ---
      // Adicionado logoUrl e ccmeiUrl para permitir que sejam setados para NULL
      const camposEditaveisDireto = [
        'nomeFantasia', 'categoria', 'cnae', 'emailEstabelecimento',
        'contatoEstabelecimento', 'endereco', 'descricao', 'descricaoDiferencial',
        'areasAtuacao', 'tagsInvisiveis', 'website', 'instagram',
        'nomeResponsavel', 'cpfResponsavel', 'ativo',
        'logoUrl', 'ccmeiUrl' // Adicionado
      ];

      let dadosParaUpdate: any = {};
      for (const campo of camposEditaveisDireto) {
        // Usa os dados limpos
        if (cleanedData.hasOwnProperty(campo)) {
          dadosParaUpdate[campo] = cleanedData[campo];
        }
      }

      // Lógica de Status (mantida)
      if (dadosParaUpdate.ativo === false && estabelecimento.ativo === true) {
        dadosParaUpdate.status = StatusEstabelecimento.REJEITADO;
      } else if (dadosParaUpdate.ativo === true && estabelecimento.ativo === false) {
        dadosParaUpdate.status = StatusEstabelecimento.ATIVO;
      }
      
      // Remove a chave 'urlsParaExcluir' antes do update
      delete dadosParaUpdate.urlsParaExcluir; 

      await estabelecimento.update(dadosParaUpdate, { transaction });
      await transaction.commit();

      // --- ADICIONADO: Deleta arquivos físicos APÓS o commit ---
      for (const relativePath of pathsToDeleteUpdate) {
         try {
            if (relativePath) {
              const fullPath = path.resolve(process.cwd(), relativePath);
              await fs.unlink(fullPath);
              console.log(`Arquivo deletado (update admin): ${fullPath}`);
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
              console.warn(`AVISO: Falha ao deletar arquivo do disco (update admin): ${relativePath}`, err);
            }
        }
      }

      return res
        .status(200)
        .json({ message: "Estabelecimento atualizado com sucesso pelo admin." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A ATUALIZAÇÃO ADMIN:", error);
      return res
        .status(500)
        .json({ message: "Erro ao atualizar o estabelecimento." });
    }
  }

  // Mantida a versão do MeiDeSaquá (lógica de deleção já estava completa)
  static async adminDeleteEstabelecimento(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { id } = req.params;
    const transaction = await sequelize.transaction();
    let pathsToDelete: string[] = [];

    try {
      const estabelecimentoIdNum = parseInt(id);
      if (isNaN(estabelecimentoIdNum)) {
        await transaction.rollback();
        return res.status(400).json({ message: "ID do estabelecimento inválido." });
      }

      const estabelecimento = await Estabelecimento.findByPk(
        estabelecimentoIdNum,
        {
          include: [{ model: ImagemProduto, as: "produtosImg" }],
          transaction,
        }
      );

      if (!estabelecimento) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }

      if (estabelecimento.logoUrl) pathsToDelete.push(estabelecimento.logoUrl);
      if (estabelecimento.ccmeiUrl) pathsToDelete.push(estabelecimento.ccmeiUrl);
      const produtosImg = (estabelecimento as any).produtosImg;
      if (produtosImg && Array.isArray(produtosImg) && produtosImg.length > 0) {
        produtosImg.forEach((img: any) => pathsToDelete.push(img.url));
      }

      await Avaliacao.destroy({
        where: { estabelecimentoId: estabelecimentoIdNum },
        transaction,
      });
      await ImagemProduto.destroy({
        where: { estabelecimentoId: estabelecimentoIdNum },
        transaction,
      });
      await estabelecimento.destroy({ transaction });
      await transaction.commit();

      for (const relativePath of pathsToDelete) {
        try {
          if (relativePath) {
            const fullPath = path.resolve(process.cwd(), relativePath);
            await fs.unlink(fullPath);
            console.log(`Arquivo deletado (delete admin): ${fullPath}`);
          }
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            console.warn(
              `AVISO: Falha ao deletar arquivo do disco (delete admin): ${relativePath}`,
              err
            );
          }
        }
      }

      return res
        .status(200)
        .json({ message: "Estabelecimento excluído permanentemente." });
    } catch (error: any) {
      await transaction.rollback();
      console.error("Falha ao excluir estabelecimento (admin):", error);
      return res
        .status(500)
        .json({ message: "Erro interno ao excluir estabelecimento." });
    }
  }

  // Mantida a versão do MeiDeSaquá (nomes corretos)
  static async getAvaliacoesByEstabelecimento(req: Request, res: Response) {
    try {
      const { estabelecimentoId } = req.params;
      const idNum = parseInt(estabelecimentoId);

      if (isNaN(idNum)) {
        return res.status(400).json({ message: "ID do estabelecimento inválido." });
      }

      const estabelecimento = await Estabelecimento.findByPk(idNum, {
        attributes: ["estabelecimentoId", "nomeFantasia"],
      });

      if (!estabelecimento) {
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      const avaliacoes = await Avaliacao.findAll({
        where: { estabelecimentoId: idNum, parentId: null }, // Busca só os pais
        include: [
          {
            model: Usuario,
            as: "usuario",
            attributes: ["usuarioId", "nomeCompleto", "email", "username"],
          },
          { // Inclui as respostas
            model: Avaliacao,
            as: "respostas",
            required: false,
             include: [
              { // E o usuário da resposta
                model: Usuario,
                as: "usuario",
                attributes: ["usuarioId", "nomeCompleto", "email", "username"],
              },
            ],
          }
        ],
        order: [
            ["avaliacoesId", "DESC"],
            [{ model: Avaliacao, as: "respostas" }, "avaliacoesId", "ASC"]
        ],
      });

      return res.json({ estabelecimento, avaliacoes });
    } catch (error) {
      console.error("Erro ao buscar avaliações (admin):", error);
      return res.status(500).json({ message: "Erro ao buscar avaliações." });
    }
  }

  // Mantida a versão do MeiDeSaquá (correta)
  static async adminDeleteAvaliacao(req: Request, res: Response) {
    const { id } = req.params; // ID da Avaliação
    const idNum = parseInt(id);

    if (isNaN(idNum)) {
      return res.status(400).json({ message: "ID da avaliação inválido." });
    }

    try {
      const avaliacao = await Avaliacao.findByPk(idNum);

      if (!avaliacao) {
        return res.status(404).json({ message: "Avaliação não encontrada." });
      }

      // A lógica de 'onDelete: CASCADE' na entidade Avaliacao
      // deve tratar a exclusão das respostas filhas
      await avaliacao.destroy();

      return res
        .status(200)
        .json({ message: "Avaliação excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir avaliação (admin):", error);
      return res.status(500).json({ message: "Erro ao excluir a avaliação." });
    }
  }

  // Mantida a versão do MeiDeSaquá (correta)
  static async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    const { motivoRejeicao } = req.body;
    const transaction = await sequelize.transaction();
    let pathsToDeleteRejeicao: string[] = [];

    const motivoHtml = motivoRejeicao
      ? `<p><strong>Motivo da Rejeição:</strong> ${motivoRejeicao}</p>`
      : "<p>Recomendamos verificar os dados fornecidos ou entrar em contato com a Sala do Empreendedor para mais informações.</p>";

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, { transaction });
      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      let responseMessage = "Solicitação rejeitada com sucesso.";
      let emailInfo: { subject: string; html: string } | null = null;
      const emailParaNotificar = estabelecimento.emailEstabelecimento;

      if (estabelecimento.status === StatusEstabelecimento.PENDENTE_APROVACAO) {
        // Coleta caminhos ANTES de destruir
        if (estabelecimento.logoUrl) pathsToDeleteRejeicao.push(estabelecimento.logoUrl);
        if (estabelecimento.ccmeiUrl) pathsToDeleteRejeicao.push(estabelecimento.ccmeiUrl);
        const imagensRejeicao = await ImagemProduto.findAll({
          where: { estabelecimentoId: estabelecimento.estabelecimentoId },
          transaction,
        });
        imagensRejeicao.forEach((img) =>
          pathsToDeleteRejeicao.push(img.url)
        );

        // Deleta do DB
        await ImagemProduto.destroy({
          where: { estabelecimentoId: estabelecimento.estabelecimentoId },
          transaction,
        });
        await Avaliacao.destroy({ // Garante que avaliações também sejam limpas
           where: { estabelecimentoId: estabelecimento.estabelecimentoId },
           transaction
        });
        await estabelecimento.destroy({ transaction });

        responseMessage = "Cadastro rejeitado e removido.";
        emailInfo = {
          subject: "Seu cadastro no MeideSaquá foi Rejeitado",
          html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Lamentamos informar que o cadastro do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovado.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`,
        };
      } else if (
        estabelecimento.status === StatusEstabelecimento.PENDENTE_ATUALIZACAO ||
        estabelecimento.status === StatusEstabelecimento.PENDENTE_EXCLUSAO
      ) {
        // Coleta caminhos dos arquivos PENDENTES (em dados_atualizacao)
        const dadosRejeitados = estabelecimento.dados_atualizacao as any;
        if (dadosRejeitados) {
          if (dadosRejeitados.logo) pathsToDeleteRejeicao.push(dadosRejeitados.logo);
          if (dadosRejeitados.ccmei) pathsToDeleteRejeicao.push(dadosRejeitados.ccmei);
          if (dadosRejeitados.produtos && Array.isArray(dadosRejeitados.produtos)) {
            pathsToDeleteRejeicao.push(...dadosRejeitados.produtos);
          }
        }

        const statusAnterior = estabelecimento.status;
        estabelecimento.status = StatusEstabelecimento.ATIVO; // Volta para ativo
        estabelecimento.dados_atualizacao = null; // Limpa os dados pendentes
        await estabelecimento.save({ transaction });

        if (statusAnterior === StatusEstabelecimento.PENDENTE_ATUALIZACAO) {
          emailInfo = {
            subject: "Sua solicitação de atualização no MeideSaquá foi Rejeitada",
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Os dados anteriores foram mantidos.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`,
          };
        } else {
          // PENDENTE_EXCLUSAO
          emailInfo = {
            subject: "Sua solicitação de exclusão no MeideSaquá foi Rejeitada",
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Seu estabelecimento continua ativo na plataforma.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`,
          };
        }
      } else {
        await transaction.rollback();
        return res.status(400).json({
          message:
            "O estabelecimento não está em um estado pendente para rejeição.",
        });
      }

      await transaction.commit(); // Comita as alterações no banco

      // Tenta deletar os arquivos APÓS o commit
      for (const relativePath of pathsToDeleteRejeicao) {
        try {
          if (relativePath) {
            const fullPath = path.resolve(process.cwd(), relativePath);
            await fs.unlink(fullPath);
            console.log(`Arquivo deletado (rejeição): ${fullPath}`);
          }
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            console.warn(
              `AVISO: Falha ao deletar arquivo do disco (rejeição): ${relativePath}`,
              err
            );
          }
        }
      }

      if (emailInfo && emailParaNotificar) {
        try {
          await EmailService.sendGenericEmail({
            to: emailParaNotificar,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(
            `Email de rejeição enviado com sucesso para ${emailParaNotificar}`
          );
        } catch (error) {
          console.error(
            `Falha ao enviar email de rejeição para ${emailParaNotificar}:`,
            error
          );
        }
      }

      return res.status(200).json({ message: responseMessage });
    } catch (error) {
      await transaction.rollback();
      console.error("Erro ao rejeitar solicitação:", error);
      return res
        .status(500)
        .json({ message: "Erro ao rejeitar a solicitação." });
    }
  }
}

export default AdminController;