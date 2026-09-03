import express from 'express';
import type { Request, Response } from 'express';
import { createApp } from './bootstrap';

const server = express();

// A warm container reuses this promise, so Nest boots once per container
// rather than once per request.
let ready: Promise<void> | undefined;

export async function handler(req: Request, res: Response): Promise<void> {
  ready ??= createApp(server).then((app) => app.init().then(() => undefined));
  await ready;
  server(req, res);
}
