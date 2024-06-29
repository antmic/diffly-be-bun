import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import postgres from 'postgres';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import asyncHandler from 'express-async-handler';
import { config } from 'dotenv';

config();

const PORT = process.env.PORT || 3000;

let sql: postgres.Sql | null = null;
let dbCountResult: postgres.RowList<postgres.Row[]>;

// Lazy connection function
async function getConnection() {
	if (!sql) {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) {
			throw new Error('DATABASE_URL is not defined');
		}

		sql = postgres(connectionString, {
			max: 10,
			idle_timeout: 30,
			onnotice: notice => console.warn('Notice:', notice.message),
		});
		console.log('Database connection established');
		dbCountResult = await sql`SELECT COUNT(*) FROM words WHERE winning = true`;
	}
	return sql;
}

console.log('Connected to the database');

const randomWordDB = async (): Promise<string> => {
	const sql = await getConnection();
	const randomOffset = Math.floor(Math.random() * dbCountResult[0].count);
	const result = await sql`SELECT word FROM words WHERE winning = true OFFSET ${randomOffset} LIMIT 1`;
	return result[0].word;
};

const checkWordDB = async (word: string): Promise<boolean> => {
	const sql = await getConnection();
	const result = await sql`SELECT EXISTS (SELECT 1 FROM words WHERE word = ${word})`;
	return result[0].exists;
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(helmet());

// Set up trust proxy
app.set('trust proxy', 2);
app.get('/ip', (request, response) => response.send(request.ip));

// Set up rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 500, // limit each IP to 500 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
});

app.use(limiter);

app.get('/', (req: Request, res: Response) => {
	res.send('Server is running! Go play the game at https://antmic.github.io/diffly/');
});

app.get(
	'/getword',
	asyncHandler(async (req: Request, res: Response) => {
		const result = await randomWordDB();
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

		const removeNonLetters = (str: string) => str.replace(/[^\p{L}]+/gu, '');
		const word: string = removeNonLetters(req.body.word).toLowerCase();
		const result: boolean = await checkWordDB(word);
		res.status(200).json({ message: result });
		// No need to return anything here
	})
);

// Error-handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error('Error:', err);
	res.status(500).json({ error: 'Internal server error' });
	// No need to return anything here
});

const server = app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

// Handle SIGTERM
process.on('SIGTERM', async () => {
	console.log('SIGTERM signal received: closing HTTP server');

	// Stop accepting new requests
	server.close(async () => {
		console.log('HTTP server closed');

		// Close the database connection
		try {
			if (sql) {
				await sql.end();
				console.log('Database connection closed');
			}
		} catch (err) {
			console.error('Error closing database connection:', err);
		}
	});
});
