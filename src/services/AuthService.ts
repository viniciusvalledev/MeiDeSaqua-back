import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Usuario, Avaliacao } from '../entities';
import ProfanityFilter from '../utils/ProfanityFilter';
import EmailService from '../utils/EmailService';
import { IUpdatePasswordRequest, IUpdateProfileRequest } from '../interfaces/requests';

class AuthService {
    
    public async cadastrarUsuario(dadosUsuario: any) {
        if (ProfanityFilter.contemPalavrao(dadosUsuario.username)) {
            throw new Error("Você utilizou palavras inapropriadas no nome de utilizador.");
        }
         const usernameExistente = await Usuario.findOne({ where: { username: dadosUsuario.username, enabled: true } });
        if (usernameExistente) {
            throw new Error("Usuário já cadastrado, use outro e tente novamente.");
        }

        // 2. Verifica o e-mail
        const emailExistente = await Usuario.findOne({ where: { email: dadosUsuario.email } });
        if (emailExistente) {
            // Se o e-mail já existe e a conta está ativa (enabled: true), bloqueia o cadastro.
            if (emailExistente.enabled) {
                throw new Error("Email já cadastrado, use outro e tente novamente.");
            }
            // Se o e-mail existe mas a conta não foi confirmada (enabled: false), remove o registro antigo.
            await emailExistente.destroy();
        }

        const utilizadorExistente = await Usuario.findOne({
            where: { [Op.or]: [{ username: dadosUsuario.username }, { email: dadosUsuario.email }] }
        });

        if (utilizadorExistente) {
            if (utilizadorExistente.username === dadosUsuario.username) throw new Error("Usuário já cadastrado, use outro e tente novamente.");
            if (utilizadorExistente.email === dadosUsuario.email) throw new Error("Email já cadastrado, use outro e tente novamente.");
        }
        
        const senhaCriptografada = await bcrypt.hash(dadosUsuario.password, 10);
        const tokenConfirmacao = uuidv4();

        const novoUtilizador = await Usuario.create({
            nomeCompleto: dadosUsuario.nomeCompleto,
            username: dadosUsuario.username,
            email: dadosUsuario.email,
            password: senhaCriptografada,
            confirmationToken: tokenConfirmacao,
            enabled: false
        });
        
        await EmailService.sendConfirmationEmail(novoUtilizador.email, tokenConfirmacao);

        const { password, ...dadosSeguros } = novoUtilizador.get({ plain: true });
        return dadosSeguros;
    }

    public async login(username: string, pass: string) {
        const utilizador = await Usuario.findOne({ where: { username } });

        if (!utilizador) {
            throw new Error("Usuário ou senha inválidos");
        }

        if (!utilizador.enabled) {
            throw new Error("Sua conta ainda não foi verificada. Por favor, verifique seu e-mail.");
        }

        const isMatch = await bcrypt.compare(pass, utilizador.password);
        if (!isMatch) {
            throw new Error("Usuário ou senha inválidos");
        }

        const token = jwt.sign(
            { id: utilizador.usuarioId, username: utilizador.username },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '1h' }
        );

        const { password, ...dadosSeguros } = utilizador.get({ plain: true });
        return { user: dadosSeguros, token };
    }

    public async confirmUserAccount(token: string) {
        const utilizador = await Usuario.findOne({ where: { confirmationToken: token } });

        if (!utilizador) {
            throw new Error("Token de confirmação inválido ou não encontrado.");
        }

        utilizador.enabled = true;
        utilizador.confirmationToken = null;
        await utilizador.save();
    }

    public async confirmEmailChange(token: string) {
        const utilizador = await Usuario.findOne({ where: { emailChangeToken: token } });

        if (!utilizador || !utilizador.unconfirmedEmail) {
            throw new Error("Token de alteração de e-mail inválido ou não encontrado.");
        }

        utilizador.email = utilizador.unconfirmedEmail;
        utilizador.unconfirmedEmail = null;
        utilizador.emailChangeToken = null;
        await utilizador.save();
    }

    public async forgotPassword(email: string) {
        const utilizador = await Usuario.findOne({ where: { email } });

        if (utilizador) {
            const token = uuidv4();
            utilizador.resetPasswordToken = token;
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + 1);
            utilizador.resetPasswordTokenExpiry = expiryDate;

            await utilizador.save();
            await EmailService.sendPasswordResetEmail(utilizador.email, token);
        }
    }

    public async resetPassword(token: string, newPassword: string) {
        const utilizador = await Usuario.findOne({ where: { resetPasswordToken: token } });

        if (!utilizador || !utilizador.resetPasswordTokenExpiry) {
            throw new Error("Token de redefinição de senha inválido ou expirado.");
        }

        if (utilizador.resetPasswordTokenExpiry < new Date()) {
            throw new Error("Token de redefinição de senha expirado.");
        }

        utilizador.password = await bcrypt.hash(newPassword, 10);
        utilizador.resetPasswordToken = null;
        utilizador.resetPasswordTokenExpiry = null;
        await utilizador.save();
    }

    public async updateUserProfile(userId: number, data: IUpdateProfileRequest) {
        const utilizador = await Usuario.findOne({ where: { usuarioId: userId }});
        if (!utilizador) throw new Error("Utilizador não encontrado.");

        if (data.nomeCompleto) {
            utilizador.nomeCompleto = data.nomeCompleto;
        }

        if (data.username && data.username !== utilizador.username) {
            if (ProfanityFilter.contemPalavrao(data.username)) {
                throw new Error("Você utilizou palavras inapropriadas.");
            }
            const usernameExists = await Usuario.findOne({ where: { username: data.username } });
            if (usernameExists) throw new Error("O novo nome de utilizador já está em uso.");
            utilizador.username = data.username;
        }

        if (data.email && data.email.toLowerCase() !== utilizador.email) {
            const emailExists = await Usuario.findOne({ where: { email: data.email } });
            if (emailExists) throw new Error("O novo e-mail já está em uso por outra conta.");
            
            const token = uuidv4();
            utilizador.unconfirmedEmail = data.email;
            utilizador.emailChangeToken = token;

            await EmailService.sendEmailChangeConfirmationEmail(data.email, token);
        }

        return await utilizador.save();
    }
    
    public async updateUserPassword(userId: number, request: IUpdatePasswordRequest) {
        const utilizador = await Usuario.findOne({ where: { usuarioId: userId } });
        if (!utilizador) throw new Error("Utilizador não encontrado.");
        
        const isMatch = await bcrypt.compare(request.currentPassword, utilizador.password);
        if (!isMatch) {
            throw new Error("A senha atual está incorreta.");
        }

        utilizador.password = await bcrypt.hash(request.newPassword, 10);
        await utilizador.save();
    }

    public async deleteUser(userId: number) {
        const utilizador = await Usuario.findOne({ where: { usuarioId: userId } });
        if (!utilizador) throw new Error("Utilizador não encontrado.");
        
        await Avaliacao.destroy({ where: { usuario_id: utilizador.usuarioId } });
        
        await utilizador.destroy();
    }
}

export default new AuthService();