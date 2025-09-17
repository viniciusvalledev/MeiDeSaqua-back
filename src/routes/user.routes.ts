// src/routes/user.routes.ts
import { Router } from 'express';
import UserController from '../controllers/UserController';
// O middleware de autenticação será criado na fase final
// import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de utilizador precisam de autenticação
// router.use(authMiddleware);

router.post('/profile', UserController.updateUserProfile);
router.delete('/profile', UserController.deleteUserProfile);
router.put('/password', UserController.updateUserPassword);

export default router;