import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import asyncHandler from 'express-async-handler';
import { config } from 'dotenv';
import { getRandomWord, checkWord, closeConnection } from './db';

config();

const PORT = process.env.PORT || 3000;
const app = express();

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 500, // limit each IP to 500 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
});
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error('Error:', err);
	res.status(500).json({ error: 'Internal server error' });
});

app.set('trust proxy', 3);
app.get('/ip', (request, response) => response.send(request.ip));

app.get('/', (req: Request, res: Response) => {
	res.send('Server is running! Go play the game at https://antmic.github.io/diffly/');
});

app.get(
	'/getword',
	asyncHandler(async (req: Request, res: Response) => {
		const result = await getRandomWord();
		res.json({ word: result });
	})
);

app.post(
	'/checkword',
	asyncHandler(async (req: Request, res: Response) => {
		if (typeof req.body.word !== 'string' || req.body.word.trim() === '') {
			res.status(400).json({ error: 'Invalid input' });
			return; // Just return without a value
		}

		const word: string = req.body.word.replace(/[^\p{L}]+/gu, '').toLowerCase();
		const result: boolean = await checkWord(word);
		res.status(200).json({ message: result });
		// No need to return anything here
	})
);

const server = app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

// Handle SIGTERM
process.on('SIGTERM', async () => {
	console.log('SIGTERM signal received: closing HTTP server');

	server.close(async () => {
		closeConnection();
		console.log('HTTP server closed');
	});
});
