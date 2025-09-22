import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';


dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import avaliacaoRoutes from './routes/avaliacao.routes';
import estabelecimentoRoutes from './routes/estabelecimento.routes';
import proprietarioRoutes from './routes/proprietario.routes';
import fileRoutes from './routes/file.routes';
import { authMiddleware } from './middlewares/auth.middleware';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


app.use('/images', express.static(path.resolve(__dirname, '..', 'uploads')));


app.use('/api/auth', authRoutes);
app.use('/api/estabelecimentos', estabelecimentoRoutes);
app.use('/api/proprietarios', proprietarioRoutes);
app.use('/api/avaliacoes', avaliacaoRoutes);
app.use('/api/files', fileRoutes);


app.use('/api/users', authMiddleware, userRoutes);

export default app;