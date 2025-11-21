import type { Env } from '../../types';
import { shuffleArray, generateUUID } from '../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { nickname } = await context.request.json() as { nickname: string };
  const db = context.env.read_the_text_db;

  const sessionId = generateUUID();
  const passageOrder = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  await db.prepare(`
    INSERT INTO sessions (id, nickname, passage_order, total_passages)
    VALUES (?, ?, ?, 10)
  `).bind(sessionId, nickname, JSON.stringify(passageOrder)).run();

  return Response.json({
    sessionId,
    passageOrder,
    resultUrl: `/results/${sessionId}`
  });
};
