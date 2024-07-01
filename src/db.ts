// src/db.ts
// Database functions

import { config } from 'dotenv';
import postgres from 'postgres';

config();

let sql: postgres.Sql | null = null;
let winningWordsCount: postgres.RowList<postgres.Row[]>;

// Lazy connection function
const getConnection = async () => {
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
	}
	return sql;
};

const closeConnection = async () => {
	try {
		if (sql) {
			await sql.end();
			console.log('Database connection closed');
		}
	} catch (err) {
		console.error('Error closing database connection:', err);
	}
};

// Number of winning words needed for random word selection
const getWinningWordsCount = async (): Promise<postgres.RowList<postgres.Row[]>> => {
	if (!winningWordsCount) {
		const sql = await getConnection();
		winningWordsCount = await sql`SELECT COUNT(*) FROM words WHERE winning = true`;
	}
	return winningWordsCount;
};

const getRandomWord = async (): Promise<string> => {
	const sql = await getConnection();
	const winningWordsCount = await getWinningWordsCount();
	const randomOffset = Math.floor(Math.random() * winningWordsCount[0].count);
	const result = await sql`SELECT word FROM words WHERE winning = true OFFSET ${randomOffset} LIMIT 1`;
	return result[0].word;
};

const checkWord = async (word: string): Promise<boolean> => {
	const sql = await getConnection();
	const result = await sql`SELECT EXISTS (SELECT 1 FROM words WHERE word = ${word})`;
	return result[0].exists;
};

export { closeConnection, getRandomWord, checkWord };
