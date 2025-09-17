// src/services/ProprietarioService.ts
import { Proprietario } from '../entities';

class ProprietarioService {
    /**
     * Cadastra um novo proprietário.
     */
    public async cadastrarProprietario(dadosProprietario: any) {
        const { cpf } = dadosProprietario;
        if (cpf) {
            const proprietarioExistente = await Proprietario.findOne({ where: { cpf } });
            if (proprietarioExistente) {
                throw new Error("CPF já cadastrado no sistema.");
            }
        }
        return Proprietario.create(dadosProprietario);
    }
}

export default new ProprietarioService();