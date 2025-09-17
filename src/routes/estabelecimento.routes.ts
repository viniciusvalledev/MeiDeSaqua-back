// src/routes/estabelecimento.routes.ts
import { Router } from 'express';
import EstabelecimentoController from '../controllers/EstabelecimentoController';

const router = Router();

router.get('/', EstabelecimentoController.listarTodos);
router.get('/buscar', EstabelecimentoController.buscarPorNome); // Ex: /buscar?nome=barbearia
router.get('/:id', EstabelecimentoController.buscarPorId);
router.post('/', EstabelecimentoController.cadastrar);
router.post('/:id/status', EstabelecimentoController.alterarStatus);

export default router;