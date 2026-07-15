/**
 * send-invite-email — Supabase Edge Function
 *
 * Emails a gym invite (staff or admin) to the invitee via SMTP (nodemailer).
 * Runs on Deno via Supabase Edge Functions — nodemailer is loaded through the
 * `npm:` specifier, which works because Deno's Node-compat layer implements
 * the `node:net` / `node:tls` sockets nodemailer's SMTP transport needs.
 *
 * Deploy:  supabase functions deploy send-invite-email
 * Secrets to set:
 *   SMTP_HOST        — smtp.gmail.com
 *   SMTP_PORT        — 587
 *   SMTP_USERNAME    — the Gmail address sending on the platform's behalf
 *   SMTP_PASSWORD    — a Gmail App Password (not the account password)
 *   SMTP_FROM_NAME   — display name, e.g. "Ferrum"        (optional, defaults below)
 *   SMTP_FROM_EMAIL  — defaults to SMTP_USERNAME if unset  (Gmail requires From == authenticated user)
 *   SITE_URL         — https://admin.yourapp.com (admin portal origin, for the invite link)
 *
 * POST /functions/v1/send-invite-email
 * Headers: Authorization: Bearer <user-jwt>
 * Body:   { invite_id: string }
 * Returns: { sent: true }
 *
 * The invite's email/role/gym/token are loaded server-side from `gym_invites`
 * (service role) rather than trusted from the request body, so a caller can't
 * spoof the email content — they can only ask to (re)send a real, existing invite.
 */

import nodemailer from 'npm:nodemailer'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
  const siteUrl     = Deno.env.get('SITE_URL') ?? 'http://localhost:5174'

  const smtpHost = Deno.env.get('SMTP_HOST')
  const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '587')
  const smtpUser = Deno.env.get('SMTP_USERNAME')
  const smtpPass = Deno.env.get('SMTP_PASSWORD')
  const fromName  = Deno.env.get('SMTP_FROM_NAME') ?? 'Ferrum'
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') ?? smtpUser

  if (!smtpHost || !smtpUser || !smtpPass) {
    return jsonError('SMTP is not configured (SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD missing)', 500)
  }

  // Authenticate the caller
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  const adminClient = createClient(supabaseUrl, serviceKey)

  // Caller must be admin or owner (matches who is allowed to create invites)
  const { data: callerProfile } = await adminClient
    .from('profiles').select('role, gym_id').eq('id', user.id).single()
  if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
    return jsonError('Forbidden', 403)
  }

  const body = await req.json().catch(() => ({}))
  const inviteId = body.invite_id
  if (!inviteId) return jsonError('invite_id is required', 400)

  const { data: invite, error: inviteErr } = await adminClient
    .from('gym_invites')
    .select('id, email, role, token, gym_id, expires_at, accepted_at, gyms(name)')
    .eq('id', inviteId)
    .single()

  if (inviteErr || !invite) return jsonError('Invite not found', 404)
  if (invite.accepted_at) return jsonError('Invite already accepted', 400)

  // Admins may only send invites that belong to their own gym
  if (callerProfile.role === 'admin' && invite.gym_id !== callerProfile.gym_id) {
    return jsonError('Forbidden: wrong gym', 403)
  }

  const gymName = (invite as any).gyms?.name ?? 'your gym'
  const inviteUrl = `${siteUrl}/invite/${invite.token}`
  const roleLabel = invite.role === 'admin' ? 'Admin' : 'Trainer'

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  })

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: invite.email,
      subject: `You've been invited to join ${gymName} on Ferrum`,
      text:
        `You've been invited to join ${gymName} on Ferrum as ${roleLabel}.\n\n` +
        `Accept your invite: ${inviteUrl}\n\n` +
        `This link expires ${new Date(invite.expires_at).toLocaleDateString()}.`,
      html: renderInviteEmail({ gymName, roleLabel, inviteUrl, expiresAt: invite.expires_at }),
    })
  } catch (err) {
    return jsonError(`Failed to send email: ${(err as Error).message}`, 502)
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
})

// Table-based layout throughout (not divs) — the standard approach for HTML
// email so Outlook's Word rendering engine lays this out correctly, not just
// browser-based mail clients. Font stacks always fall back to Arial/sans —
// Barlow Condensed isn't installed on the recipient's machine and email
// clients can't load @font-face reliably, so this is a graceful degrade,
// not a rendering bug.
function renderInviteEmail(opts: { gymName: string; roleLabel: string; inviteUrl: string; expiresAt: string }) {
  const expires = new Date(opts.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const gymName = escapeHtml(opts.gymName)
  const roleLabel = escapeHtml(opts.roleLabel).toUpperCase()
  const url = escapeHtml(opts.inviteUrl)
  const heading = `'Barlow Condensed', Arial, sans-serif`
  const body = `Arial, Helvetica, sans-serif`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>You've been invited to ${gymName} on Ferrum</title>
</head>
<body style="margin:0; padding:0; background:#0A0A0A;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
    You've been invited to join ${gymName} as ${roleLabel} on Ferrum.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="440" cellpadding="0" cellspacing="0" border="0" style="max-width:440px; width:100%; background:#1C1C1E; border:1px solid #252528;">

          <!-- Logo mark: same three bars/colors as BrandMark.vue, rebuilt from table cells so it renders with no image loading required -->
          <tr>
            <td style="padding:28px 28px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-right:10px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="6" height="20" bgcolor="#4A9EFF" style="background:#4A9EFF; font-size:0; line-height:0;">&nbsp;</td>
                    <td width="3" style="font-size:0; line-height:0;">&nbsp;</td>
                    <td width="6" height="26" bgcolor="#4A9EFF" style="background:#4A9EFF; font-size:0; line-height:0;">&nbsp;</td>
                    <td width="3" style="font-size:0; line-height:0;">&nbsp;</td>
                    <td width="6" height="32" bgcolor="#FFB400" style="background:#FFB400; font-size:0; line-height:0;">&nbsp;</td>
                  </tr></table>
                </td>
                <td style="font-family:${heading}; font-weight:900; font-size:22px; letter-spacing:0.04em; color:#F0F0F0;">FERRUM</td>
              </tr></table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 28px 0;">
              <p style="font-family:${body}; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#8E8E93; margin:0 0 8px;">You've been invited</p>
              <h1 style="font-family:${heading}; font-size:26px; font-weight:900; color:#F0F0F0; margin:0 0 20px;">${gymName}</h1>
            </td>
          </tr>

          <!-- Info card: role + expiry, same shape as the real /invite page -->
          <tr>
            <td style="padding:0 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0F0F10; border:1px solid #252528;">
                <tr>
                  <td style="padding:14px 16px; font-family:${body}; font-size:13px; color:#8E8E93;">Role</td>
                  <td align="right" style="padding:14px 16px;">
                    <span style="display:inline-block; font-family:${heading}; font-size:12px; font-weight:800; letter-spacing:0.1em; color:#4A9EFF; background:#16273b; border:1px solid #2c5686; padding:3px 10px;">${roleLabel}</span>
                  </td>
                </tr>
                <tr><td colspan="2" style="border-top:1px solid #252528; font-size:0; line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 16px; font-family:${body}; font-size:13px; color:#8E8E93;">Expires</td>
                  <td align="right" style="padding:14px 16px; font-family:${body}; font-size:13px; color:#AEAEB2;">${expires}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:0 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="center" bgcolor="#4A9EFF" style="background:#4A9EFF;">
                  <a href="${url}" style="display:block; padding:14px 24px; font-family:${heading}; font-weight:800; letter-spacing:0.1em; font-size:14px; color:#ffffff; text-decoration:none;">ACCEPT INVITE</a>
                </td>
              </tr></table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 28px;">
              <p style="font-family:${body}; font-size:12px; color:#636366; margin:0; word-break:break-all;">
                Or paste this link into your browser:<br>
                <a href="${url}" style="color:#4A9EFF;">${url}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px; border-top:1px solid #252528;">
              <p style="font-family:${body}; font-size:11px; color:#48484A; margin:0;">
                Sent by Ferrum. If you weren't expecting this invite, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
