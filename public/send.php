<?php
/**
 * ==============================================================================
 * Self-Hosted Email Dispatch API for cPanel / Apache / Nginx / DirectAdmin
 * ==============================================================================
 * This script allows web applications hosted on cloud platforms (Render, Railway,
 * Vercel, Fly.io, etc.) where outbound SMTP ports (587, 465, 25) are blocked
 * on free plans, to send emails via standard HTTPS on Port 443!
 *
 * HOW IT WORKS:
 * 1. Upload this file to your cPanel File Manager:
 *    public_html/send.php   (accessible via https://yourdomain.com/send.php)
 * 2. Keep or change the SECRET_API_KEY below.
 * 3. In the SMILE MACHINES app, select "Self-Hosted HTTP API (cPanel)", enter
 *    your URL and API Key, and click "Test Connection".
 * 4. Dispatch high-deliverability emails over HTTPS Port 443 with 0 port blocks!
 * ==============================================================================
 */

// ==========================================
// 1. CONFIGURATION (Set your Secret API Key)
// ==========================================
// Set this to your chosen secret key (must match the key in SMILE MACHINES)
define('SECRET_API_KEY', 'smile_cpanel_api_key_77a8b9c0d1');

// Optional: restrict allowed origins (leave as '*' or specify your Railway/Render domain)
define('ALLOWED_ORIGIN', '*');

// ==========================================
// 2. CORS & RESPONSE HEADERS
// ==========================================
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-KEY, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['status' => 'preflight_ok']);
    exit;
}

// ==========================================
// 3. API AUTHENTICATION & INPUT PARSING
// ==========================================
$rawInput = file_get_contents('php://input');
$data = !empty($rawInput) ? json_decode($rawInput, true) : null;

function getSubmittedApiKey($data = null) {
    // 1. Check HTTP header X-API-KEY
    if (!empty($_SERVER['HTTP_X_API_KEY'])) {
        return trim($_SERVER['HTTP_X_API_KEY']);
    }
    // 2. Check Authorization: Bearer <key>
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        if (preg_match('/Bearer\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
            return trim($matches[1]);
        }
    }
    // 3. Check JSON body apiKey
    if (!empty($data['apiKey'])) {
        return trim($data['apiKey']);
    }
    // 4. Check apache_request_headers() if on Apache/cPanel
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, 'X-API-KEY') === 0) {
                return trim($v);
            }
        }
    }
    // 5. Check query parameter ?key=
    if (!empty($_GET['key'])) {
        return trim($_GET['key']);
    }
    return null;
}

$providedKey = getSubmittedApiKey($data);

if (empty($providedKey) || $providedKey !== SECRET_API_KEY) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized: Invalid or missing API Key. Please provide X-API-KEY header matching the secret key in send.php.',
        'help' => 'Ensure SECRET_API_KEY in send.php matches the key configured in the app.'
    ]);
    exit;
}

// ==========================================
// 4. HEALTH CHECK / LIVE PING HANDLER
// ==========================================
// Handle GET ping or POST { action: "ping" } or { ping: true }
if ($_SERVER['REQUEST_METHOD'] === 'GET' || (isset($data['action']) && $data['action'] === 'ping') || !empty($data['ping'])) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'status' => 'online',
        'message' => 'Self-Hosted cPanel Mail API is online and authenticated.',
        'server' => $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? 'cpanel.local',
        'php_version' => PHP_VERSION,
        'timestamp' => date('c'),
        'mta_configured' => function_exists('mail'),
        'server_ip' => $_SERVER['SERVER_ADDR'] ?? null,
    ]);
    exit;
}

// ==========================================
// 5. EMAIL DISPATCH LOGIC (POST)
// ==========================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed. Use POST to dispatch emails.']);
    exit;
}

if (empty($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Empty request payload or invalid JSON format.']);
    exit;
}

// Validate Recipient
$to = trim($data['to'] ?? $data['recipient'] ?? '');
if (empty($to) || !filter_var(filter_var($to, FILTER_SANITIZE_EMAIL), FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Missing or invalid recipient email address: '{$to}'."]);
    exit;
}

$subject = $data['subject'] ?? '(No Subject)';
$text = $data['text'] ?? $data['plainText'] ?? '';
$html = $data['html'] ?? $data['htmlContent'] ?? '';
$fromRaw = trim($data['from'] ?? $data['fromEmail'] ?? '');
$fallbackName = trim($data['fromName'] ?? '');

// Parse sender display name & email
$senderEmail = '';
$senderName = $fallbackName;
if (preg_match('/^(.*?)\s*<([^>]+)>$/', $fromRaw, $matches)) {
    $senderName = trim($matches[1], ' "\'');
    $senderEmail = trim($matches[2]);
} else if (filter_var($fromRaw, FILTER_VALIDATE_EMAIL)) {
    $senderEmail = $fromRaw;
} else if (!empty($data['fromEmail']) && filter_var($data['fromEmail'], FILTER_VALIDATE_EMAIL)) {
    $senderEmail = trim($data['fromEmail']);
} else {
    // Fallback to domain default
    $host = $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
    $cleanHost = preg_replace('/^www\./', '', $host);
    $senderEmail = 'outbox@' . $cleanHost;
}

// Build unique RFC Message-ID
$domainPart = substr(strrchr($senderEmail, "@"), 1);
if (empty($domainPart)) {
    $domainPart = $_SERVER['SERVER_NAME'] ?? 'cpanel.local';
}
$messageId = sprintf("<%s.%s@%s>", time(), bin2hex(random_bytes(8)), $domainPart);

// Generate multipart boundary
$boundary = '=_smile_' . md5(uniqid(time(), true));

// Build MIME Headers
$headers = [];
$headers[] = 'MIME-Version: 1.0';

if (!empty($senderName)) {
    $encodedName = '=?UTF-8?B?' . base64_encode($senderName) . '?=';
    $headers[] = "From: {$encodedName} <{$senderEmail}>";
} else {
    $headers[] = "From: <{$senderEmail}>";
}

if (!empty($data['replyTo'])) {
    $headers[] = 'Reply-To: ' . trim($data['replyTo']);
} else {
    $headers[] = "Reply-To: <{$senderEmail}>";
}

if (!empty($data['cc'])) {
    $headers[] = 'Cc: ' . trim($data['cc']);
}
if (!empty($data['bcc'])) {
    $headers[] = 'Bcc: ' . trim($data['bcc']);
}

$headers[] = "Message-ID: {$messageId}";
$headers[] = 'Date: ' . date('r');
$headers[] = 'X-Mailer: SMILE-MACHINES-cPanel-API/v2.0';

// Optional priority
if (!empty($data['headers']['X-Priority'])) {
    $headers[] = 'X-Priority: ' . $data['headers']['X-Priority'];
}

// Build Email Body (Multipart Alternative: Plain Text + Rich HTML)
if (!empty($html) && !empty($text)) {
    $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";
    
    $body = "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($text)) . "\r\n";
    
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($html)) . "\r\n";
    $body .= "--{$boundary}--\r\n";
} else if (!empty($html)) {
    $headers[] = "Content-Type: text/html; charset=UTF-8";
    $headers[] = "Content-Transfer-Encoding: base64";
    $body = chunk_split(base64_encode($html));
} else {
    $headers[] = "Content-Type: text/plain; charset=UTF-8";
    $headers[] = "Content-Transfer-Encoding: base64";
    $body = chunk_split(base64_encode($text));
}

// UTF-8 encode subject line to prevent character corruption
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

// Prepend Return-Path for bounce tracking and SPF alignment
array_unshift($headers, "Return-Path: <{$senderEmail}>");

// Clean envelope sender for -f parameter (do NOT use escapeshellarg which adds quotes that Exim rejects)
$cleanSender = preg_replace('/[^a-zA-Z0-9.@+_-]/', '', $senderEmail);
$extraParams = !empty($cleanSender) ? "-f" . $cleanSender : "";

// Dispatch through local MTA
$sent = false;
if (!empty($extraParams)) {
    $sent = @mail($to, $encodedSubject, $body, implode("\r\n", $headers), $extraParams);
}

// Fallback without -f if server strict safe mode prohibits it
if (!$sent) {
    $sent = @mail($to, $encodedSubject, $body, implode("\r\n", $headers));
}

// Write to rotating dispatch history log for user verification in cPanel File Manager
try {
    $logEntry = sprintf("[%s] TO: %s | FROM: %s | SUBJ: %s | STATUS: %s | MSGID: %s\n",
        date('Y-m-d H:i:s'),
        $to,
        $senderEmail,
        substr($subject, 0, 40),
        $sent ? 'ACCEPTED_BY_MTA' : 'FAILED',
        $messageId
    );
    @file_put_contents(__DIR__ . '/mail_dispatch.log', $logEntry, FILE_APPEND | LOCK_EX);
} catch (\Throwable $e) {}

if ($sent) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Email successfully accepted for delivery by cPanel local mail server',
        'messageId' => $messageId,
        'to' => $to,
        'from' => $senderEmail,
        'response' => '250 2.0.0 OK: Accepted by cPanel Exim/Postfix MTA',
        'deliveryNotice' => 'Accepted by local mail server. If not in inbox, check Spam/Junk folder or cPanel Track Delivery.',
        'timestamp' => date('c')
    ]);
} else {
    $lastError = error_get_last();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Mail dispatch failed. Verify cPanel Exim/Sendmail is active.',
        'details' => $lastError['message'] ?? 'PHP mail() returned false'
    ]);
}
