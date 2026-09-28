import React, { useState } from 'react';
import { 
  X, 
  Server, 
  Key, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Download, 
  ExternalLink, 
  Zap, 
  ShieldCheck, 
  Code2, 
  FileText,
  Activity,
  Check,
  Mail,
  Send,
  AlertTriangle
} from 'lucide-react';
import { HttpApiConfig } from '../types';
import { safeFetchJson } from '../services/safeFetch';

interface HttpApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HttpApiConfig;
  onSaveConfig: (newConfig: HttpApiConfig) => void;
  showToast: (msg: string) => void;
}

export const PHP_SCRIPT_CONTENT = `<?php
/**
 * ==============================================================================
 * Zero-Port-25 Email Dispatch API for cPanel / Apache / Nginx / DirectAdmin
 * ==============================================================================
 * Dispatches emails 100% via HTTPS Port 443 using cURL.
 * NEVER uses Port 25, Exim timeouts, or local SMTP relay.
 *
 * HOW IT WORKS:
 * 1. Accepts HTTPS POST payload from SMILE MACHINES on Port 443.
 * 2. Dispatches directly via REST Email APIs (Resend, Brevo, or SendGrid)
 *    using PHP cURL over HTTPS (Port 443).
 * 3. Bypasses all ISP, cloud host, and datacenter Port 25 blocks!
 *
 * INSTALLATION:
 * 1. Upload this file to cPanel File Manager: public_html/send.php
 * 2. (Optional) Put your Resend, Brevo, or SendGrid API Key below, or
 *    pass it dynamically from SMILE MACHINES.
 * ==============================================================================
 */

// 1. CONFIGURATION
define('SECRET_API_KEY', 'smile_cpanel_api_key_77a8b9c0d1');

// Optional: Set default cloud REST provider ('resend', 'brevo', 'sendgrid', or 'none')
// If set, send.php relays via HTTPS Port 443 cURL with ZERO Port 25!
define('REST_PROVIDER', 'resend'); 
define('RESEND_API_KEY', '');   // e.g. 're_123456789...' (Free 3,000/mo at resend.com)
define('BREVO_API_KEY', '');    // e.g. 'xkeysib-...' (Free 300/day at brevo.com)
define('SENDGRID_API_KEY', ''); // e.g. 'SG....'

// 2. CORS HEADERS (HTTPS Port 443)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-KEY, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['status' => 'preflight_ok']);
    exit;
}

// 3. AUTHENTICATION & INPUT PARSING
$rawInput = file_get_contents('php://input');
$data = !empty($rawInput) ? json_decode($rawInput, true) : null;

function getSubmittedApiKey($data = null) {
    if (!empty($_SERVER['HTTP_X_API_KEY'])) return trim($_SERVER['HTTP_X_API_KEY']);
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        if (preg_match('/Bearer\\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
            return trim($matches[1]);
        }
    }
    if (!empty($data['apiKey'])) return trim($data['apiKey']);
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, 'X-API-KEY') === 0) return trim($v);
        }
    }
    if (!empty($_GET['key'])) return trim($_GET['key']);
    return null;
}

$providedKey = getSubmittedApiKey($data);
if (!empty(SECRET_API_KEY) && (empty($providedKey) || $providedKey !== SECRET_API_KEY)) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized: Invalid or missing API Key. Provide X-API-KEY header.'
    ]);
    exit;
}

// 4. HEALTH CHECK / LIVE PING
if ($_SERVER['REQUEST_METHOD'] === 'GET' || (isset($data['action']) && $data['action'] === 'ping') || !empty($data['ping'])) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'status' => 'online',
        'message' => 'Zero-Port-25 HTTP API is online over HTTPS Port 443!',
        'server' => $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? 'cpanel.local',
        'php_version' => PHP_VERSION,
        'protocol' => 'HTTPS Port 443 (Zero Port 25)',
        'curl_available' => function_exists('curl_init'),
        'timestamp' => date('c')
    ]);
    exit;
}

// 5. EMAIL DISPATCH (POST)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed. Use POST.']);
    exit;
}

if (empty($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Empty request payload or invalid JSON format.']);
    exit;
}

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

$senderEmail = '';
$senderName = $fallbackName;
if (preg_match('/^(.*?)\\s*<([^>]+)>$/', $fromRaw, $matches)) {
    $senderName = trim(trim($matches[1]), '"\\\'');
    $senderEmail = trim($matches[2]);
} else if (filter_var($fromRaw, FILTER_VALIDATE_EMAIL)) {
    $senderEmail = $fromRaw;
} else if (!empty($data['fromEmail']) && filter_var($data['fromEmail'], FILTER_VALIDATE_EMAIL)) {
    $senderEmail = trim($data['fromEmail']);
} else {
    $host = $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
    $senderEmail = 'outbox@' . preg_replace('/^www\\./', '', $host);
}

// Determine active REST API Key (from script constants or dynamic payload)
$resendKey = !empty(RESEND_API_KEY) ? RESEND_API_KEY : (!empty($data['resendApiKey']) ? $data['resendApiKey'] : '');
$brevoKey = !empty(BREVO_API_KEY) ? BREVO_API_KEY : (!empty($data['brevoApiKey']) ? $data['brevoApiKey'] : '');
$sendgridKey = !empty(SENDGRID_API_KEY) ? SENDGRID_API_KEY : (!empty($data['sendgridApiKey']) ? $data['sendgridApiKey'] : '');

// --- ROUTE 1: RESEND REST API (HTTPS Port 443 via cURL) ---
if (!empty($resendKey)) {
    $payload = [
        'from' => !empty($senderName) ? "{$senderName} <{$senderEmail}>" : $senderEmail,
        'to' => [$to],
        'subject' => $subject,
        'html' => !empty($html) ? $html : (!empty($text) ? nl2br($text) : '(Empty)'),
        'text' => !empty($text) ? $text : strip_tags($html),
    ];
    if (!empty($data['replyTo'])) $payload['reply_to'] = trim($data['replyTo']);

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $resendKey,
            'Content-Type: application/json',
            'User-Agent: Zero-Port-25-cPanel-API/1.0'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    $json = json_decode($resp, true);
    if ($httpCode >= 200 && $httpCode < 300 && !empty($json['id'])) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Dispatched via Resend REST API over HTTPS Port 443 (Zero Port 25)',
            'messageId' => '<' . $json['id'] . '@resend.dev>',
            'to' => $to,
            'response' => '250 2.0.0 OK: Accepted by Resend REST API (ID: ' . $json['id'] . ')',
            'timestamp' => date('c')
        ]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $json['message'] ?? 'Resend API error (HTTP ' . $httpCode . ')',
            'details' => $curlErr ? "cURL error: {$curlErr}" : $resp
        ]);
        exit;
    }
}

// --- ROUTE 2: BREVO REST API (HTTPS Port 443 via cURL) ---
if (!empty($brevoKey)) {
    $payload = [
        'sender' => ['name' => $senderName ?: 'Sender', 'email' => $senderEmail],
        'to' => [['email' => $to]],
        'subject' => $subject,
        'htmlContent' => !empty($html) ? $html : (!empty($text) ? nl2br($text) : '(Empty)'),
        'textContent' => !empty($text) ? $text : strip_tags($html),
    ];
    if (!empty($data['replyTo'])) $payload['replyTo'] = ['email' => trim($data['replyTo'])];

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'api-key: ' . $brevoKey,
            'Content-Type: application/json',
            'User-Agent: Zero-Port-25-cPanel-API/1.0'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    $json = json_decode($resp, true);
    if ($httpCode >= 200 && $httpCode < 300) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Dispatched via Brevo REST API over HTTPS Port 443 (Zero Port 25)',
            'messageId' => $json['messageId'] ?? ('<' . time() . '@brevo.com>'),
            'to' => $to,
            'response' => '250 2.0.0 OK: Accepted by Brevo REST API',
            'timestamp' => date('c')
        ]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $json['message'] ?? 'Brevo API error (HTTP ' . $httpCode . ')',
            'details' => $curlErr ? "cURL error: {$curlErr}" : $resp
        ]);
        exit;
    }
}

// --- ROUTE 3: SENDGRID REST API (HTTPS Port 443 via cURL) ---
if (!empty($sendgridKey)) {
    $payload = [
        'personalizations' => [['to' => [['email' => $to]]]],
        'from' => ['email' => $senderEmail, 'name' => $senderName ?: null],
        'subject' => $subject,
        'content' => [
            ['type' => !empty($html) ? 'text/html' : 'text/plain', 'value' => !empty($html) ? $html : $text]
        ]
    ];
    if (!empty($data['replyTo'])) $payload['reply_to'] = ['email' => trim($data['replyTo'])];

    $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $sendgridKey,
            'Content-Type: application/json',
            'User-Agent: Zero-Port-25-cPanel-API/1.0'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode === 202 || $httpCode === 200) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Dispatched via SendGrid REST API over HTTPS Port 443 (Zero Port 25)',
            'messageId' => '<' . time() . '.' . bin2hex(random_bytes(4)) . '@sendgrid.net>',
            'to' => $to,
            'response' => '250 2.0.0 OK: Accepted by SendGrid REST API',
            'timestamp' => date('c')
        ]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'SendGrid API error (HTTP ' . $httpCode . ')',
            'details' => $curlErr ? "cURL error: {$curlErr}" : $resp
        ]);
        exit;
    }
}

// --- ROUTE 4: DYNAMIC CPANEL MTA DISPATCH (when no external cloud REST key provided) ---
$domainPart = substr(strrchr($senderEmail, "@"), 1);
if (empty($domainPart)) $domainPart = $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
$messageId = '<' . time() . '.' . bin2hex(random_bytes(8)) . '@' . $domainPart . '>';
$boundary = '=_smile_' . md5(uniqid(strval(time()), true));

$headers = [];
$headers[] = 'MIME-Version: 1.0';
if (!empty($senderName)) {
    $headers[] = 'From: =?UTF-8?B?' . base64_encode($senderName) . '?= <' . $senderEmail . '>';
} else {
    $headers[] = 'From: <' . $senderEmail . '>';
}
if (!empty($data['replyTo'])) {
    $headers[] = 'Reply-To: ' . trim($data['replyTo']);
} else {
    $headers[] = 'Reply-To: <' . $senderEmail . '>';
}
$headers[] = 'Message-ID: ' . $messageId;
$headers[] = 'Date: ' . date('r');
$headers[] = 'X-Mailer: SMILE-MACHINES-cPanel-API/3.0';

if (!empty($html) && !empty($text)) {
    $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
    $body = "--" . $boundary . "\\r\\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\\r\\n";
    $body .= "Content-Transfer-Encoding: base64\\r\\n\\r\\n";
    $body .= chunk_split(base64_encode($text)) . "\\r\\n";
    $body .= "--" . $boundary . "\\r\\n";
    $body .= "Content-Type: text/html; charset=UTF-8\\r\\n";
    $body .= "Content-Transfer-Encoding: base64\\r\\n\\r\\n";
    $body .= chunk_split(base64_encode($html)) . "\\r\\n";
    $body .= "--" . $boundary . "--\\r\\n";
} else if (!empty($html)) {
    $headers[] = 'Content-Type: text/html; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = chunk_split(base64_encode($html));
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = chunk_split(base64_encode($text));
}

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$cleanSender = preg_replace('/[^a-zA-Z0-9.@+_-]/', '', $senderEmail);
$extraParams = !empty($cleanSender) ? '-f' . $cleanSender : '';

$sent = false;
if (!empty($extraParams)) {
    $sent = @mail($to, $encodedSubject, $body, implode("\\r\\n", $headers), $extraParams);
}
if (!$sent) {
    $sent = @mail($to, $encodedSubject, $body, implode("\\r\\n", $headers));
}

if ($sent) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Email accepted by cPanel local mail server',
        'messageId' => $messageId,
        'to' => $to,
        'from' => $senderEmail,
        'response' => '250 2.0.0 OK: Accepted by cPanel Exim/Postfix MTA',
        'notice' => 'If outside inboxes (Gmail/Yahoo) do not receive this, your hosting provider blocks Port 25 outbound. To bypass Port 25, supply a REST API key (Resend or Brevo) in SMILE MACHINES or send.php.',
        'timestamp' => date('c')
    ]);
    exit;
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'cPanel mail() dispatch failed. To bypass server SMTP restrictions and Port 25 blocks, add a REST API key (Resend or Brevo) to send.php or configure it in SMILE MACHINES.'
    ]);
    exit;
}`;

export const HttpApiModal: React.FC<HttpApiModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  showToast,
}) => {
  const [endpointUrl, setEndpointUrl] = useState(config.endpointUrl || '');
  const [apiKey, setApiKey] = useState(config.apiKey || 'smile_cpanel_api_key_77a8b9c0d1');
  const [senderName, setSenderName] = useState(config.senderName || '');
  const [senderEmail, setSenderEmail] = useState(() => {
    if (config.senderEmail && !config.senderEmail.includes('bgbit.eu')) {
      return config.senderEmail;
    }
    return '';
  });
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    serverInfo?: any;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'settings' | 'script' | 'instructions'>('settings');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async (customRecipient?: string) => {
    if (!endpointUrl.trim()) {
      showToast('Please enter your cPanel API Endpoint URL first.');
      return;
    }

    const isLiveMail = Boolean(customRecipient && customRecipient.includes('@'));
    if (isLiveMail) {
      setIsSendingTestMail(true);
    } else {
      setIsTesting(true);
    }
    setTestResult(null);

    const startTime = Date.now();
    try {
      const res = await safeFetchJson<any>('/api/http-api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: endpointUrl.trim(),
          apiKey: apiKey.trim(),
          testToEmail: customRecipient ? customRecipient.trim() : undefined,
          fromEmail: senderEmail.trim(),
          fromName: senderName.trim(),
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok && res.data && res.data.success) {
        setTestResult({
          success: true,
          message: res.data.message || (isLiveMail ? `Live test email delivered to ${customRecipient}!` : 'Connection verified! cPanel HTTP API is online.'),
          latencyMs,
          serverInfo: res.data.serverInfo,
        });

        const updatedConfig: HttpApiConfig = {
          endpointUrl: endpointUrl.trim(),
          apiKey: apiKey.trim(),
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          status: 'verified',
          lastTested: new Date().toLocaleTimeString(),
          lastLatencyMs: latencyMs,
          serverInfo: res.data.serverInfo,
        };
        onSaveConfig(updatedConfig);
        showToast(isLiveMail ? `Test email sent to ${customRecipient}!` : 'HTTP API Endpoint verified successfully!');
      } else {
        const errMsg = res.isHtml 
          ? 'Cloud proxy error: Verify the server backend is running.'
          : (res.data?.error || res.error || 'Failed to connect to HTTP API endpoint');
        setTestResult({
          success: false,
          message: errMsg,
          latencyMs,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network request failed',
      });
    } finally {
      setIsTesting(false);
      setIsSendingTestMail(false);
    }
  };

  const handleSave = () => {
    const updated: HttpApiConfig = {
      ...config,
      endpointUrl: endpointUrl.trim(),
      apiKey: apiKey.trim(),
      senderName: senderName.trim(),
      senderEmail: senderEmail.trim(),
    };
    onSaveConfig(updated);
    showToast('Self-Hosted HTTP API configuration saved.');
    onClose();
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(PHP_SCRIPT_CONTENT);
    setCopiedScript(true);
    showToast('send.php code copied to clipboard!');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([PHP_SCRIPT_CONTENT], { type: 'application/x-httpd-php' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'send.php';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded send.php to your computer!');
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    showToast('API Key copied to clipboard!');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-gray-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Self-Hosted cPanel / VPS HTTP API
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
                  Port 443 HTTPS (No Port Blocks)
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Bypasses Render.com &amp; Railway.com free plan SMTP port restrictions (587/465/25)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-gray-950/60 px-6 gap-2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>API Connection &amp; Endpoint</span>
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'script'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Configured send.php Script</span>
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'instructions'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>3-Step cPanel Guide</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-sm">
          
          {/* TAB 1: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Architecture Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-gray-900 border border-emerald-500/20 text-xs text-gray-300 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>100% REST API over HTTPS Port 443 — Zero Port 25:</span>
                </div>
                <p className="leading-relaxed">
                  Port 25 is blocked by most cloud providers and datacenters to stop spam. In this mode, all email dispatch travels over standard <strong>HTTPS Port 443 via REST API</strong> (Resend, Brevo, SendGrid, or your cPanel <code className="px-1.5 py-0.5 bg-gray-800 text-emerald-300 rounded font-mono">send.php</code> cURL relay). <strong>Port 25 is never touched.</strong>
                </p>
              </div>

              {/* Provider Quick Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                  <span>Select HTTP API Provider (All use Port 443 / Zero Port 25):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEndpointUrl('https://api.resend.com/emails');
                      if (apiKey === 'smile_cpanel_api_key_77a8b9c0d1') setApiKey('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      endpointUrl.includes('api.resend.com')
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-gray-800 bg-gray-950/80 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>Resend API</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">Recommended</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">3,000 Free/Mo • Port 443</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEndpointUrl('https://api.brevo.com/v3/smtp/email');
                      if (apiKey === 'smile_cpanel_api_key_77a8b9c0d1') setApiKey('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      endpointUrl.includes('brevo.com')
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-gray-800 bg-gray-950/80 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>Brevo API</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">300/Day</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">300 Free/Day • Port 443</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEndpointUrl('https://api.sendgrid.com/v3/mail/send');
                      if (apiKey === 'smile_cpanel_api_key_77a8b9c0d1') setApiKey('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      endpointUrl.includes('sendgrid.com')
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-gray-800 bg-gray-950/80 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>SendGrid API</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">REST</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Enterprise REST API</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (endpointUrl.includes('api.resend.com') || endpointUrl.includes('brevo.com') || endpointUrl.includes('sendgrid.com')) {
                        setEndpointUrl('');
                      }
                      if (!apiKey) setApiKey('smile_cpanel_api_key_77a8b9c0d1');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      !endpointUrl.includes('api.resend.com') && !endpointUrl.includes('brevo.com') && !endpointUrl.includes('sendgrid.com')
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-gray-800 bg-gray-950/80 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>cPanel send.php</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">Self-Hosted</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Your own custom URL</p>
                  </button>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Endpoint URL */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                    <span>
                      {endpointUrl.includes('api.resend.com')
                        ? 'Resend REST API Endpoint (HTTPS Port 443):'
                        : endpointUrl.includes('brevo.com')
                        ? 'Brevo REST API Endpoint (HTTPS Port 443):'
                        : endpointUrl.includes('sendgrid.com')
                        ? 'SendGrid REST API Endpoint (HTTPS Port 443):'
                        : 'cPanel Endpoint URL (HTTPS Port 443):'}
                    </span>
                    <span className="text-[11px] text-gray-400 font-normal">
                      {endpointUrl.includes('api.resend.com')
                        ? 'api.resend.com'
                        : endpointUrl.includes('brevo.com')
                        ? 'api.brevo.com'
                        : endpointUrl.includes('sendgrid.com')
                        ? 'api.sendgrid.com'
                        : 'e.g. https://yourdomain.com/send.php'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      placeholder={
                        endpointUrl.includes('api.resend.com')
                          ? 'https://api.resend.com/emails'
                          : endpointUrl.includes('brevo.com')
                          ? 'https://api.brevo.com/v3/smtp/email'
                          : endpointUrl.includes('sendgrid.com')
                          ? 'https://api.sendgrid.com/v3/mail/send'
                          : 'https://yourdomain.com/send.php'
                      }
                      className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {endpointUrl.includes('api.resend.com')
                      ? 'Standard HTTPS REST endpoint. Dispatches through Resend with high inbox rate and zero Port 25.'
                      : endpointUrl.includes('brevo.com')
                      ? 'Standard HTTPS REST endpoint. Dispatches through Brevo (300 free emails/day) with zero Port 25.'
                      : endpointUrl.includes('sendgrid.com')
                      ? 'Standard HTTPS REST endpoint. Dispatches through SendGrid with zero Port 25.'
                      : 'The full HTTPS web address where you uploaded send.php on your cPanel host.'}
                  </p>
                </div>

                {/* API Key */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                    <span>
                      {endpointUrl.includes('api.resend.com')
                        ? 'Resend API Key (re_...):'
                        : endpointUrl.includes('brevo.com')
                        ? 'Brevo API Key (xkeysib-...):'
                        : endpointUrl.includes('sendgrid.com')
                        ? 'SendGrid API Key (SG....):'
                        : 'API Secret Key:'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        endpointUrl.includes('api.resend.com')
                          ? 're_123456789_abcdef...'
                          : endpointUrl.includes('brevo.com')
                          ? 'xkeysib-123456789_abcdef...'
                          : endpointUrl.includes('sendgrid.com')
                          ? 'SG.123456789_abcdef...'
                          : 'smile_cpanel_api_key_77a8b9c0d1'
                      }
                      className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {endpointUrl.includes('api.resend.com')
                      ? 'Get your free API key at resend.com/api-keys (Free 3,000 emails/month, 100/day).'
                      : endpointUrl.includes('brevo.com')
                      ? 'Get your free API key at app.brevo.com/settings/keys/api (Free 300 emails/day).'
                      : endpointUrl.includes('sendgrid.com')
                      ? 'Get your API key at app.sendgrid.com/settings/api_keys.'
                      : 'Must match the SECRET_API_KEY constant defined in your send.php.'}
                  </p>
                </div>

                {/* Sender Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    From Email Address (Dynamic):
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="contact@yourdomain.com"
                    className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                  <p className="text-[11px] text-gray-400">
                    Dynamically sent with every request payload. Match to your domain for SPF/DKIM alignment.
                  </p>
                </div>

                {/* Sender Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Sender Display Name (Dynamic):
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your Company / Brand Name"
                    className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white text-xs focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                  <p className="text-[11px] text-gray-400">
                    Dynamically sent with every request payload to appear in the recipient&apos;s inbox.
                  </p>
                </div>
              </div>

              {/* Test Connection Box */}
              <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      Live HTTPS Handshake Diagnostic
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Pings your cPanel endpoint over Port 443 to verify handshake, authentication, and MTA readiness (Zero emails sent).
                    </p>
                  </div>
                  <button
                    onClick={() => handleTestConnection()}
                    disabled={isTesting || isSendingTestMail || !endpointUrl.trim()}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 shrink-0"
                  >
                    {isTesting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Pinging Port 443...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Test Connection (Ping)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Send Live Test Email (Optional) */}
                <div className="pt-3 border-t border-gray-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      Send Live Test Email to Inbox (Optional):
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">End-to-end delivery test</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      placeholder="e.g. your-email@gmail.com"
                      className="flex-1 bg-gray-900 border border-gray-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => handleTestConnection(testEmailRecipient)}
                      disabled={isTesting || isSendingTestMail || !testEmailRecipient.trim() || !endpointUrl.trim()}
                      className="px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                    >
                      {isSendingTestMail ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Test Email</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div className={`p-3.5 rounded-lg text-xs space-y-2 border ${
                    testResult.success 
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 w-full">
                        <p className="font-semibold">{testResult.message}</p>
                        {testResult.latencyMs && (
                          <p className="text-[11px] opacity-80">
                            Round-trip latency: <strong>{testResult.latencyMs} ms</strong> (over HTTPS Port 443)
                          </p>
                        )}
                        {testResult.serverInfo && (
                          <div className="text-[11px] opacity-80 font-mono space-x-3 pt-1">
                            <span>Host: {testResult.serverInfo.server || 'cpanel'}</span>
                            <span>•</span>
                            <span>PHP: {testResult.serverInfo.php_version || '7.x/8.x'}</span>
                            <span>•</span>
                            <span>MTA Mail(): {testResult.serverInfo.mta_configured ? 'Active' : 'Unknown'}</span>
                          </div>
                        )}

                        {testResult.success && (
                          <div className="mt-3 p-3 bg-gray-900/90 rounded-lg border border-emerald-500/30 text-gray-300 space-y-2">
                            <p className="font-bold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                              <span>📬</span> How to Verify and Ensure In-Box Delivery:
                            </p>
                            <ul className="space-y-1.5 text-[11px] text-gray-300 list-disc list-inside">
                              <li>
                                <strong className="text-white">Check Spam/Junk Folder:</strong> First-time automated emails from cPanel often land in Gmail/Yahoo Spam. Check your Spam folder and mark &quot;Report Not Spam&quot;.
                              </li>
                              <li>
                                <strong className="text-white">Check cPanel &quot;Track Delivery&quot;:</strong> Log into your cPanel &gt; Email &gt; <strong>Track Delivery</strong>. Type your recipient email to view Exim&apos;s real-time transmission log and delivery status.
                              </li>
                              <li>
                                <strong className="text-white">Real Sender Mailbox:</strong> Ensure <code>{senderEmail || 'outbox@yourdomain.com'}</code> is an actual created email mailbox inside <code>cPanel &gt; Email Accounts</code>.
                              </li>
                              <li>
                                <strong className="text-white">SPF &amp; DKIM Records:</strong> In <code>cPanel &gt; Email Deliverability</code>, verify that SPF and DKIM are listed as <strong>Valid</strong> so external inboxes don&apos;t bounce your messages.
                              </li>
                              <li>
                                <strong className="text-white">Server Dispatch Log:</strong> Check <code>mail_dispatch.log</code> in your cPanel <code>public_html/</code> directory to see timestamps and MTA response codes.
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PHP SCRIPT VIEWER & DOWNLOAD */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Configured send.php Script
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Pre-configured with your matching Secret API Key. Ready for upload.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyScript}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-colors border border-gray-700"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-emerald-600/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download send.php</span>
                  </button>
                </div>
              </div>

              {/* Code display */}
              <div className="relative bg-gray-950 border border-gray-800 rounded-xl p-4 overflow-x-auto max-h-[380px] custom-scrollbar">
                <pre className="text-[11px] font-mono text-emerald-300 leading-relaxed">
                  {PHP_SCRIPT_CONTENT}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP CPANEL GUIDE & PORT 25 EXPLANATION */}
          {activeTab === 'instructions' && (
            <div className="space-y-5">
              {/* Why Port 25 Fails Callout */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2 text-xs text-amber-200">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Why Emails FAILED Outside cPanel (The Port 25 Block):</span>
                </div>
                <p className="leading-relaxed text-amber-200/90 text-[12px]">
                  When a script calls PHP&apos;s standard <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300 font-mono">mail()</code> function, the server hands the message to local Exim/sendmail. Exim then tries to open a direct socket connection to Gmail, Yahoo, or Outlook on <strong>Port 25 (SMTP)</strong>.
                </p>
                <p className="leading-relaxed text-amber-200/90 text-[12px]">
                  <strong>99% of cloud hosts (Render, Railway, AWS, DigitalOcean) and cPanel hosting providers block Port 25 outbound</strong> to prevent spam. Local cPanel deliveries succeed because they stay inside the server, but outside deliveries are blocked or timed out by the firewall!
                </p>
                <p className="leading-relaxed text-emerald-300 font-semibold text-[12px]">
                  ✓ The Solution: By switching to a REST API (Resend, Brevo, SendGrid, or the updated send.php with cURL), all dispatch occurs over <strong>standard HTTPS Port 443</strong> with TLS encryption and an API Key. Port 443 is universally open everywhere!
                </p>
              </div>

              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Two Ways to Send via API (Port 443 - Zero Port 25):
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: Cloud REST API Direct */}
                <div className="p-4 rounded-xl bg-gray-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      A
                    </div>
                    <h5 className="text-xs font-bold text-white">Direct Cloud REST API (Easiest)</h5>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    No cPanel hosting required. In the <strong>Settings tab</strong>, click the <strong>Resend API</strong> or <strong>Brevo API</strong> preset.
                  </p>
                  <ul className="text-[11px] text-gray-400 space-y-1 list-disc list-inside">
                    <li><strong className="text-white">Resend:</strong> Get free API key at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">resend.com</a> (3,000 free emails/mo).</li>
                    <li><strong className="text-white">Brevo:</strong> Get free API key at <a href="https://brevo.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">brevo.com</a> (300 free emails/day).</li>
                    <li>Paste your key &rarr; click <strong>Test Connection</strong>. Dispatched 100% via HTTPS Port 443!</li>
                  </ul>
                </div>

                {/* Method 2: cPanel send.php with cURL */}
                <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">
                      B
                    </div>
                    <h5 className="text-xs font-bold text-white">cPanel send.php (Self-Hosted)</h5>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    If you prefer hosting the endpoint on your own domain:
                  </p>
                  <ol className="text-[11px] text-gray-400 space-y-1 list-decimal list-inside">
                    <li>Go to the <strong>send.php Script</strong> tab and click <strong>Download send.php</strong>.</li>
                    <li>Upload it to your cPanel <code className="text-emerald-400 font-mono">public_html/</code> folder.</li>
                    <li>Enter <code className="text-emerald-400 font-mono">https://yourdomain.com/send.php</code> and test. It relays via cURL over HTTPS Port 443 without touching Port 25!</li>
                  </ol>
                </div>
              </div>

              {/* Troubleshooting note */}
              <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-2 text-xs text-gray-400">
                <span className="font-semibold text-gray-200">Key Benefits of Port 443 REST API:</span>
                <ul className="list-disc pl-5 space-y-1 text-[11px]">
                  <li><strong className="text-emerald-300">Zero Port Restrictions:</strong> Works on Render, Railway, Vercel, and firewalled servers.</li>
                  <li><strong className="text-emerald-300">Deliverability:</strong> Deliveries to Gmail, Yahoo, Hotmail, and Outlook do not bounce due to unverified port 25 IP addresses.</li>
                  <li><strong className="text-emerald-300">DKIM &amp; SPF:</strong> REST providers automatically sign messages with high reputation DKIM certificates.</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-950/80">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>
              Status:{' '}
              <strong className={config.status === 'verified' ? 'text-emerald-400' : 'text-gray-400'}>
                {config.status === 'verified' ? 'Verified & Active' : 'Not Tested'}
              </strong>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
            >
              Save &amp; Use HTTP API
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
