import type { Env } from '../../../../types';
import { generateUUID } from '../../../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.sessionId as string;
  const passageIndex = parseInt(context.params.passageIndex as string);
  const db = context.env.read_the_text_db;

  const { selectedAnswer, isCorrect, geminiResponse } = await context.request.json() as {
    selectedAnswer: string;
    isCorrect: boolean;
    geminiResponse: string;
  };

  // Get current attempt number
  const countResult = await db.prepare(`
    SELECT COUNT(*) as count FROM passage_attempts
    WHERE session_id = ? AND passage_index = ?
  `).bind(sessionId, passageIndex).first();

  const attemptNumber = ((countResult?.count as number) || 0) + 1;

  await db.prepare(`
    INSERT INTO passage_attempts (
      id, session_id, passage_index, attempt_number,
      selected_answer, is_correct, gemini_response
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateUUID(), sessionId, passageIndex, attemptNumber,
    selectedAnswer, isCorrect ? 1 : 0, geminiResponse
  ).run();

  return Response.json({ success: true, attemptNumber });
};
