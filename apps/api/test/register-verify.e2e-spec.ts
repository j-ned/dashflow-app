import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startApi, type E2eApi } from './e2e/api-server';
import { authKey } from './auth-key';

// Fichier à part : chaque fichier e2e a son propre processus API, donc ses propres compteurs
// de throttling (inscription, vérification et connexion sont limitées à 10 par 15 min et par IP).
describe('Inscription : la vérification fixe le mot de passe (e2e)', () => {
  let api: E2eApi;

  beforeAll(async () => {
    api = await startApi();
  });

  afterAll(async () => {
    await api?.stop();
  });

  it('inscription disputée : celui qui saisit le code choisit le mot de passe, un réinscrit entre-temps ne garde pas la main', async () => {
    const server = api.url;
    const target = `e2e-race+${Date.now()}@dashflow.test`;
    const victim = authKey('mot-de-passe-victime-12');
    const attacker = authKey('mot-de-passe-attaquant-12');
    await request(server)
      .post('/auth/register')
      .send({ email: target, password: victim })
      .expect(201);
    // L'attaquant se réinscrit avant que la victime saisisse son code : un nouveau code part
    // dans la boîte de la victime, à laquelle l'attaquant n'a pas accès.
    await request(server)
      .post('/auth/register')
      .send({ email: target, password: attacker })
      .expect(201);

    await request(server)
      .post('/auth/verify')
      .send({ email: target, code: api.mail.lastCode, password: victim })
      .expect(200);

    await request(server)
      .post('/auth/login')
      .send({ email: target, password: attacker })
      .expect(401);
    await request(server)
      .post('/auth/login')
      .send({ email: target, password: victim })
      .expect(200);
  });

  it('vérification sans le mot de passe de l’inscription → 400, le code reste utilisable', async () => {
    const server = api.url;
    const target = `e2e-nopw+${Date.now()}@dashflow.test`;
    const key = authKey('motdepasse-long-12');
    await request(server)
      .post('/auth/register')
      .send({ email: target, password: key })
      .expect(201);
    const code = api.mail.lastCode;

    await request(server)
      .post('/auth/verify')
      .send({ email: target, code })
      .expect(400);

    await request(server)
      .post('/auth/verify')
      .send({ email: target, code, password: key })
      .expect(200);
  });
});
