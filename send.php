<?php
/**
 * Приём заявок с сайта и отправка на почту.
 *
 * Принимает POST JSON от js/cart.js:
 *   type      order | callback
 *   name, phone, email, comment
 *   items     [{ name, cat, grade, qty, unit, note }]  — только для order
 *   website   ловушка для ботов (должно быть пусто)
 *   elapsed   сколько мс прошло с открытия страницы
 *
 * Отправка:
 *   • если рядом лежит mail-config.php с паролем ящика — письмо уходит через SMTP почты REG.RU
 *     (настоящий ящик, реже попадает в спам). Образец — mail-config.example.php;
 *   • иначе (или если SMTP не ответил) — обычной функцией mail() хостинга.
 * Пароль в этом файле НЕ хранится. mail-config.php закрыт от скачивания в .htaccess.
 */

const MAIL_TO   = 'zakaz@tmstal.ru';
const MAIL_FROM = 'zakaz@tmstal.ru';     // отправитель для mail(); для SMTP — ящик из mail-config.php
const SITE_NAME = 'ТМ Сталь';

header('Content-Type: application/json; charset=utf-8');

function reply(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function clean($value, int $max = 500): string {
    $value = trim((string) $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr($value, 0, $max);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'method']);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    reply(400, ['ok' => false, 'error' => 'bad_json']);
}

// Защита от ботов: заполненное скрытое поле или слишком быстрая отправка.
// Отвечаем «успешно», чтобы бот не понял, что его отсекли.
if (!empty($data['website']) || (int) ($data['elapsed'] ?? 0) < 3000) {
    reply(200, ['ok' => true]);
}

$type    = ($data['type'] ?? '') === 'order' ? 'order' : 'callback';
$name    = clean($data['name'] ?? '', 100);
$phone   = clean($data['phone'] ?? '', 30);
$email   = clean($data['email'] ?? '', 120);
$comment = clean($data['comment'] ?? '', 3000);
$page    = clean($data['page'] ?? '', 300);

$digits = preg_replace('/\D/', '', $phone);
if (strlen($digits) !== 11) {
    reply(422, ['ok' => false, 'error' => 'phone']);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(422, ['ok' => false, 'error' => 'email']);
}

$lines = [];
if ($type === 'order') {
    $subject = !empty($data['wholesale']) ? 'ОПТОВАЯ заявка на расчёт с сайта' : 'Заявка на расчёт с сайта';
    if (!empty($data['wholesale'])) {
        $lines[] = 'Тип: оптовая закупка';
        $lines[] = '';
    }
    $items = is_array($data['items'] ?? null) ? array_slice($data['items'], 0, 100) : [];
    if ($items) {
        $lines[] = 'ПОЗИЦИИ:';
        foreach ($items as $i => $item) {
            $qty  = clean($item['qty'] ?? '', 20);
            $unit = clean($item['unit'] ?? '', 10);
            $note  = clean($item['note'] ?? '', 200);
            $grade = clean($item['grade'] ?? '', 40);
            $lines[] = sprintf(
                '%d. %s%s (%s) — %s%s',
                $i + 1,
                clean($item['name'] ?? '', 150),
                $grade !== '' ? ", марка $grade" : '',
                clean($item['cat'] ?? '', 100),
                $qty !== '' ? "$qty $unit" : 'объём не указан',
                $note !== '' ? "; $note" : ''
            );
        }
        $lines[] = '';
    }
} else {
    $subject = 'Заказ звонка с сайта';
}

$subject .= ' — ' . ($name !== '' ? $name . ', ' : '') . $phone;

$lines[] = 'КОНТАКТЫ:';
$lines[] = 'Имя: ' . ($name !== '' ? $name : '—');
$lines[] = 'Телефон: ' . $phone;
if ($email !== '')   $lines[] = 'Email: ' . $email;
$lines[] = 'Согласие на звонки и рассылки о товарах и акциях: ' . (!empty($data['marketing']) ? 'ДА' : 'нет');
if ($comment !== '') { $lines[] = ''; $lines[] = 'КОММЕНТАРИЙ:'; $lines[] = $comment; }
$lines[] = '';
$lines[] = 'Страница: ' . $page;
$lines[] = 'Время: ' . date('d.m.Y H:i');

$body = implode("\r\n", $lines);

/* ---------- SMTP (почта REG.RU) ---------- */
function smtp_send(array $cfg, string $to, string $subject, string $body, string $replyTo): bool {
    $host = $cfg['host'] ?? 'mail.hosting.reg.ru';
    $port = (int) ($cfg['port'] ?? 465);
    $user = $cfg['user'] ?? '';
    $from = $cfg['from'] ?? $user;
    $remote = ($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $fp = @stream_socket_client($remote, $errno, $errstr, 15);
    if (!$fp) { error_log("send.php: SMTP $remote — $errstr"); return false; }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp): string {
        $out = '';
        while (($line = fgets($fp, 515)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;   // последняя строка ответа: «250 …»
        }
        return $out;
    };
    $cmd = function (string $c, array $ok) use ($fp, $read): bool {
        if ($c !== '') fwrite($fp, $c . "\r\n");
        $r = $read();
        if (!in_array((int) substr($r, 0, 3), $ok, true)) {
            // в журнал — только название команды, без логина/пароля и текста письма
            $what = $c === '' ? 'connect' : (preg_match('/^(EHLO|STARTTLS|AUTH|MAIL|RCPT|DATA)/', $c, $m) ? $m[1] : 'data');
            error_log("send.php: SMTP $what → " . trim($r));
            return false;
        }
        return true;
    };

    $ehlo = 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'tmstal.ru');
    $okConn = $cmd('', [220]) && $cmd($ehlo, [250]);
    if ($okConn && $port === 587) {
        $okConn = $cmd('STARTTLS', [220])
            && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)
            && $cmd($ehlo, [250]);
    }
    $enc = fn(string $s): string => '=?UTF-8?B?' . base64_encode($s) . '?=';
    $msg = implode("\r\n", array_filter([
        'Date: ' . date('r'),
        'From: ' . $enc(SITE_NAME . ' — сайт') . " <$from>",
        "To: <$to>",
        $replyTo !== '' ? "Reply-To: <$replyTo>" : '',
        'Subject: ' . $enc($subject),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ])) . "\r\n\r\n" . chunk_split(base64_encode($body));

    $ok = $okConn
        && $cmd('AUTH LOGIN', [334]) && $cmd(base64_encode($user), [334]) && $cmd(base64_encode($cfg['pass']), [235])
        && $cmd("MAIL FROM:<$from>", [250]) && $cmd("RCPT TO:<$to>", [250, 251])
        && $cmd('DATA', [354]) && $cmd($msg . "\r\n.", [250]);
    @fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return $ok;
}

$sent = false;
$cfgFile = __DIR__ . '/mail-config.php';
$cfg = is_file($cfgFile) ? (include $cfgFile) : null;
if (is_array($cfg) && !empty($cfg['user']) && !empty($cfg['pass'])) {
    $sent = smtp_send($cfg, MAIL_TO, $subject, $body, $email);
}

/* ---------- запасной вариант: mail() хостинга ---------- */
if (!$sent) {
    $headers = [
        'From: =?UTF-8?B?' . base64_encode(SITE_NAME) . '?= <' . MAIL_FROM . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    // Reply-To — только проверенный адрес, чтобы нельзя было подмешать заголовки
    if ($email !== '') {
        $headers[] = 'Reply-To: ' . $email;
    }
    $sent = mail(MAIL_TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers), '-f' . MAIL_FROM);
}

reply($sent ? 200 : 500, ['ok' => $sent]);
