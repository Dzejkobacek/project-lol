<?php
// Freshyard.cz – contact form endpoint (POST /api/contact.php)
// Expects: name, email, phone, message (+ honeypots "website" and "company" that must stay empty).
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

const MAIL_TO = 'info@freshyard.cz';
const MAIL_FROM = 'web@freshyard.cz';

function respond(int $code, bool $ok): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, false);

// bots fill hidden fields – pretend success
if (!empty($_POST['website']) || !empty($_POST['company'])) respond(200, true);

$clean = fn(string $k, int $max) => trim(mb_substr(str_replace(["\r", "\n"], ' ', (string)($_POST[$k] ?? '')), 0, $max));
$name = $clean('name', 120);
$email = $clean('email', 160);
$phone = $clean('phone', 40);
$message = trim(mb_substr((string)($_POST['message'] ?? ''), 0, 5000));

if ($name === '' || $phone === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) respond(422, false);

$subject = '=?UTF-8?B?' . base64_encode('Nová poptávka z webu – ' . $name) . '?=';
$body = "Jméno: $name\nEmail: $email\nTelefon: $phone\n\n$message\n";
$headers = implode("\r\n", [
    'From: Freshyard.cz <' . MAIL_FROM . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
]);

$sent = mail(MAIL_TO, $subject, $body, $headers);
respond($sent ? 200 : 500, $sent);
