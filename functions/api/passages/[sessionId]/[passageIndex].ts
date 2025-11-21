import type { Env } from '../../../types';
import { base64ToArrayBuffer, generateUUID } from '../../../types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.sessionId as string;
  const passageIndex = parseInt(context.params.passageIndex as string);
  const db = context.env.read_the_text_db;
  const storage = context.env.read_the_text_storage;

  const body = await context.request.json() as {
    passageId: number;
    screenshot: string;
    cursorHistory: any[];
    wrongAttempts: number;
    timeSpentMs: number;
    selectedAnswer: string;
  };

  const {
    passageId,
    screenshot,
    cursorHistory,
    wrongAttempts,
    timeSpentMs,
    selectedAnswer
  } = body;

  // Upload screenshot to R2
  const screenshotKey = `sessions/${sessionId}/passage_${passageIndex}_screenshot.jpg`;
  if (screenshot) {
    const screenshotData = base64ToArrayBuffer(screenshot.split(',')[1]);
    await storage.put(screenshotKey, screenshotData, {
      httpMetadata: { contentType: 'image/jpeg' }
    });
  }

  // Upload cursor history to R2
  const cursorKey = `sessions/${sessionId}/passage_${passageIndex}_cursor.json`;
  if (cursorHistory) {
    await storage.put(cursorKey, JSON.stringify(cursorHistory), {
      httpMetadata: { contentType: 'application/json' }
    });
  }

  // Upsert passage result
  const resultId = generateUUID();
  await db.prepare(`
    INSERT INTO passage_results (
      id, session_id, passage_index, passage_id,
      screenshot_r2_key, cursor_history_r2_key,
      is_complete, wrong_attempts, time_spent_ms, final_selected_answer, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_id, passage_index) DO UPDATE SET
      screenshot_r2_key = excluded.screenshot_r2_key,
      cursor_history_r2_key = excluded.cursor_history_r2_key,
      is_complete = 1,
      wrong_attempts = excluded.wrong_attempts,
      time_spent_ms = excluded.time_spent_ms,
      final_selected_answer = excluded.final_selected_answer,
      updated_at = datetime('now')
  `).bind(
    resultId, sessionId, passageIndex, passageId,
    screenshotKey, cursorKey,
    wrongAttempts, timeSpentMs, selectedAnswer
  ).run();

  // Update session current passage index
  await db.prepare(`
    UPDATE sessions SET current_passage_index = ? WHERE id = ?
  `).bind(passageIndex + 1, sessionId).run();

  return Response.json({ success: true });
};
