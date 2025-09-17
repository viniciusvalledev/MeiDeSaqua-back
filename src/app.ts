// src/app.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do ficheiro .env.local 
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

// Importa todas as suas rotas
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import avaliacaoRoutes from './routes/avaliacao.routes';
import estabelecimentoRoutes from './routes/estabelecimento.routes';
import proprietarioRoutes from './routes/proprietario.routes';
import fileRoutes from './routes/file.routes';
import { authMiddleware } from './middlewares/auth.middleware';

// Carrega as variáveis de ambiente do ficheiro .env
dotenv.config();

const app = express();

// Middlewares essenciais
app.use(cors()); // Habilita o CORS para permitir requisições do seu front-end
app.use(express.json({ limit: '50mb' })); // Permite que a API entenda JSON no corpo das requisições (com limite maior para imagens base64)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir ficheiros estáticos (imagens da pasta uploads)
// Equivalente ao addResourceHandlers do seu WebConfig
app.use('/images', express.static(path.resolve(__dirname, '..', 'uploads')));

// Registo das Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/estabelecimentos', estabelecimentoRoutes);
app.use('/api/proprietarios', proprietarioRoutes);
app.use('/api/avaliacoes', avaliacaoRoutes);
app.use('/api/files', fileRoutes);

// Para as rotas de utilizador, aplicamos o middleware de autenticação
app.use('/api/users', authMiddleware, userRoutes);

export default app;