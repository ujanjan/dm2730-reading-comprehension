import type { Env } from '../../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string;
  const { totalTimeMs } = await context.request.json() as { totalTimeMs: number };
  const db = context.env.read_the_text_db;

  await db.prepare(`
    UPDATE sessions
    SET status = 'completed',
        completed_at = datetime('now'),
        total_time_ms = ?
    WHERE id = ?
  `).bind(totalTimeMs, sessionId).run();

  return Response.json({ success: true });
};
