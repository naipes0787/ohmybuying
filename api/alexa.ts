import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SkillBuilders,
  getRequestType,
  getIntentName,
  getSlotValue,
  getUserId,
  getLocale,
  type HandlerInput,
  type RequestHandler,
  type ErrorHandler,
} from 'ask-sdk-core';
import {
  SkillRequestSignatureVerifier,
  TimestampVerifier,
} from 'ask-sdk-express-adapter';

// ---------------------------------------------------------------
// Wiring: Supabase service-role client (server-only).
// Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel env.
// ---------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env',
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------
// Localized strings (en-US + es-ES). Keep messages short — they're spoken.
// ---------------------------------------------------------------
type Locale = 'en' | 'es';

function localeOf(handlerInput: HandlerInput): Locale {
  const raw = getLocale(handlerInput.requestEnvelope) ?? 'en-US';
  return raw.toLowerCase().startsWith('es') ? 'es' : 'en';
}

const STR = {
  en: {
    welcome:
      'Welcome to oh My Buying. You can say: add eggs to my groceries list. What would you like to do?',
    needLink:
      'Your account is not linked yet. Open the oh My Buying app, generate a link code, then say: link with code, followed by the six character code.',
    askWhat: 'What would you like to do?',
    askWhichList: (available: string) => `Which list? You have: ${available}.`,
    addOk: (item: string, list: string) => `Added ${item} to ${list}.`,
    removeOk: (item: string, list: string) =>
      `Removed ${item} from ${list}.`,
    listEmpty: (list: string) => `${list} is empty.`,
    listSummary: (list: string, items: string) =>
      `${list} has ${items}.`,
    noSuchList: (list: string, available: string) =>
      `I couldn't find a list called ${list}. You have: ${available}.`,
    noLists:
      'You don\'t have any lists yet. Open the oh My Buying app to create one.',
    notInList: (item: string, list: string) =>
      `${item} is not on ${list}.`,
    help:
      'Try saying: add eggs, or add eggs to groceries, or what is on my groceries list.',
    bye: 'Goodbye!',
    error: 'Sorry, something went wrong. Please try again.',
    linkOk: 'Your account is now linked. You can ask me to add items.',
    linkBad: 'That code is invalid or has expired. Generate a new one in the app.',
    linkAsk: 'Say: link with code, followed by the six character code.',
  },
  es: {
    welcome:
      'Bienvenido a oh My Buying. Puedes decir: añade huevos a mi lista de compras. ¿Qué quieres hacer?',
    needLink:
      'Tu cuenta no está vinculada. Abre la aplicación oh My Buying, genera un código de vinculación, y di: vincular con código, seguido del código de seis caracteres.',
    askWhat: '¿Qué quieres hacer?',
    askWhichList: (available: string) => `¿En qué lista? Tienes: ${available}.`,
    addOk: (item: string, list: string) => `Añadí ${item} a ${list}.`,
    removeOk: (item: string, list: string) =>
      `Quité ${item} de ${list}.`,
    listEmpty: (list: string) => `${list} está vacía.`,
    listSummary: (list: string, items: string) =>
      `${list} tiene ${items}.`,
    noSuchList: (list: string, available: string) =>
      `No encontré una lista llamada ${list}. Tienes: ${available}.`,
    noLists:
      'Todavía no tienes listas. Abre la aplicación oh My Buying para crear una.',
    notInList: (item: string, list: string) =>
      `${item} no está en ${list}.`,
    help:
      'Prueba diciendo: añade huevos, o añade huevos a compras, o qué hay en mi lista de compras.',
    bye: '¡Adiós!',
    error: 'Lo siento, algo salió mal. Inténtalo de nuevo.',
    linkOk: 'Tu cuenta está vinculada. Ya puedes pedirme añadir cosas.',
    linkBad: 'Ese código no es válido o ha expirado. Genera uno nuevo en la aplicación.',
    linkAsk: 'Di: vincular con código, seguido del código de seis caracteres.',
  },
} as const;

// ---------------------------------------------------------------
// Domain helpers — talk to Supabase as the resolved user.
// ---------------------------------------------------------------
async function resolveUser(alexaUserId: string): Promise<string | null> {
  const sb = adminClient();
  const { data, error } = await sb.rpc('resolve_alexa_user', {
    p_alexa_user_id: alexaUserId,
  });
  if (error) {
    console.error('resolve_alexa_user failed', error);
    return null;
  }
  return (data as string | null) ?? null;
}

interface ListRow {
  id: string;
  name: string;
}


function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function resolveList(
  userId: string,
  spokenName?: string,
): Promise<{ list: ListRow | null; available: ListRow[] }> {
  const sb = adminClient();
  const { data: owned } = await sb
    .from('lists')
    .select('id, name')
    .eq('user_id', userId);
  const { data: memberships } = await sb
    .from('list_members')
    .select('lists(id, name)')
    .eq('user_id', userId);
  const memberRows = (memberships ?? []) as unknown as Array<{
    lists: ListRow | null;
  }>;
  const memberLists = memberRows
    .map((m) => m.lists)
    .filter((l): l is ListRow => Boolean(l));
  const all: ListRow[] = [...(owned ?? []), ...memberLists];

  if (all.length === 0) return { list: null, available: [] };

  // No list spoken — auto-select if only one exists.
  if (!spokenName) {
    return { list: all.length === 1 ? all[0] : null, available: all };
  }

  const target = normalize(spokenName);
  const exact = all.find((l) => normalize(l.name) === target);
  if (exact) return { list: exact, available: all };
  const prefix = all.find((l) => normalize(l.name).startsWith(target));
  if (prefix) return { list: prefix, available: all };
  const contains = all.find((l) => normalize(l.name).includes(target));
  return { list: contains ?? null, available: all };
}

async function findOrCreateItem(
  userId: string,
  title: string,
): Promise<string> {
  const sb = adminClient();
  const target = normalize(title);
  // Try to reuse an existing item the user can see (by exact normalised match).
  const { data: existing } = await sb
    .from('items')
    .select('id, title')
    .eq('user_id', userId)
    .ilike('title', title);
  const reused = (existing ?? []).find((i) => normalize(i.title) === target);
  if (reused) return reused.id;

  const { data: created, error } = await sb
    .from('items')
    .insert({ user_id: userId, title })
    .select('id')
    .single();
  if (error || !created) throw error ?? new Error('Failed to create item');
  return created.id;
}

async function addItemToList(listId: string, itemId: string): Promise<void> {
  const sb = adminClient();
  const { data: existing } = await sb
    .from('list_items')
    .select('id')
    .eq('list_id', listId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (existing) return;
  const { data: maxRow } = await sb
    .from('list_items')
    .select('position')
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;
  const { error } = await sb
    .from('list_items')
    .insert({ list_id: listId, item_id: itemId, position: nextPosition });
  if (error) throw error;
}

async function removeItemFromList(
  listId: string,
  spokenTitle: string,
): Promise<{ removed: boolean; itemTitle: string | null }> {
  const sb = adminClient();
  const target = normalize(spokenTitle);
  const { data: rows } = await sb
    .from('list_items')
    .select('id, item:items(id, title)')
    .eq('list_id', listId);
  type Row = { id: string; item: { id: string; title: string } | null };
  const match = (rows as Row[] | null)?.find(
    (r) => r.item && normalize(r.item.title) === target,
  );
  if (!match || !match.item) return { removed: false, itemTitle: null };
  const { error } = await sb.from('list_items').delete().eq('id', match.id);
  if (error) throw error;
  return { removed: true, itemTitle: match.item.title };
}

async function summariseList(listId: string): Promise<string[]> {
  const sb = adminClient();
  const { data } = await sb
    .from('list_items')
    .select('item:items(title)')
    .eq('list_id', listId)
    .order('position', { ascending: true });
  type Row = { item: { title: string } | null };
  return (data as Row[] | null)
    ?.map((r) => r.item?.title)
    .filter((t): t is string => Boolean(t)) ?? [];
}

// ---------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------
function speak(handlerInput: HandlerInput, text: string, askAgain = true) {
  const builder = handlerInput.responseBuilder.speak(text);
  return askAgain ? builder.reprompt(text).getResponse() : builder.getResponse();
}

const LaunchRequestHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'LaunchRequest',
  async handle(input) {
    const t = STR[localeOf(input)];
    const alexaUserId = getUserId(input.requestEnvelope);
    const linked = await resolveUser(alexaUserId);
    return speak(input, linked ? t.welcome : t.needLink);
  },
};

const AddItemIntentHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    getIntentName(input.requestEnvelope) === 'AddItemIntent',
  async handle(input) {
    const t = STR[localeOf(input)];
    const alexaUserId = getUserId(input.requestEnvelope);
    const userId = await resolveUser(alexaUserId);
    if (!userId) return speak(input, t.needLink);

    const itemSlot = getSlotValue(input.requestEnvelope, 'item');
    if (!itemSlot) return speak(input, t.askWhat);

    const listSlot = getSlotValue(input.requestEnvelope, 'listName') ?? undefined;
    const { list, available } = await resolveList(userId, listSlot);
    if (!list) {
      if (available.length === 0) return speak(input, t.noLists);
      if (!listSlot) return speak(input, t.askWhichList(available.map((l) => l.name).join(', ')));
      return speak(input, t.noSuchList(listSlot, available.map((l) => l.name).join(', ')));
    }
    try {
      const itemId = await findOrCreateItem(userId, itemSlot);
      await addItemToList(list.id, itemId);
      return speak(input, t.addOk(itemSlot, list.name), false);
    } catch (err) {
      console.error('AddItem failed', err);
      return speak(input, t.error, false);
    }
  },
};

const RemoveItemIntentHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    getIntentName(input.requestEnvelope) === 'RemoveItemIntent',
  async handle(input) {
    const t = STR[localeOf(input)];
    const alexaUserId = getUserId(input.requestEnvelope);
    const userId = await resolveUser(alexaUserId);
    if (!userId) return speak(input, t.needLink);

    const itemSlot = getSlotValue(input.requestEnvelope, 'item');
    if (!itemSlot) return speak(input, t.askWhat);

    const listSlot = getSlotValue(input.requestEnvelope, 'listName') ?? undefined;
    const { list, available } = await resolveList(userId, listSlot);
    if (!list) {
      if (available.length === 0) return speak(input, t.noLists);
      if (!listSlot) return speak(input, t.askWhichList(available.map((l) => l.name).join(', ')));
      return speak(input, t.noSuchList(listSlot, available.map((l) => l.name).join(', ')));
    }
    try {
      const { removed, itemTitle } = await removeItemFromList(list.id, itemSlot);
      if (!removed) return speak(input, t.notInList(itemSlot, list.name), false);
      return speak(input, t.removeOk(itemTitle ?? itemSlot, list.name), false);
    } catch (err) {
      console.error('RemoveItem failed', err);
      return speak(input, t.error, false);
    }
  },
};

const ListItemsIntentHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    getIntentName(input.requestEnvelope) === 'ListItemsIntent',
  async handle(input) {
    const t = STR[localeOf(input)];
    const alexaUserId = getUserId(input.requestEnvelope);
    const userId = await resolveUser(alexaUserId);
    if (!userId) return speak(input, t.needLink);

    const listSlot = getSlotValue(input.requestEnvelope, 'listName') ?? undefined;
    const { list, available } = await resolveList(userId, listSlot);
    if (!list) {
      if (available.length === 0) return speak(input, t.noLists);
      if (!listSlot) return speak(input, t.askWhichList(available.map((l) => l.name).join(', ')));
      return speak(input, t.noSuchList(listSlot, available.map((l) => l.name).join(', ')));
    }
    const items = await summariseList(list.id);
    if (items.length === 0) return speak(input, t.listEmpty(list.name), false);
    return speak(input, t.listSummary(list.name, items.join(', ')), false);
  },
};

const LinkWithCodeIntentHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    getIntentName(input.requestEnvelope) === 'LinkWithCodeIntent',
  async handle(input) {
    const t = STR[localeOf(input)];
    const alexaUserId = getUserId(input.requestEnvelope);
    const code = getSlotValue(input.requestEnvelope, 'code');
    if (!code) return speak(input, t.linkAsk);

    const sb = adminClient();
    const { data, error } = await sb.rpc('redeem_alexa_link_code', {
      p_code: code.replace(/\s+/g, '').toUpperCase(),
      p_alexa_user_id: alexaUserId,
    });
    if (error || !data) return speak(input, t.linkBad, false);
    return speak(input, t.linkOk, false);
  },
};

const HelpIntentHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    getIntentName(input.requestEnvelope) === 'AMAZON.HelpIntent',
  handle(input) {
    return speak(input, STR[localeOf(input)].help);
  },
};

const StopIntentHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    (getIntentName(input.requestEnvelope) === 'AMAZON.StopIntent' ||
      getIntentName(input.requestEnvelope) === 'AMAZON.CancelIntent'),
  handle(input) {
    return speak(input, STR[localeOf(input)].bye, false);
  },
};

const SessionEndedRequestHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === 'SessionEndedRequest',
  handle(input) {
    return input.responseBuilder.getResponse();
  },
};

const GenericErrorHandler: ErrorHandler = {
  canHandle: () => true,
  handle(input, error) {
    console.error('Skill error', error);
    return speak(input, STR[localeOf(input)].error, false);
  },
};

const skill = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AddItemIntentHandler,
    RemoveItemIntentHandler,
    ListItemsIntentHandler,
    LinkWithCodeIntentHandler,
    HelpIntentHandler,
    StopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(GenericErrorHandler)
  .create();

// ---------------------------------------------------------------
// Vercel handler — verifies Alexa request signature, then invokes skill.
// We disable Vercel's body parser so we can compute the signature against
// the raw bytes (Alexa's signature is over the exact request body).
// ---------------------------------------------------------------
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  try {
    const raw = await readRawBody(req);
    const bodyStr = raw.toString('utf8');

    // Verify both signature and timestamp before doing ANY work — Amazon
    // requires this at certification time, and skipping it would let anyone
    // POST a fake intent envelope to this endpoint.
    // The simulator sends signed requests so this works in both dev and prod.
    const sigVerifier = new SkillRequestSignatureVerifier();
    const tsVerifier = new TimestampVerifier();
    const headers = req.headers as Record<string, string>;
    try {
      await sigVerifier.verify(bodyStr, headers);
      await tsVerifier.verify(bodyStr);
    } catch (verifyErr) {
      console.error('Alexa signature/timestamp verification failed', verifyErr);
      res.status(400).json({ error: 'Verification failed' });
      return;
    }

    const envelope = JSON.parse(bodyStr);
    const response = await skill.invoke(envelope);
    res.status(200).json(response);
  } catch (err) {
    console.error('Alexa handler error', err);
    // Return a valid Alexa error response so the console shows the spoken error
    // instead of a generic "problem with skill's response".
    res.status(200).json({
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: 'Sorry, something went wrong on the server. Please try again.',
        },
        shouldEndSession: true,
      },
    });
  }
}
