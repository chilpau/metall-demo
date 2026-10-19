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
 * Работает на любом хостинге с PHP (Beget, Timeweb, REG.RU и др.).
 * Если письма не доходят — уточните у хостинга, разрешена ли функция mail(),
 * и создайте на домене ящик, указанный в MAIL_FROM.
 */

const MAIL_TO   = 'zakaz@tmstal.ru';
const MAIL_FROM = 'noreply@tmstal.ru';   // ящик на домене сайта
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

$lines[] = 'КОНТАКТЫ:';
$lines[] = 'Имя: ' . ($name !== '' ? $name : '—');
$lines[] = 'Телефон: ' . $phone;
if ($email !== '')   $lines[] = 'Email: ' . $email;
if ($comment !== '') { $lines[] = ''; $lines[] = 'КОММЕНТАРИЙ:'; $lines[] = $comment; }
$lines[] = '';
$lines[] = 'Страница: ' . $page;
$lines[] = 'Время: ' . date('d.m.Y H:i');

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

$sent = mail(
    MAIL_TO,
    '=?UTF-8?B?' . base64_encode($subject) . '?=',
    implode("\r\n", $lines),
    implode("\r\n", $headers)
);

reply($sent ? 200 : 500, ['ok' => $sent]);
