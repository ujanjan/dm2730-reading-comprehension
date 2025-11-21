import type { Env } from '../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { nickname } = await context.request.json() as { nickname: string };
  const db = context.env.read_the_text_db;

  const session = await db.prepare(
    'SELECT id, status, current_passage_index, passage_order FROM sessions WHERE nickname = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(nickname).first();

  if (!session) {
    return Response.json({ exists: false });
  }

  return Response.json({
    exists: true,
    sessionId: session.id,
    status: session.status,
    currentPassageIndex: session.current_passage_index,
    passageOrder: JSON.parse(session.passage_order as string)
  });
};
