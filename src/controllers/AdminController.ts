import { Request, Response } from "express";
import Estabelecimento, {
  StatusEstabelecimento,
} from "../entities/Estabelecimento.entity";
import * as jwt from "jsonwebtoken";
import ImagemProduto from "../entities/ImagemProduto.entity";
import sequelize from "../config/database"; // Importe a instância do sequelize
import fs from "fs/promises"; // Para deletar arquivos antigos
import path from "path";
import EmailService from "../utils/EmailService";
// Importe a interface para ajudar a definir os campos permitidos
import { ICreateUpdateEstabelecimentoRequest } from "../interfaces/requests"; 

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Senha@Forte123";
const JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "seu-segredo-admin-super-secreto";

export class AdminController {
  static async login(req: Request, res: Response) {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, {
        expiresIn: "8h",
      });
      return res.json({ success: true, token });
    }

    return res
      .status(401)
      .json({ success: false, message: "Credenciais inválidas" });
  }

  static async getPending(req: Request, res: Response) {
    try {
      const includeOptions = {
        model: ImagemProduto,
        as: "produtosImg",
        attributes: ["url"],
      };

      const cadastros = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_APROVACAO },
        include: [includeOptions],
      });
      const atualizacoes = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_ATUALIZACAO },
        include: [includeOptions],
      });
      const exclusoes = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_EXCLUSAO },
        include: [includeOptions],
      });

      return res.json({ cadastros, atualizacoes, exclusoes });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar solicitações pendentes." });
    }
  }

  static async approveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const transaction = await sequelize.transaction();

    try {
      // *** VARIÁVEL DE RESPOSTA DECLARADA AQUI ***
      let responseMessage = "Solicitação aprovada com sucesso.";

      const estabelecimento = await Estabelecimento.findByPk(id, {
        transaction,
        // Incluir ImagemProduto para ter acesso às imagens antigas na transação
        include: [{ model: ImagemProduto, as: 'produtosImg' }] 
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
            
            // *** CORREÇÃO: Inicializa vazio para atualização seletiva ***
            const dadosParaAtualizar: Partial<Estabelecimento> & { [key: string]: any } = {};

             // *** CORREÇÃO: Define quais campos podem vir do 'dados_atualizacao' ***
            // Ajuste esta lista conforme os campos que o usuário pode realmente atualizar
            const camposPermitidos: (keyof ICreateUpdateEstabelecimentoRequest | 'nomeResponsavel' | 'cpfResponsavel' | 'cnae' | 'areasAtuacao')[] = [
                'categoria', 'contatoEstabelecimento', 
                // 'cnpj', // CNPJ geralmente não deve ser atualizável, remova se for o caso
                'nomeFantasia', 'emailEstabelecimento', 'endereco', 'descricao',
                'descricaoDiferencial', 'tagsInvisiveis', 'website', 'instagram',
                'nomeResponsavel', 'cpfResponsavel', // Se vierem de dados_atualizacao
                'cnae', // Se vier de dados_atualizacao
                'areasAtuacao' // Se vier de dados_atualizacao
                // logoUrl e ccmeiUrl são tratados separadamente abaixo
            ];

            // *** CORREÇÃO: Copia apenas os campos permitidos e existentes ***
            for (const key of camposPermitidos) {
                // Verifica se a chave existe em dadosRecebidos e não é nula/undefined
                if (dadosRecebidos.hasOwnProperty(key) && dadosRecebidos[key] != null) {
                   // Atribui o valor ao objeto de atualização
                   (dadosParaAtualizar as any)[key] = dadosRecebidos[key];
                }
            }


            // 1. LÓGICA PARA ATUALIZAR A LOGO (Mantida, mas ajustada)
            if (dadosRecebidos.logo) { // 'logo' no JSON é o NOVO caminho do arquivo
              const logoAntigaUrl = estabelecimento.logoUrl;
              if (logoAntigaUrl) {
                try {
                  const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(`AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`, err);
                }
              }
              // Define o campo correto no objeto de atualização
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
            }
             // Não precisa mais do 'delete dadosParaAtualizar.logo;'

            // LÓGICA SIMILAR PARA CCMEI (se aplicável e vier em dadosRecebidos.ccmei)
             if (dadosRecebidos.ccmei) { // 'ccmei' no JSON é o NOVO caminho
                const ccmeiAntigoUrl = estabelecimento.ccmeiUrl;
                if (ccmeiAntigoUrl) {
                    try {
                        const filePath = path.join(__dirname, "..", "..", ccmeiAntigoUrl);
                        await fs.unlink(filePath);
                    } catch (err) {
                        console.error(`AVISO: Falha ao deletar CCMEI antigo: ${ccmeiAntigoUrl}`, err);
                    }
                }
                dadosParaAtualizar.ccmeiUrl = dadosRecebidos.ccmei;
            }


            // 2. LÓGICA PARA ATUALIZAR AS IMAGENS DE PRODUTOS (Mantida)
            if (
              dadosRecebidos.produtos &&
              Array.isArray(dadosRecebidos.produtos) &&
              dadosRecebidos.produtos.length > 0 // Garante que há novas imagens
            ) {
              // Re-busca as imagens antigas DENTRO da transação para garantir consistência
              const imagensAntigas = await ImagemProduto.findAll({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              // Deleta os arquivos antigos
              for (const imagem of imagensAntigas) {
                try {
                  const filePath = path.join(__dirname, "..", "..", imagem.url);
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(`AVISO: Falha ao deletar arquivo antigo: ${imagem.url}`, err);
                }
              }

              // Deleta as referências antigas no banco (DENTRO da transação)
              await ImagemProduto.destroy({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              // Cria as novas referências no banco (DENTRO da transação)
              const novasImagens = dadosRecebidos.produtos.map(
                (url: string) => ({
                  url,
                  estabelecimentoId: estabelecimento.estabelecimentoId,
                })
              );
              await ImagemProduto.bulkCreate(novasImagens, { transaction });
            }
            // Não precisa mais do 'delete dadosParaAtualizar.produtos;'


            // 3. ATUALIZA O STATUS E LIMPA OS DADOS TEMPORÁRIOS (no objeto a ser atualizado)
            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusEstabelecimento.ATIVO;
            dadosParaAtualizar.ativo = true; // Garante que fique ativo após a atualização

            // 4. APLICA AS MUDANÇAS NO BANCO (com os dados filtrados)
            await estabelecimento.update(dadosParaAtualizar, { transaction });

          } else {
            // Caso não hajam dados (solicitação vazia?), apenas reativa e limpa
            estabelecimento.dados_atualizacao = null;
            estabelecimento.status = StatusEstabelecimento.ATIVO;
            estabelecimento.ativo = true; // Garante que fique ativo
            await estabelecimento.save({ transaction });
          }
          
          // Prepara informações para o email de confirmação
          emailInfo = {
            subject:
              "Sua solicitação de atualização no MeideSaquá foi Aprovada!",
            html: `
            <h1>Olá, ${estabelecimento.nomeResponsavel}!</h1>
            <p>A sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> foi aprovada.</p>
            <p>As novas informações já estão visíveis para todos na plataforma.</p>
            <br>
            <p>Atenciosamente,</p>
            <p><strong>Equipe MeideSaquá</strong></p>
          `,
          };
          break; // Fim do case PENDENTE_ATUALIZACAO

        case StatusEstabelecimento.PENDENTE_EXCLUSAO:
          // Lógica de exclusão permanece a mesma
          emailInfo = {
            subject:
              "Seu estabelecimento foi removido da plataforma MeideSaquá",
            html: `
            <h1>Olá, ${estabelecimento.nomeResponsavel}.</h1>
            <p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> da nossa plataforma foi concluída com sucesso.</p>
            <p>Lamentamos a sua partida e esperamos poder colaborar com você novamente no futuro.</p>
            <br>
            <p>Atenciosamente,</p>
            <p><strong>Equipe MeideSaquá</strong></p>
          `,
          };
          // Importante: O destroy remove o registro, incluindo associações em cascata se configurado.
          // Certifique-se de que a exclusão de Estabelecimento NÃO cause exclusão em cascata de Avaliacao se não for desejado.
          // Se Avaliacao tiver onDelete: 'CASCADE' na definição da foreign key, ela será excluída.
          // Se for onDelete: 'SET NULL' ou 'NO ACTION', ela será mantida (mas pode ficar órfã).
          await estabelecimento.destroy({ transaction }); 
          responseMessage = "Estabelecimento excluído com sucesso.";
          break; 
      } // Fim do switch

      // Se tudo deu certo, efetiva as mudanças
      await transaction.commit();

      // Envio do e-mail (fora da transação)
      if (emailInfo && estabelecimento.emailEstabelecimento) { // Verifica se o email existe antes de tentar enviar
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
          // Considerar logar isso de forma mais robusta ou usar um sistema de filas para re-tentativa
        }
      } else if (emailInfo) {
          console.warn(`Tentativa de enviar email para estabelecimento ID ${estabelecimento.estabelecimentoId} sem endereço de email definido.`);
      }


      // *** RESPOSTA FINAL USA A VARIÁVEL ***
      return res
        .status(200)
        .json({ message: responseMessage });
        
    } catch (error) {
      // Rollback em caso de erro
      await transaction.rollback(); 
      console.error("ERRO DURANTE A APROVAÇÃO:", error);
      // Aqui, idealmente, você também deveria tentar deletar os *novos* arquivos que foram movidos
      // antes do erro ocorrer na transação, para não deixar lixo no sistema de arquivos.
      // Isso requer que a lógica de tratamento de arquivos retorne os caminhos dos novos arquivos.
      return res
        .status(500)
        .json({ message: "Erro ao aprovar a solicitação." });
    }
  }

  static async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    const transaction = await sequelize.transaction(); // Use transação para segurança
    try {
      const estabelecimento = await Estabelecimento.findByPk(id, { transaction });
      if (!estabelecimento) {
         await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }

      let responseMessage = "Solicitação rejeitada com sucesso.";
      let emailInfo: { subject: string; html: string } | null = null;
      const emailParaNotificar = estabelecimento.emailEstabelecimento; // Guarda antes de qualquer mudança


      // Se for rejeição de CADASTRO, deleta o registro e os arquivos associados
      if (estabelecimento.status === StatusEstabelecimento.PENDENTE_APROVACAO) {
          
          // TODO: Adicionar lógica para deletar arquivos (logo, ccmei, produtos) associados a ESTE estabelecimento
          // antes de destruir o registro no banco. Ex:
          // if (estabelecimento.logoUrl) await fs.unlink(path.join(__dirname, "..", "..", estabelecimento.logoUrl)).catch(e => console.error(e));
          // if (estabelecimento.ccmeiUrl) await fs.unlink(path.join(__dirname, "..", "..", estabelecimento.ccmeiUrl)).catch(e => console.error(e));
          // const imagens = await ImagemProduto.findAll({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });
          // for (const img of imagens) { await fs.unlink(path.join(__dirname, "..", "..", img.url)).catch(e => console.error(e)); }
          // await ImagemProduto.destroy({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });

          await estabelecimento.destroy({ transaction });
          responseMessage = "Cadastro rejeitado e removido.";
          
          // Email para cadastro rejeitado
          emailInfo = {
            subject: "Seu cadastro no MeideSaquá foi Rejeitado",
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Lamentamos informar que o cadastro do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovado.</p><p>Recomendamos verificar os dados fornecidos ou entrar em contato com a Sala do Empreendedor para mais informações.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`
          };

      } 
      // Se for rejeição de ATUALIZAÇÃO ou EXCLUSÃO, apenas volta ao status ATIVO e limpa dados_atualizacao
      else if (estabelecimento.status === StatusEstabelecimento.PENDENTE_ATUALIZACAO || estabelecimento.status === StatusEstabelecimento.PENDENTE_EXCLUSAO) {
          
          // TODO: Adicionar lógica para deletar os arquivos temporários que estavam em `dados_atualizacao`, se houver.
          // Ex: const dadosRejeitados = estabelecimento.dados_atualizacao as any;
          // if (dadosRejeitados?.logo) await fs.unlink(path.join(__dirname, "..", "..", dadosRejeitados.logo)).catch(e => console.error(e));
          // if (dadosRejeitados?.ccmei) await fs.unlink(path.join(__dirname, "..", "..", dadosRejeitados.ccmei)).catch(e => console.error(e));
          // if (dadosRejeitados?.produtos) { for (const url of dadosRejeitados.produtos) { await fs.unlink(path.join(__dirname, "..", "..", url)).catch(e => console.error(e)); } }

          const statusAnterior = estabelecimento.status; // Guarda para o email
          estabelecimento.status = StatusEstabelecimento.ATIVO;
          estabelecimento.dados_atualizacao = null;
          await estabelecimento.save({ transaction }); // Salva dentro da transação

           // Email para atualização/exclusão rejeitada
          if (statusAnterior === StatusEstabelecimento.PENDENTE_ATUALIZACAO) {
            emailInfo = {
              subject: "Sua solicitação de atualização no MeideSaquá foi Rejeitada",
              html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Os dados anteriores foram mantidos. Entre em contato conosco se precisar de esclarecimentos.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`
            };
          } else { // PENDENTE_EXCLUSAO
             emailInfo = {
              subject: "Sua solicitação de exclusão no MeideSaquá foi Rejeitada",
              html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Seu estabelecimento continua ativo na plataforma. Entre em contato conosco se precisar de esclarecimentos.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`
            };
          }

      } else {
          // Se o status não for pendente, não faz nada ou retorna erro?
          // Por segurança, vamos apenas fazer rollback e informar.
          await transaction.rollback();
          return res.status(400).json({ message: "O estabelecimento não está em um estado pendente para rejeição." });
      }

      await transaction.commit(); // Comita as alterações no banco

       // Envio do e-mail de rejeição (fora da transação)
      if (emailInfo && emailParaNotificar) {
        try {
          await EmailService.sendGenericEmail({
            to: emailParaNotificar,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(`Email de rejeição enviado com sucesso para ${emailParaNotificar}`);
        } catch (error) {
          console.error(`Falha ao enviar email de rejeição para ${emailParaNotificar}:`, error);
        }
      }

      return res
        .status(200)
        .json({ message: responseMessage });

    } catch (error) {
       await transaction.rollback(); // Garante rollback em caso de erro inesperado
      console.error("Erro ao rejeitar solicitação:", error);
      return res
        .status(500)
        .json({ message: "Erro ao rejeitar a solicitação." });
    }
  }
}