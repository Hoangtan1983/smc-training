<?php
/**
 * SMC Training — Email Helper
 * Gửi email qua PHP mail() hoặc SMTP
 * Dùng chung cho toàn hệ thống
 */

function smcSendEmail($to, $subject, $htmlMessage, $options = []) {
    $fromEmail = $options['from'] ?? 'no-reply@smc-training.com';
    $fromName = $options['fromName'] ?? 'SMC Training';
    $replyTo = $options['replyTo'] ?? 'support@smc-training.com';

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        "From: {$fromName} <{$fromEmail}>",
        "Reply-To: {$replyTo}",
        'X-Mailer: SMC-Training/2.0',
        'X-Priority: 1',
    ];

    if (!function_exists('mail')) {
        return ['sent' => false, 'error' => 'mail() function not available'];
    }

    $headerStr = implode("\r\n", $headers);

    // Try 1: Standard mail()
    $sent = @mail($to, $subject, $htmlMessage, $headerStr);
    if ($sent) return ['sent' => true, 'method' => 'mail'];

    // Try 2: With -f parameter (sets return-path, required by some MTAs)
    $sent = @mail($to, $subject, $htmlMessage, $headerStr, "-f {$fromEmail}");
    if ($sent) return ['sent' => true, 'method' => 'mail-with-f'];

    // Try 3: Minimal headers
    $minHeaders = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: {$fromEmail}";
    $sent = @mail($to, $subject, $htmlMessage, $minHeaders, "-f {$fromEmail}");
    if ($sent) return ['sent' => true, 'method' => 'mail-minimal'];

    // All attempts failed
    $err = error_get_last();
    return ['sent' => false, 'error' => $err['message'] ?? 'mail() returned false'];
}
