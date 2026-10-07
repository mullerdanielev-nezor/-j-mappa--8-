<?php
// Árajánlatkérő űrlap feldolgozása: e-mailt küld (csatolmánnyal), majd a köszönjük oldalra irányít.
// Beállítandó: a címzett és a feladó cím (a feladó a saját domaineden legyen, pl. info@uv4you.hu).

$CIMZETT = 'info@zeuszgroup.hu';
$FELADO  = 'noreply@uv4you.hu';
$MAX_FAJLMERET = 10 * 1024 * 1024; // 10 MB
$ENGEDETT_KITERJESZTESEK = ['jpg', 'jpeg', 'png', 'pdf', 'svg', 'ai', 'eps'];

function hiba($uzenet) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hiba – UV4YOU</title></head>'
       . '<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 80px auto; padding: 0 20px; line-height: 1.55; color: #0b0b12">'
       . '<h1 style="font-size: 28px">Nem sikerült elküldeni</h1><p>' . htmlspecialchars($uzenet) . '</p>'
       . '<p><a href="index.html#ajanlat" style="color: #4a1fd6; font-weight: 700">Vissza az űrlaphoz</a></p></body></html>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.html#ajanlat', true, 303);
    exit;
}

// Spamcsapda: a rejtett mezőt ember nem tölti ki.
if (!empty($_POST['weboldal'])) {
    header('Location: koszonjuk.html', true, 303);
    exit;
}

$egysoros = function ($kulcs) {
    return trim(str_replace(["\r", "\n"], ' ', $_POST[$kulcs] ?? ''));
};
$nev     = $egysoros('nev');
$cegnev  = $egysoros('cegnev');
$telefon = $egysoros('telefon');
$email   = $egysoros('email');
$felulet = $egysoros('felulet');
$darab   = $egysoros('darab');
$leiras  = trim($_POST['leiras'] ?? '');

if ($nev === '' || $telefon === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    hiba('Kérjük, add meg a neved, a telefonszámod és egy érvényes e-mail címet.');
}
if (empty($_POST['gdpr'])) {
    hiba('Az ajánlatkéréshez el kell fogadnod az adatkezelési tájékoztatót.');
}

$szoveg = "Új árajánlatkérés érkezett a weboldalról.\n\n"
        . "Név: $nev\n"
        . "Cégnév: " . ($cegnev !== '' ? $cegnev : '–') . "\n"
        . "Telefon: $telefon\n"
        . "E-mail: $email\n"
        . "Felület: $felulet\n"
        . "Darabszám: $darab\n\n"
        . "Leírás:\n$leiras\n";

$fejlec = "From: UV4YOU weboldal <$FELADO>\r\n"
        . "Reply-To: $email\r\n"
        . "MIME-Version: 1.0\r\n";

$fajl = $_FILES['fajl'] ?? null;
if ($fajl && $fajl['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($fajl['error'] !== UPLOAD_ERR_OK || $fajl['size'] > $MAX_FAJLMERET) {
        hiba('A csatolt fájl túl nagy vagy hibás (legfeljebb 10 MB lehet).');
    }
    $fajlnev = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($fajl['name']));
    $kit = strtolower(pathinfo($fajlnev, PATHINFO_EXTENSION));
    if (!in_array($kit, $ENGEDETT_KITERJESZTESEK, true)) {
        hiba('Ilyen típusú fájlt nem tudunk fogadni. Engedélyezett: ' . implode(', ', $ENGEDETT_KITERJESZTESEK) . '.');
    }
    $hatar = 'uv4you-' . md5(uniqid('', true));
    $fejlec .= "Content-Type: multipart/mixed; boundary=\"$hatar\"\r\n";
    $torzs = "--$hatar\r\n"
           . "Content-Type: text/plain; charset=UTF-8\r\n"
           . "Content-Transfer-Encoding: base64\r\n\r\n"
           . chunk_split(base64_encode($szoveg)) . "\r\n"
           . "--$hatar\r\n"
           . "Content-Type: application/octet-stream; name=\"$fajlnev\"\r\n"
           . "Content-Transfer-Encoding: base64\r\n"
           . "Content-Disposition: attachment; filename=\"$fajlnev\"\r\n\r\n"
           . chunk_split(base64_encode(file_get_contents($fajl['tmp_name']))) . "\r\n"
           . "--$hatar--";
} else {
    $fejlec .= "Content-Type: text/plain; charset=UTF-8\r\n"
             . "Content-Transfer-Encoding: base64\r\n";
    $torzs = chunk_split(base64_encode($szoveg));
}

$targy = '=?UTF-8?B?' . base64_encode("Árajánlatkérés: $nev") . '?=';

if (!mail($CIMZETT, $targy, $torzs, $fejlec)) {
    hiba('Technikai hiba miatt nem tudtuk elküldeni az üzenetet. Kérjük, hívj minket telefonon.');
}

header('Location: koszonjuk.html', true, 303);
exit;
