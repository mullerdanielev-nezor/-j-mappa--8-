// Árajánlatkérő űrlap feldolgozása (Vercel Function).
// E-mailt küld SMTP-n keresztül (csatolmánnyal), majd a köszönjük oldalra irányít.
//
// A Vercel projekt beállításaiban (Settings → Environment Variables) megadandó:
//   SMTP_USER   – a küldő postafiók, pl. info@zeuszgroup.hu
//   SMTP_PASS   – a postafiók jelszava
// Opcionális:
//   SMTP_HOST   – alapértelmezés: mail.zeuszgroup.hu
//   SMTP_PORT   – alapértelmezés: 465 (SSL)
//   CIMZETT     – hova érkezzenek az ajánlatkérések; alapértelmezés: info@zeuszgroup.hu

const Busboy = require('busboy');
const nodemailer = require('nodemailer');

// A Vercel legfeljebb 4,5 MB-os kérést enged, ezért a fájl max. 4 MB lehet.
const MAX_FAJLMERET = 4 * 1024 * 1024;
const ENGEDETT_KITERJESZTESEK = ['jpg', 'jpeg', 'png', 'pdf', 'svg', 'ai', 'eps'];

function hibaOldal(res, statusz, uzenet) {
  const biztonsagos = String(uzenet).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  res.statusCode = statusz;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Hiba – UV4YOU</title></head>' +
    '<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 80px auto; padding: 0 20px; line-height: 1.55; color: #0b0b12">' +
    '<h1 style="font-size: 28px">Nem sikerült elküldeni</h1><p>' + biztonsagos + '</p>' +
    '<p>Hívj minket: <a href="tel:+36203639271" style="color: #4a1fd6; font-weight: 700">+36 20 363 9271</a></p>' +
    '<p><a href="/index.html#ajanlat" style="color: #4a1fd6; font-weight: 700">Vissza az űrlaphoz</a></p></body></html>');
}

function beolvas(req) {
  return new Promise((resolve, reject) => {
    const mezok = {};
    let fajl = null;
    let tulMeret = false;
    const bb = Busboy({ headers: req.headers, defParamCharset: 'utf8', limits: { fileSize: MAX_FAJLMERET, files: 1, fields: 20, fieldSize: 20000 } });
    bb.on('field', (nev, ertek) => { mezok[nev] = ertek; });
    bb.on('file', (nev, stream, info) => {
      if (nev !== 'fajl' || !info.filename) { stream.resume(); return; }
      const darabok = [];
      stream.on('data', (d) => darabok.push(d));
      stream.on('limit', () => { tulMeret = true; });
      stream.on('end', () => { fajl = { nev: info.filename, tipus: info.mimeType, tartalom: Buffer.concat(darabok) }; });
    });
    bb.on('error', reject);
    bb.on('close', () => resolve({ mezok, fajl, tulMeret }));
    req.pipe(bb);
  });
}

const egysoros = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 303;
    res.setHeader('Location', '/index.html#ajanlat');
    return res.end();
  }

  let adat;
  try {
    adat = await beolvas(req);
  } catch (e) {
    return hibaOldal(res, 400, 'Az űrlap adatait nem tudtuk feldolgozni. Kérjük, próbáld újra.');
  }
  const { mezok, fajl, tulMeret } = adat;

  // Spamcsapda: a rejtett mezőt ember nem tölti ki.
  if (mezok.weboldal) {
    res.statusCode = 303;
    res.setHeader('Location', '/koszonjuk.html');
    return res.end();
  }

  const nev = egysoros(mezok.nev);
  const cegnev = egysoros(mezok.cegnev);
  const telefon = egysoros(mezok.telefon);
  const email = egysoros(mezok.email);
  const felulet = egysoros(mezok.felulet);
  const darab = egysoros(mezok.darab);
  const leiras = String(mezok.leiras || '').trim().slice(0, 5000);

  if (!nev || !telefon || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return hibaOldal(res, 400, 'Kérjük, add meg a neved, a telefonszámod és egy érvényes e-mail címet.');
  }
  if (!mezok.gdpr) {
    return hibaOldal(res, 400, 'Az ajánlatkéréshez jelöld be, hogy elolvastad az adatkezelési tájékoztatót.');
  }
  if (tulMeret) {
    return hibaOldal(res, 413, 'A csatolt fájl túl nagy (legfeljebb 4 MB lehet). Nagyobb fájlt az ajánlatunkra válaszolva e-mailben is küldhetsz.');
  }
  let melleklet = [];
  if (fajl && fajl.tartalom.length) {
    const kit = (fajl.nev.split('.').pop() || '').toLowerCase();
    if (!ENGEDETT_KITERJESZTESEK.includes(kit)) {
      return hibaOldal(res, 400, 'Ilyen típusú fájlt nem tudunk fogadni. Engedélyezett: ' + ENGEDETT_KITERJESZTESEK.join(', ') + '.');
    }
    melleklet = [{ filename: fajl.nev.replace(/[^\w.\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ ]/g, '_'), content: fajl.tartalom }];
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('Hiányzó SMTP_USER / SMTP_PASS környezeti változó');
    return hibaOldal(res, 500, 'Technikai hiba miatt most nem tudtuk elküldeni az üzenetet.');
  }

  const szoveg =
    'Új árajánlatkérés érkezett a weboldalról.\n\n' +
    `Név: ${nev}\n` +
    `Cégnév: ${cegnev || '–'}\n` +
    `Telefon: ${telefon}\n` +
    `E-mail: ${email}\n` +
    `Felület: ${felulet || '–'}\n` +
    `Darabszám: ${darab || '–'}\n\n` +
    `Leírás:\n${leiras || '–'}\n`;

  try {
    const port = Number(process.env.SMTP_PORT || 465);
    const szallito = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.zeuszgroup.hu',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await szallito.sendMail({
      from: { name: 'UV4YOU weboldal', address: process.env.SMTP_USER },
      to: process.env.CIMZETT || 'info@zeuszgroup.hu',
      replyTo: { name: nev, address: email },
      subject: `Árajánlatkérés: ${nev}${cegnev ? ' (' + cegnev + ')' : ''}`,
      text: szoveg,
      attachments: melleklet,
    });
  } catch (e) {
    console.error('E-mail küldési hiba:', e.message);
    return hibaOldal(res, 500, 'Technikai hiba miatt most nem tudtuk elküldeni az üzenetet.');
  }

  res.statusCode = 303;
  res.setHeader('Location', '/koszonjuk.html');
  res.end();
};
